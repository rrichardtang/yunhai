const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

const { getAuthedUserId, parseUserId } = require('../middleware/auth');
const { acquire: acquireLlmSlot, release: releaseLlmSlot } = require('../middleware/llmSemaphore');
const {
  planCity,
  normalizeActivity,
  SYSTEM_PROMPT: ACTIVITY_SYSTEM_PROMPT
} = require('../claude');
const {
  getSummary: getPreferenceSummary,
  recordPreference,
  recordConstraint
} = require('../preferences');
const { search, isConfigured: isBraveConfigured, shouldUseBrave } = require('../braveSearch');
const { DEFAULT_ACTIVITY_CATEGORY_CONFIG } = require('../arrangeConfig');
const { buildBookingLinks } = require('../services/bookingLinks');
const { buildDirectArrangePrompt, buildRepairPrompt } = require('../services/arrangePromptDirect');
const { validate: validateArrangement } = require('../arrangeValidator');
const { buildCityTravelTiming } = require('../services/distanceMatrix');
const arrangeTelemetry = require('../services/arrangeTelemetry');

const ACTIVITY_REFINE_MODEL = 'gpt-5.4-mini';

const placesCache = new Map();
const PLACES_CACHE_MAX = 500;

function placesCacheGet(key) {
  if (!placesCache.has(key)) return null;
  const value = placesCache.get(key);
  placesCache.delete(key);
  placesCache.set(key, value);
  return value;
}

function placesCacheSet(key, value) {
  if (placesCache.has(key)) placesCache.delete(key);
  placesCache.set(key, value);
  if (placesCache.size > PLACES_CACHE_MAX) {
    const oldestKey = placesCache.keys().next().value;
    placesCache.delete(oldestKey);
  }
}

function extractText(content = []) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c?.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

