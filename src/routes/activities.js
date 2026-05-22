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
const { adjust: adjustArrangementTimes } = require('../services/arrangeTimeAdjuster');
const { minutesFromTime } = require('../../shared/timeHelpers');
const { buildCityTravelTiming } = require('../services/distanceMatrix');
const arrangeTelemetry = require('../services/arrangeTelemetry');
const { enrichWithPlaceDetails } = require('../services/placesEnrich');
const { debugLog } = require('../services/debugLog');

const ACTIVITY_REFINE_MODEL = 'gpt-5.4-mini';
const ARRANGE_MODEL = 'claude-sonnet-4-6';

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
    const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(input)}&inputtype=textquery&fields=place_id,geometry,name,price_level,rating,user_ratings_total,formatted_address&key=${apiKey}`;
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(input)}&key=${apiKey}`;

    try {
      const r = await fetch(findPlaceUrl);
      if (!r.ok) {
        debugLog('places-resolve', `findplace_http=${r.status} input="${input}"`);
      } else {
        const data = await r.json();
        debugLog('places-resolve', `findplace status=${data.status} candidates=${(data.candidates || []).length} input="${input}"`);
        const candidate = Array.isArray(data.candidates) ? data.candidates[0] : null;
        if (candidate) {
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
        }
      }

      const gr = await fetch(geocodeUrl);
      if (!gr.ok) {
        debugLog('places-resolve', `geocode_http=${gr.status} input="${input}"`);
        const response = { placeId: null };
        placesCacheSet(cacheKey, response);
        return res.json(response);
      }
      const gdata = await gr.json();
      debugLog('places-resolve', `geocode status=${gdata.status} results=${(gdata.results || []).length} input="${input}"`);
      const result = Array.isArray(gdata.results) ? gdata.results[0] : null;
      if (!result) {
        const response = { placeId: null };
        placesCacheSet(cacheKey, response);
        return res.json(response);
      }
      const response = {
        placeId: result.place_id || null,
        lat: result.geometry?.location?.lat ?? null,
        lng: result.geometry?.location?.lng ?? null,
        name: null,
        formattedAddress: result.formatted_address || null,
        priceLevel: null,
        rating: null,
        userRatingsTotal: null
      };
      placesCacheSet(cacheKey, response);
      return res.json(response);
    } catch (err) {
      debugLog('places-resolve', `exception input="${input}" error=${err.message}`);
      return res.json({ error: 'lookup_failed' });
    }
  });

  app.post('/api/activity/refine', async (req, res) => {
    const refineStartTs = Date.now();
    if (!process.env.OPENAI_API_KEY) {
      debugLog('activity-refine', `REJECT reason=openai_key_missing`);
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    const { activity, note, budget_target } = req.body || {};
    debugLog('activity-refine', `INBOUND name="${activity?.name || ''}" city="${activity?.city || ''}" note_chars=${(note || '').length}`);
    if (!activity?.name || !note) {
      debugLog('activity-refine', `REJECT reason=missing_activity_or_note`);
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

      debugLog('activity-refine', `DONE name="${updatedName}" updated_fields=${Object.keys(updates).join(',')} elapsed_ms=${Date.now() - refineStartTs}`);
      return res.json({ updates });
    } catch (error) {
      debugLog('activity-refine', `ERROR msg="${error?.message || error}" elapsed_ms=${Date.now() - refineStartTs}`);
      return res.status(500).json({ error: error.message || 'Failed to refine activity' });
    }
  });

  app.post('/api/activity/replace', async (req, res) => {
    const replaceStartTs = Date.now();
    if (!process.env.ANTHROPIC_API_KEY) {
      debugLog('activity-replace', `REJECT reason=anthropic_key_missing`);
      return res.status(503).json({ error: 'Anthropic API key not configured' });
    }

    const { activity, reason, notes, userId } = req.body || {};
    debugLog('activity-replace', `INBOUND name="${activity?.name || ''}" city="${activity?.city || ''}" type="${activity?.type || ''}" reason_chars=${(reason || '').length}`);
    if (!activity?.name || !activity?.city) {
      debugLog('activity-replace', `REJECT reason=missing_name_or_city`);
      return res.status(400).json({ error: 'activity.name and activity.city are required' });
    }

    const resolvedUserId = parseUserId(userId);
    const prefSummary = getPreferenceSummary(resolvedUserId);
    const systemPrompt = prefSummary ? `${ACTIVITY_SYSTEM_PROMPT}\n\n${prefSummary}` : ACTIVITY_SYSTEM_PROMPT;

    const reasonText = String(reason || '').trim();
    const notesText = String(notes || '').trim();
    const activityType = String(activity.type || '').toLowerCase();
    const isMeal = activityType === 'meal';
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
      await enrichWithPlaceDetails([normalized], activity.city);

      for (const p of (Array.isArray(parsed.preferences) ? parsed.preferences : [])) recordPreference(resolvedUserId, p);
      for (const c of (Array.isArray(parsed.constraints) ? parsed.constraints : [])) recordConstraint(resolvedUserId, c);

      const hasCoords = Number.isFinite(Number(normalized?.location?.lat)) && Number.isFinite(Number(normalized?.location?.lng));
      debugLog('activity-replace', `DONE name="${normalized?.name || ''}" has_coords=${hasCoords} elapsed_ms=${Date.now() - replaceStartTs}`);
      return res.json({ activity: normalized });
    } catch (error) {
      debugLog('activity-replace', `ERROR msg="${error?.message || error}" elapsed_ms=${Date.now() - replaceStartTs}`);
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

    const { days, activities, lockedActivities, commuteMatrix, profile, numTravelers, numChildren, schedulingPrefs } = req.body || {};
    debugLog('arrange', `INBOUND activities=${Array.isArray(activities) ? activities.length : 'N/A'} locked=${Array.isArray(lockedActivities) ? lockedActivities.length : 0} days=${Array.isArray(days) ? days.length : 'N/A'} city="${Array.isArray(days) ? (days[0]?.city || '') : ''}"`);
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
    const matrixPairCount = Object.values(matrix).reduce((sum, row) => sum + (row && typeof row === 'object' ? Object.keys(row).length : 0), 0);

    let cityName = days[0]?.city || '';
    if (!cityName) {
      const counts = {};
      for (const a of activities) {
        const c = String(a?.city || '').trim();
        if (c) counts[c] = (counts[c] || 0) + 1;
      }
      cityName = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      if (cityName) debugLog('arrange', `CITY_FALLBACK derived="${cityName}" reason=days[0].city_empty`);
      else debugLog('arrange', `CITY_EMPTY no city available — downstream lookups will be unqualified`);
    }

    debugLog('arrange', `START model=${ARRANGE_MODEL} flexible=${flexible.length} locked=${resolvedLocked.length} days=${days.length} city="${cityName}" matrix_pairs=${matrixPairCount}`);

    const SCHEDULE_TOOL = {
      name: 'submit_schedule',
      description: 'Submit the final activity schedule with concrete date+time for placements and reasons for unplaced activities.',
      input_schema: {
        type: 'object',
        properties: {
          placements: {
            type: 'object',
            description: 'Map of activity id to scheduled date and time.',
            additionalProperties: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'YYYY-MM-DD' },
                time: { type: 'string', description: '24-hour HH:MM' }
              },
              required: ['date', 'time']
            }
          },
          unplaced: {
            type: 'array',
            description: 'Activities that could not be placed and why.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                reason: { type: 'string' }
              },
              required: ['id', 'reason']
            }
          }
        },
        required: ['placements', 'unplaced']
      }
    };

    async function callLlmForJson(prompt) {
      debugLog('arrange', `LLM_CALL model=${ARRANGE_MODEL} prompt_chars=${prompt.length}`);
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await anthropic.messages.create({
        model: ARRANGE_MODEL,
        max_tokens: 16384,
        tools: [SCHEDULE_TOOL],
        tool_choice: { type: 'tool', name: 'submit_schedule' },
        messages: [{ role: 'user', content: prompt }]
      });
      const toolUse = (response.content || []).find((c) => c.type === 'tool_use' && c.name === 'submit_schedule');
      debugLog('arrange', `LLM_RESPONSE finish=${response.stop_reason} tool_use=${!!toolUse}`);
      if (!toolUse || !toolUse.input || typeof toolUse.input !== 'object') {
        console.error(`arrange tool_use missing (stop_reason=${response.stop_reason})`);
        const rawText = extractText(response.content).slice(0, 800);
        console.error('arrange response text (first 800 chars):', rawText);
        const err = new Error('Failed to parse arrangement JSON');
        err.diagnostic = {
          stop_reason: response.stop_reason,
          tool_use: false,
          head: rawText
        };
        throw err;
      }
      return toolUse.input;
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
        cityName,
        commuteMatrix: matrix,
        schedulingPrefs
      });
      const hasClusterBlock = prompt.includes('WALKING NEIGHBORS');
      const hasCommuteBlock = prompt.includes('COMMUTE TIMES');
      const activitiesWithCoords = flexible.filter((a) => {
        const rawLat = a?.location?.lat ?? a?.start_latitude;
        const rawLng = a?.location?.lng ?? a?.start_longitude;
        if (rawLat == null || rawLng == null) return false;
        const lat = Number(rawLat);
        const lng = Number(rawLng);
        return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
      }).length;
      debugLog('arrange', `PROMPT_INFO cluster_block=${hasClusterBlock} commute_block=${hasCommuteBlock} acts_with_coords=${activitiesWithCoords}/${flexible.length}`);
      const parsed = await callLlmForJson(prompt);
      let { placements, unplaced } = sanitizePlacements(parsed);
      debugLog('arrange', `FIRST_PASS placed=${Object.keys(placements).length} unplaced=${unplaced.length} unplaced_ids=${unplaced.map((u) => u.id).join(',') || 'none'}`);

      let v = validateArrangement({ placements, lockedActivities: resolvedLocked, days, activitiesById, commuteMatrix: matrix, unplacedIds: unplaced.map((u) => u.id) });
      firstPassValid = v.ok;
      firstPassIssues = v.issues || [];
      if (!v.ok) {
        const issueSummary = v.issues.map((i) => i.type).join(',');
        debugLog('arrange', `VALIDATE_FAIL count=${v.issues.length} types=${issueSummary}`);
      } else {
        debugLog('arrange', 'VALIDATE_OK first_pass');
      }

      if (!v.ok) {
        repairUsed = true;
        try {
          const repairPrompt = buildRepairPrompt({ placements, issues: v.issues, activitiesById });
          const repaired = await callLlmForJson(repairPrompt);
          const repairedSan = sanitizePlacements(repaired);
          placements = repairedSan.placements;
          unplaced = [...unplaced, ...repairedSan.unplaced];
          const placedIds = new Set(Object.keys(placements));
          const seen = new Set();
          unplaced = unplaced.filter((u) => {
            if (placedIds.has(u.id)) return false;
            if (seen.has(u.id)) return false;
            seen.add(u.id);
            return true;
          });
          v = validateArrangement({ placements, lockedActivities: resolvedLocked, days, activitiesById, commuteMatrix: matrix, unplacedIds: unplaced.map((u) => u.id) });
          secondPassValid = v.ok;
          debugLog('arrange', `REPAIR_PASS ok=${v.ok} remaining_issues=${(v.issues || []).map((i) => i.type).join(',') || 'none'}`);
        } catch (repairErr) {
          console.warn('[arrange] repair pass failed:', repairErr.message);
          debugLog('arrange', `REPAIR_PASS_THREW err="${repairErr?.message || repairErr}"`);
        }
      }

      const adjusterResult = adjustArrangementTimes({
        placements,
        days,
        activitiesById,
        lockedActivities: resolvedLocked,
        commuteMatrix: matrix
      });
      placements = adjusterResult.placements;
      if (adjusterResult.drops.length) {
        const placedIds = new Set(Object.keys(placements));
        unplaced = unplaced.filter((u) => !placedIds.has(u.id));
        for (const d of adjusterResult.drops) {
          if (!unplaced.find((u) => u.id === d.id)) unplaced.push(d);
        }
      }
      debugLog('arrange', `ADJUSTER_RUN day_count=${days.length} moved=${adjusterResult.moved} dropped=${adjusterResult.drops.length}`);
      v = validateArrangement({ placements, lockedActivities: resolvedLocked, days, activitiesById, commuteMatrix: matrix, unplacedIds: unplaced.map((u) => u.id) });

      if (!v.ok) {
        const toDrop = new Set();
        for (const issue of v.issues) {
          if (issue.type === 'empty_dinner_with_available_meal') continue;
          if ((issue.type === 'overlap' || issue.type === 'commute_gap_violation') && Array.isArray(issue.ids) && issue.ids.length === 2) {
            const [idA, idB] = issue.ids;
            const aStart = minutesFromTime(placements[idA]?.time || '00:00');
            const bStart = minutesFromTime(placements[idB]?.time || '00:00');
            toDrop.add(aStart <= bStart ? idB : idA);
          } else if (issue.id) {
            toDrop.add(issue.id);
          }
        }
        for (const id of toDrop) {
          if (placements[id]) {
            unplaced.push({ id, reason: 'physics_unresolved' });
            delete placements[id];
          }
        }
        debugLog('arrange', `FORCE_DROP ids=${[...toDrop].join(',') || 'none'}`);
        v = validateArrangement({ placements, lockedActivities: resolvedLocked, days, activitiesById });
      }

      debugLog('arrange', `RETURN placed=${Object.keys(placements).length} unplaced=${unplaced.length} repair_used=${repairUsed} second_pass_ok=${secondPassValid}`);

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
      debugLog('arrange', `ERROR msg="${error?.message || error}" diag=${JSON.stringify(error?.diagnostic || null)}`);
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
      const debugMode = process.env.ARRANGE_DEBUG === '1' || req.query.debug === '1';
      const body = { error: error.message || 'Failed to arrange activities' };
      if (debugMode && error.diagnostic) body.diagnostic = error.diagnostic;
      return res.status(500).json(body);
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
    const planStartTs = Date.now();
    const { cities, travels, profile, budget, numTravelers, numChildren, lockedActivities } = req.body || {};
    debugLog('plan', `INBOUND cities=${Array.isArray(cities) ? cities.length : 'N/A'} travelers=${numTravelers || 1} children=${numChildren || 0} budget=${budget || 'none'}`);
    const resolvedBudget = Number.isFinite(Number(budget)) && Number(budget) > 0 ? Number(budget) : null;
    const resolvedTravelers = Math.max(1, Math.round(Number(numTravelers) || 1));
    const resolvedChildren = Math.max(0, Math.round(Number(numChildren) || 0));
    const resolvedLockedActivities = lockedActivities && typeof lockedActivities === 'object' && !Array.isArray(lockedActivities)
      ? lockedActivities
      : {};
    if (!Array.isArray(cities) || cities.length === 0) {
      debugLog('plan', `REJECT reason=cities_empty_or_invalid`);
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
          let activities;
          try {
            activities = await planCity(city, profile, resolvedUserId, tripTravels, timing, resolvedBudget, cities.length, resolvedTravelers, resolvedChildren, cityLocked);
          } catch (planErr) {
            debugLog('plan', `planCity THREW city=${city.name} err=${planErr?.message || planErr}`);
            throw planErr;
          }
          debugLog('plan', `planCity RETURNED city=${city.name} count=${activities?.length || 0}`);

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
      debugLog('plan', `DONE cities=${cities.length} elapsed_ms=${Date.now() - planStartTs}`);
      res.end();
    } catch (error) {
      debugLog('plan', `ERROR msg="${error?.message || error}" code=${error?.code || ''} elapsed_ms=${Date.now() - planStartTs}`);
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