function stripCodeFences(raw = '') {
  let cleaned = String(raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

function extractLikelyJsonObject(raw = '') {
  const text = String(raw || '');
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function repairTruncatedJson(raw = '') {
  let text = String(raw || '').trim();
  text = text.replace(/,\s*$/, '');
  text = text.replace(/,?\s*"[^"]*"\s*:\s*(?:"[^"]*)?$/, '');
  const opens = [];
  let inStr = false, esc = false;
  for (const ch of text) {
    if (inStr) { if (esc) { esc = false; } else if (ch === '\\') { esc = true; } else if (ch === '"') { inStr = false; } continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{' || ch === '[') opens.push(ch);
    if (ch === '}' || ch === ']') opens.pop();
  }
  while (opens.length) {
    const open = opens.pop();
    text += open === '{' ? '}' : ']';
  }
  return text;
}

function tryParseJsonObject(raw = '') {
  const stripped = stripCodeFences(raw);
  const attempts = [stripped];
  const extracted = extractLikelyJsonObject(stripped);
  if (extracted && extracted !== stripped) attempts.push(extracted);
  const relaxed = extracted
    ? extracted.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    : null;
  if (relaxed && !attempts.includes(relaxed)) attempts.push(relaxed);
  const repaired = repairTruncatedJson(extracted || stripped);
  if (!attempts.includes(repaired)) attempts.push(repaired);

  for (const candidate of attempts) {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    } catch {
      // try next strategy
    }
  }
  return null;
}

function register(app) {
  app.get('/api/places/resolve', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const city = String(req.query.city || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q parameter' });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return res.json({ error: 'maps_disabled' });

    const cacheKey = `${q.toLowerCase()}|${city.toLowerCase()}`;
    const cached = placesCacheGet(cacheKey);
    if (cached) return res.json(cached);

    const input = city ? `${q}, ${city}` : q;
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(input)}&inputtype=textquery&fields=place_id,geometry,name,price_level,rating,user_ratings_total,formatted_address&key=${apiKey}`;

    try {
      const r = await fetch(url);
      if (!r.ok) {
        console.warn(`[places] lookup failed ${r.status} for "${input}"`);
        return res.json({ error: 'lookup_failed' });
      }
      const data = await r.json();
      const candidate = Array.isArray(data.candidates) ? data.candidates[0] : null;
      if (!candidate) {
        const response = { placeId: null };
        placesCacheSet(cacheKey, response);
        return res.json(response);
      }
      const response = {
        placeId: candidate.place_id || null,
        lat: candidate.geometry?.location?.lat ?? null,
        lng: candidate.geometry?.location?.lng ?? null,
        name: candidate.name || null,
        formattedAddress: candidate.formatted_address || null,
        priceLevel: typeof candidate.price_level === 'number' ? candidate.price_level : null,
        rating: typeof candidate.rating === 'number' ? candidate.rating : null,
        userRatingsTotal: typeof candidate.user_ratings_total === 'number' ? candidate.user_ratings_total : null
      };
      placesCacheSet(cacheKey, response);
      return res.json(response);
    } catch (err) {
      console.warn(`[places] exception for "${input}": ${err.message}`);
      return res.json({ error: 'lookup_failed' });
    }
  });

  app.post('/api/activity/refine', async (req, res) => {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    const { activity, note, budget_target } = req.body || {};
    if (!activity?.name || !note) {
      return res.status(400).json({ error: 'activity and note are required' });
    }

    try {
      const braveResults = isBraveConfigured()
        ? await search(`${activity.name} ${activity.city} ${note}`, { task: 'entity_enrichment', count: 3 })
        : [];
      const braveBlock = braveResults.length
        ? `\nWeb research (use to anchor the refined activity in a real venue — do not invent place names):\n${braveResults.map(r => `- ${r.title}: ${r.description}`).join('\n')}`
        : '';
      const budgetClause = budget_target != null
        ? `\nThe refined activity's estimated_cost_usd must be at or below ${budget_target}. Downscale the venue or choose a cheaper equivalent within the same activity type and city.`
        : '';

      const userContent = `You are refining an existing travel activity. The traveler wants a tweak, not a replacement.

Current activity: ${JSON.stringify(activity)}
Traveler's note: "${note}"${braveBlock}${budgetClause}

Return ONLY a JSON object containing the fields that should change. Preserve all field names from the current activity. If the traveler names a specific place, the "name" field must include it verbatim.`;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: ACTIVITY_REFINE_MODEL,
        max_completion_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: userContent }]
      });

      const updates = JSON.parse(response.choices?.[0]?.message?.content?.trim() || '{}');

      const updatedName = updates.name || activity.name;
      const updatedCity = updates.city || activity.city;
      const isNewShape = activity.booking !== undefined;
      const existingBookingType = isNewShape ? activity.booking?.type : activity.booking_type;
      const updatedBookingType = updates.booking_type || existingBookingType || 'none';

      if (updatedBookingType !== 'none') {
        const searchName = updates.venue_name || activity.venue_name || updatedName;
        const newLinks = buildBookingLinks({
          bookingType: updatedBookingType,
          name: searchName,
          city: updatedCity,
          date: activity.scheduled_date || ''
        });

        if (isNewShape) {
          updates.booking = { ...(activity.booking || {}), type: updatedBookingType, links: newLinks };
          delete updates.booking_type;
          delete updates.booking_links;
        } else {
          updates.booking_links = newLinks;
        }
      } else if (isNewShape) {
        updates.booking = { ...(activity.booking || {}), type: 'none', links: [] };
        delete updates.booking_type;
        delete updates.booking_links;
      } else {
        updates.booking_links = [];
      }

      return res.json({ updates });
    } catch (error) {
      console.error('[/api/activity/refine]', error);
      return res.status(500).json({ error: error.message || 'Failed to refine activity' });
    }
  });

  app.post('/api/activity/replace', async (req, res) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'Anthropic API key not configured' });
    }

    const { activity, reason, notes, userId } = req.body || {};
    if (!activity?.name || !activity?.city) {
      return res.status(400).json({ error: 'activity.name and activity.city are required' });
    }

    const resolvedUserId = parseUserId(userId);
    const prefSummary = getPreferenceSummary(resolvedUserId);
    const systemPrompt = prefSummary ? `${ACTIVITY_SYSTEM_PROMPT}\n\n${prefSummary}` : ACTIVITY_SYSTEM_PROMPT;

    const reasonText = String(reason || '').trim();
    const notesText = String(notes || '').trim();
    const activityType = String(activity.type || '').toLowerCase();
    const isMeal = ['food', 'breakfast', 'lunch', 'dinner'].includes(activityType);
    const braveQuery = reasonText
      ? `${reasonText} ${activity.city}${isMeal ? ' restaurant' : ''}`.trim()
      : `${activity.name} ${activity.city}`;
    const useBraveForEnrichment = isBraveConfigured() && shouldUseBrave('entity_enrichment', {
      query: braveQuery,
      needsLiveGrounding: true
    });
    const braveResults = useBraveForEnrichment ? await search(braveQuery, { task: 'entity_enrichment' }) : [];
    const braveBlock = braveResults.length
      ? `\nWeb research (use to ground the replacement in a real venue — pick from these results when they match what the traveler asked for):\n${braveResults.map(r => `- ${r.title}: ${r.description}`).join('\n')}`
      : '';

    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const contextClause = reasonText ? `\nReason for declining: "${reasonText}"` : '';
      const notesClause = notesText ? `\nAdditional saved notes: "${notesText}"` : '';
      const mealReminderClause = isMeal
        ? '\nThis is a meal activity — name a specific restaurant and include 1–2 must-order dishes in why_it_fits.'
        : '';
      const userContent = `The traveler DECLINED "${activity.name}" in ${activity.city} and wants a different ${activityType || 'activity'}.${contextClause}${notesClause}${mealReminderClause}${braveBlock}

Find a DIFFERENT real-world venue — NOT "${activity.name}". The replacement must directly address the reason for declining (e.g. if the reason mentions a neighborhood, the replacement must be in that neighborhood; if it mentions a cuisine or price level, match that). Use the web research to ground it in an actual venue, and fill in pricing, booking info, duration, and other details.

Also extract any learnable preferences or constraints from the traveler's note. Omit if one-off or situational (e.g. "already did this", "too expensive this trip"). Preferences are specific, reusable details (e.g. "gets seasick easily"). Constraints are hard limits (e.g. "no early mornings").

Return ONLY valid JSON (no markdown fences):
{
  "activity": { ...single activity object matching the standard activity schema... },
  "preferences": [],
  "constraints": []
}`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }]
      });

      const raw = extractText(response.content);
      const parsed = tryParseJsonObject(raw);
      if (!parsed) {
        console.error('activity/replace JSON parse failed; raw response (first 800 chars):', raw.slice(0, 800));
        return res.status(500).json({ error: 'Failed to parse replacement JSON' });
      }
      if (!parsed.activity || typeof parsed.activity !== 'object') {
        return res.status(500).json({ error: 'LLM returned unexpected shape' });
      }

      const normalized = normalizeActivity(parsed.activity, activity.city);

      for (const p of (Array.isArray(parsed.preferences) ? parsed.preferences : [])) recordPreference(resolvedUserId, p);
      for (const c of (Array.isArray(parsed.constraints) ? parsed.constraints : [])) recordConstraint(resolvedUserId, c);

      return res.json({ activity: normalized });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to replace activity' });
    }
  });

  app.get('/api/arrange-config', (_req, res) => {
    res.json({ categoryDefaults: DEFAULT_ACTIVITY_CATEGORY_CONFIG });
  });

  app.post('/api/arrange', async (req, res) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'Anthropic API key not configured' });
    }

    const { days, activities, lockedActivities, commuteMatrix, profile, numTravelers, numChildren } = req.body || {};
    if (!Array.isArray(days) || !Array.isArray(activities)) {
      return res.status(400).json({ error: 'days and activities are required arrays' });
    }
    const resolvedLocked = Array.isArray(lockedActivities) ? lockedActivities : [];
    const lockedIdSet = new Set(resolvedLocked.map((l) => String(l.id)));
    const flexible = activities.filter((a) => !lockedIdSet.has(String(a.id)));

    if (flexible.length === 0) {
      return res.json({ placements: {}, unplaced: [], diagnostics: [] });
    }

    const userId = parseUserId(getAuthedUserId(req));
    const prefSummary = getPreferenceSummary(userId);
    const activitiesById = Object.fromEntries(flexible.map((a) => [String(a.id), a]));
    const matrix = commuteMatrix && typeof commuteMatrix === 'object' ? commuteMatrix : {};

    async function callClaudeForJson(prompt) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 16384,
        system: 'You output strict JSON only. No preamble, no explanation, no markdown fences. Begin your response with { and end with }.',
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: '{' }
        ]
      });
      const final = await stream.finalMessage();
      const raw = '{' + extractText(final.content);
      const parsed = tryParseJsonObject(raw);
      if (!parsed) {
        console.error(`arrange JSON parse failed (stop_reason=${final.stop_reason}, length=${raw.length})`);
        console.error('arrange raw response (first 800 chars):', raw.slice(0, 800));
        console.error('arrange raw response (last 400 chars):', raw.slice(-400));
        throw new Error('Failed to parse arrangement JSON');
      }
      return parsed;
    }

    function sanitizePlacements(parsed) {
      const rawPlacements = parsed?.placements && typeof parsed.placements === 'object' ? parsed.placements : {};
      const placements = {};
      for (const [rawId, val] of Object.entries(rawPlacements)) {
        const id = String(rawId);
        if (lockedIdSet.has(id)) continue;
        if (!activitiesById[id]) continue;
        if (!val || typeof val !== 'object') continue;
        const date = String(val.date || '');
        const time = String(val.time || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        if (!/^\d{1,2}:\d{2}$/.test(time)) continue;
        placements[id] = { date, time };
      }
      const unplaced = Array.isArray(parsed?.unplaced)
        ? parsed.unplaced.filter((u) => activitiesById[String(u?.id)]).map((u) => ({ id: String(u.id), reason: String(u.reason || '') }))
        : [];
      return { placements, unplaced };
    }

    const cityName = days[0]?.city || '';
    let firstPassValid = false;
    let firstPassIssues = [];
    let repairUsed = false;
    let secondPassValid = false;

    try {
      const prompt = buildDirectArrangePrompt({
        days,
        flexible,
        locked: resolvedLocked,
        profile,
        prefSummary,
        numTravelers,
        numChildren,
        cityName
      });
      const parsed = await callClaudeForJson(prompt);
      let { placements, unplaced } = sanitizePlacements(parsed);

      let v = validateArrangement({ placements, lockedActivities: resolvedLocked, days, activitiesById });
      firstPassValid = v.ok;
      firstPassIssues = v.issues || [];

      if (!v.ok) {
        repairUsed = true;
        try {
          const repairPrompt = buildRepairPrompt({ placements, issues: v.issues, activitiesById });
          const repaired = await callClaudeForJson(repairPrompt);
          const repairedSan = sanitizePlacements(repaired);
          placements = repairedSan.placements;
          unplaced = [...unplaced, ...repairedSan.unplaced];
          v = validateArrangement({ placements, lockedActivities: resolvedLocked, days, activitiesById });
          secondPassValid = v.ok;
        } catch (repairErr) {
          console.warn('[arrange] repair pass failed:', repairErr.message);
        }
      }

      if (!v.ok) {
        const brokenIds = new Set(v.issues.flatMap((i) => i.ids || (i.id ? [i.id] : [])));
        for (const id of brokenIds) {
          if (placements[id]) {
            unplaced.push({ id, reason: 'physics_unresolved' });
            delete placements[id];
          }
        }
        v = validateArrangement({ placements, lockedActivities: resolvedLocked, days, activitiesById });
      }

      arrangeTelemetry.logRun({
        userId,
        cityName,
        firstPassValid,
        issues: firstPassIssues,
        repairUsed,
        secondPassValid,
        flexibleCount: flexible.length,
        lockedCount: resolvedLocked.length
      });

      return res.json({
        placements,
        unplaced,
        diagnostics: v.ok ? [] : v.issues.map((i) => i.message)
      });
    } catch (error) {
      arrangeTelemetry.logRun({
        userId,
        cityName,
        firstPassValid,
        issues: firstPassIssues,
        repairUsed,
        secondPassValid,
        flexibleCount: flexible.length,
        lockedCount: resolvedLocked.length,
        error: error.message
      });
      return res.status(500).json({ error: error.message || 'Failed to arrange activities' });
    }
  });

  app.get('/api/admin/arrange-stats', async (req, res) => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) return res.status(404).json({ error: 'not_found' });
    const provided = req.get('x-admin-token') || req.query.token;
    if (provided !== adminToken) return res.status(403).json({ error: 'forbidden' });

    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 100));
    const runs = await arrangeTelemetry.readRecent(limit);
    return res.json({ summary: arrangeTelemetry.summarize(runs), runs });
  });

  app.post('/api/plan', async (req, res) => {
    const { cities, travels, profile, budget, numTravelers, numChildren, lockedActivities } = req.body || {};
    const resolvedBudget = Number.isFinite(Number(budget)) && Number(budget) > 0 ? Number(budget) : null;
    const resolvedTravelers = Math.max(1, Math.round(Number(numTravelers) || 1));
    const resolvedChildren = Math.max(0, Math.round(Number(numChildren) || 0));
    const resolvedLockedActivities = lockedActivities && typeof lockedActivities === 'object' && !Array.isArray(lockedActivities)
      ? lockedActivities
      : {};
    if (!Array.isArray(cities) || cities.length === 0) {
      return res.status(400).json({ error: 'cities must be a non-empty array' });
    }

    let resolvedUserId;
    try {
      resolvedUserId = parseUserId(getAuthedUserId(req));
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message || 'Invalid userId' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const sendEvent = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const tripTravels = Array.isArray(travels) ? travels.slice(0, 1) : [];
      const cityTravelTiming = await buildCityTravelTiming(cities);

      const planAndEnrich = async (city) => {
        const timing = cityTravelTiming[String(city?.name || '').trim()] || null;
        const cityLocked = Array.isArray(resolvedLockedActivities[city.name])
          ? resolvedLockedActivities[city.name]
          : [];
        await acquireLlmSlot();
        try {
          const activities = await planCity(city, profile, resolvedUserId, tripTravels, timing, resolvedBudget, cities.length, resolvedTravelers, resolvedChildren, cityLocked);

          const cityStartDate = city.startDate || '';
          for (const a of activities) {
            const bookingType = a.booking?.type ?? a.booking_type;
            const links = buildBookingLinks({
              bookingType,
              name: a.venue_name || a.name,
              city: city.name,
              date: cityStartDate,
              travelers: resolvedTravelers,
              children: resolvedChildren
            });
            if (links.length && a.booking) a.booking.links = links;
          }

          sendEvent({ type: 'city', city: city.name, activities, travelTiming: timing });
        } finally {
          releaseLlmSlot();
        }
      };

      const CONCURRENCY = 3;
      for (let i = 0; i < cities.length; i += CONCURRENCY) {
        await Promise.all(cities.slice(i, i + CONCURRENCY).map(planAndEnrich));
      }

      sendEvent({ type: 'done' });
      res.end();
    } catch (error) {
      if (error.code === 'ANTHROPIC_KEY_MISSING') {
        sendEvent({
          type: 'error',
          error: 'Anthropic API key not configured',
          code: error.code
        });
      } else {
        sendEvent({ type: 'error', error: error.message || 'Failed to generate plan' });
      }
      res.end();
    }
  });
}

module.exports = { register };
