const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

const { getAuthedUserId, parseUserId } = require('../middleware/auth');
const { acquire: acquireLlmSlot, release: releaseLlmSlot } = require('../middleware/llmSemaphore');
const {
  planCity,
  normalizeActivity,
  SYSTEM_PROMPT: ACTIVITY_SYSTEM_PROMPT
} = require('../claude');
const { recall, observe } = require('../memory');
const { search, isConfigured: isBraveConfigured, shouldUseBrave } = require('../braveSearch');
const { DEFAULT_ACTIVITY_CATEGORY_CONFIG } = require('../arrangeConfig');
const { buildBookingLinks } = require('../services/bookingLinks');
const { buildAssignPrompt, STATIC_ARRANGE_SYSTEM } = require('../services/arrangePromptDirect');
const { schedule } = require('../services/arrangeScheduler');
const { buildCityTravelTiming } = require('../services/distanceMatrix');
const arrangeTelemetry = require('../services/arrangeTelemetry');
const { extractText, tryParseJsonObject } = require('../services/llmJson');
const { enrichWithPlaceDetails, formatOpeningHoursFromPlaces, PRICE_LEVEL_MAP } = require('../services/placesEnrich');
const { debugLog } = require('../services/debugLog');

const ACTIVITY_REFINE_MODEL = 'gpt-5.4-mini';
// Generating a stay as parallel N-day windows instead of one serial call is
// roughly a 3x speed win, but it changes the activity mix, so it ships off and
// is enabled per environment once the bake-off has compared the two.
const PLAN_SPLIT_DAYS = Number(process.env.PLAN_SPLIT_DAYS) || null;
const ARRANGE_MODEL = 'claude-sonnet-4-6';
const PLAN_HEARTBEAT_MS = 15000;

const ASSIGN_TOOL = {
  name: 'assign_days',
  description: 'Assign each activity to a day. Output a map of date to the activity ids on that day. Do NOT output times or within-day order — code computes those.',
  input_schema: {
    type: 'object',
    properties: {
      assignment: {
        type: 'object',
        description: 'Map of YYYY-MM-DD date to an array of activity ids assigned to that day. Every activity id appears under exactly one day.',
        additionalProperties: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    required: ['assignment']
  }
};

const BREAKS_LABELS = ['back-to-back days', 'short breaks between activities', 'moderate breaks between activities', 'generous breaks between activities', 'lots of downtime between activities'];

function buildArrangeFeedback(sp) {
  if (!sp || typeof sp !== 'object') return [];
  const fb = [];
  const note = String(sp.notes || '').trim();
  if (note) fb.push(note);
  if (sp.tourTiming) fb.push(`Prefers ${sp.tourTiming} tours`);
  if (sp.dayStartTime && sp.dayEndTime) fb.push(`Prefers each day to run roughly ${sp.dayStartTime}–${sp.dayEndTime}`);
  if (sp.lunchTime) fb.push(`Prefers lunch around ${sp.lunchTime}`);
  if (sp.dinnerTime) fb.push(`Prefers dinner around ${sp.dinnerTime}`);
  const b = Number(sp.breaksBetween);
  if (Number.isFinite(b) && b >= 1 && b <= 5) fb.push(`Prefers ${BREAKS_LABELS[Math.round(b) - 1]}`);
  return fb;
}

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

const PLACES_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location,places.priceLevel,places.rating,places.userRatingCount,places.regularOpeningHours';

async function searchPlaceText(input) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { error: 'maps_disabled' };
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACES_FIELD_MASK
      },
      body: JSON.stringify({ textQuery: input })
    });
    if (!r.ok) {
      const errText = await r.text();
      debugLog('places-resolve', `searchText http=${r.status} input="${input}" body=${errText.slice(0, 300)}`);
      return { error: 'lookup_failed' };
    }
    const data = await r.json();
    const place = Array.isArray(data.places) ? data.places[0] : null;
    debugLog('places-resolve', `searchText places=${(data.places || []).length} input="${input}"`);
    if (!place) return { placeId: null };
    return {
      placeId: place.id || null,
      lat: typeof place.location?.latitude === 'number' ? place.location.latitude : null,
      lng: typeof place.location?.longitude === 'number' ? place.location.longitude : null,
      name: place.displayName?.text || null,
      formattedAddress: place.formattedAddress || null,
      priceLevel: place.priceLevel in PRICE_LEVEL_MAP ? PRICE_LEVEL_MAP[place.priceLevel] : null,
      rating: typeof place.rating === 'number' ? place.rating : null,
      userRatingsTotal: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
      openingHours: formatOpeningHoursFromPlaces(place.regularOpeningHours)
    };
  } catch (err) {
    debugLog('places-resolve', `exception input="${input}" error=${err.message}`);
    return { error: 'lookup_failed' };
  }
}

function groundActivityToPlace(activity, place, { cost = null, costType = 'per_person' } = {}) {
  const resolvedCostType = costType === 'per_group' ? 'per_group' : 'per_person';
  if (place) {
    activity.name = place.name || activity.name;
    activity.venue_name = place.name || activity.venue_name || activity.name;
    activity.place_id = place.placeId || null;
    activity.location = {
      name: activity.venue_name,
      address: place.formattedAddress || activity.location?.address || '',
      lat: Number.isFinite(place.lat) ? place.lat : null,
      lng: Number.isFinite(place.lng) ? place.lng : null
    };
    if (place.openingHours) {
      activity.opening_hours = place.openingHours;
      if (activity.timing) activity.timing.opening_hours = place.openingHours;
    }
    if (place.priceLevel != null) activity.price_level = place.priceLevel;
  }
  if (cost != null) {
    if (activity.cost && typeof activity.cost === 'object') {
      activity.cost.estimated_usd = cost;
      activity.cost.type = resolvedCostType;
    } else {
      activity.estimated_cost_usd = cost;
      activity.cost_type = resolvedCostType;
    }
  }
  return activity;
}

// LLM refinements may emit cost in either shape; fold it into the shape the
// activity actually carries so actCostUsd() sees the new value after merge.
function applyCostShapeToUpdates(activity, updates) {
  const activityIsNested = activity.cost && typeof activity.cost === 'object';
  const updateNested = updates.cost && typeof updates.cost === 'object' ? Number(updates.cost.estimated_usd) : NaN;
  const updateFlat = Number(updates.estimated_cost_usd);

  if (activityIsNested && Number.isFinite(updateFlat)) {
    updates.cost = {
      ...activity.cost,
      ...(updates.cost || {}),
      estimated_usd: updateFlat,
      type: updates.cost_type || updates.cost?.type || activity.cost.type
    };
    delete updates.estimated_cost_usd;
    delete updates.cost_type;
  } else if (!activityIsNested && Number.isFinite(updateNested)) {
    updates.estimated_cost_usd = updateNested;
    updates.cost_type = updates.cost.type || updates.cost_type || activity.cost_type || 'per_person';
    delete updates.cost;
  }
  return updates;
}

function register(app) {
  app.get('/api/places/resolve', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const q = String(req.query.q || '').trim();
    const city = String(req.query.city || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q parameter' });

    const cacheKey = `${q.toLowerCase()}|${city.toLowerCase()}`;
    const cached = placesCacheGet(cacheKey);
    if (cached) return res.json(cached);

    const response = await searchPlaceText(city ? `${q}, ${city}` : q);
    if (!response.error) placesCacheSet(cacheKey, response);
    return res.json(response);
  });

  app.post('/api/activity/add', async (req, res) => {
    const addStartTs = Date.now();
    const { name, city, why = '', cost = null, costType = 'per_person', tripId = null } = req.body || {};
    debugLog('activity-add', `INBOUND name="${name || ''}" city="${city || ''}" why_chars=${(why || '').length}`);
    if (!name || !city) return res.status(400).json({ error: 'name and city are required' });

    const cacheKey = `${String(name).toLowerCase()}|${String(city).toLowerCase()}`;
    let place = placesCacheGet(cacheKey);
    if (!place) {
      place = await searchPlaceText(`${name}, ${city}`);
      if (!place.error) placesCacheSet(cacheKey, place);
    }
    const grounded = !place.error && !!place.placeId;
    if (!place.error && !place.placeId) {
      debugLog('activity-add', `REJECT name="${name}" city="${city}" reason=place_not_found`);
      return res.status(404).json({ error: 'place_not_found' });
    }

    const canonicalName = grounded ? (place.name || name) : String(name).trim();
    let activity = null;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const resolvedUserId = parseUserId(getAuthedUserId(req));
        const prefSummary = recall({ userId: resolvedUserId, tripId, query: `${canonicalName} ${why || ''}` }).text;
        const systemPrompt = prefSummary ? `${ACTIVITY_SYSTEM_PROMPT}\n\n${prefSummary}` : ACTIVITY_SYSTEM_PROMPT;
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const addressClause = grounded && place.formattedAddress ? ` (${place.formattedAddress})` : '';
        const verifiedClause = grounded ? ' This is a verified real venue — do NOT rename or substitute it.' : '';
        const noteClause = why ? `\nTraveler's note: "${why}"` : '';
        const userContent = `The traveler manually added "${canonicalName}"${addressClause} in ${city} to their itinerary.${verifiedClause} The "name" field must be exactly "${canonicalName}".${noteClause}
Fill in the descriptive fields for this venue: type, why_it_fits, pitfall, booking_advice, insider_tips, duration_hours, suggested_time, opening_hours, booking_type, estimated_cost_usd.

Return ONLY valid JSON (no markdown fences): a single activity object matching the standard activity schema.`;

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }]
        });
        const parsed = tryParseJsonObject(extractText(response.content));
        const rawActivity = parsed?.activity && typeof parsed.activity === 'object' ? parsed.activity : parsed;
        if (rawActivity && typeof rawActivity === 'object') {
          rawActivity.name = canonicalName;
          activity = normalizeActivity(rawActivity, city);
        }
      } catch (error) {
        debugLog('activity-add', `LLM_FAIL name="${canonicalName}" msg="${error?.message || error}"`);
      }
    }

    if (!activity) {
      activity = normalizeActivity({
        name: canonicalName,
        city,
        type: 'tour',
        why_it_fits: why,
        estimated_cost_usd: cost,
        cost_type: costType
      }, city);
    }
    groundActivityToPlace(activity, grounded ? place : null, { cost, costType });
    if (!grounded) await enrichWithPlaceDetails([activity], city);

    const bookingType = activity.booking?.type ?? activity.booking_type;
    const links = buildBookingLinks({ bookingType, name: activity.venue_name || activity.name, city });
    if (links.length) {
      if (activity.booking) activity.booking.links = links;
      else activity.booking_links = links;
    }

    debugLog('activity-add', `DONE name="${activity.name}" grounded=${grounded} elapsed_ms=${Date.now() - addStartTs}`);
    return res.json({ activity });
  });

  app.post('/api/activity/refine', async (req, res) => {
    const refineStartTs = Date.now();
    if (!process.env.OPENAI_API_KEY) {
      debugLog('activity-refine', `REJECT reason=openai_key_missing`);
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    const { activity, note, budget_target, tripId = null } = req.body || {};
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
      const memText = recall({ userId: parseUserId(getAuthedUserId(req)), tripId, query: `${activity.name} ${note}` }).text;
      const memBlock = memText ? `\n\nTraveler profile & learned preferences (honor these in the refinement):\n${memText}` : '';

      const userContent = `You are refining an existing travel activity. The traveler wants a tweak, not a replacement.

Current activity: ${JSON.stringify(activity)}
Traveler's note: "${note}"${braveBlock}${budgetClause}${memBlock}

Return ONLY a JSON object containing the fields that should change. Preserve all field names from the current activity. If the traveler names a specific place, the "name" field must include it verbatim.`;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: ACTIVITY_REFINE_MODEL,
        max_completion_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: userContent }]
      });

      const updates = JSON.parse(response.choices?.[0]?.message?.content?.trim() || '{}');
      applyCostShapeToUpdates(activity, updates);

      const updatedName = updates.name || activity.name;
      const updatedCity = updates.city || activity.city;

      if (updates.name && updates.name !== activity.name && process.env.GOOGLE_MAPS_API_KEY) {
        const merged = { ...activity, ...updates, city: updatedCity };
        merged.location = { ...(activity.location || {}), lat: null, lng: null };
        // Clear the old venue's price level so a post-enrich value is known to come
        // from Places for the NEW venue, not inherited from the one being replaced.
        delete merged.price_level;
        if (activity.timing) merged.timing = { ...activity.timing, ...(updates.timing || {}) };
        await enrichWithPlaceDetails([merged], updatedCity);
        if (Number.isFinite(Number(merged.location?.lat)) && Number.isFinite(Number(merged.location?.lng))) {
          updates.location = merged.location;
          if (merged.opening_hours) updates.opening_hours = merged.opening_hours;
          if (merged.timing) updates.timing = merged.timing;
        }
        if (Number.isInteger(merged.price_level)) updates.price_level = merged.price_level;
        else if (updates.price_level == null && activity.price_level != null) updates.price_level = null;
      }

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

    const { activity, reason, notes, tripId = null } = req.body || {};
    debugLog('activity-replace', `INBOUND name="${activity?.name || ''}" city="${activity?.city || ''}" type="${activity?.type || ''}" reason_chars=${(reason || '').length}`);
    if (!activity?.name || !activity?.city) {
      debugLog('activity-replace', `REJECT reason=missing_name_or_city`);
      return res.status(400).json({ error: 'activity.name and activity.city are required' });
    }

    const resolvedUserId = parseUserId(getAuthedUserId(req));
    const prefSummary = recall({ userId: resolvedUserId, tripId, query: `${activity.name} ${reason || ''}` }).text;
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

      let normalized = normalizeActivity(parsed.activity, activity.city);
      await enrichWithPlaceDetails([normalized], activity.city);

      const coordsOk = (a) => Number.isFinite(Number(a?.location?.lat)) && Number.isFinite(Number(a?.location?.lng));
      let unverified = false;
      if (!coordsOk(normalized) && process.env.GOOGLE_MAPS_API_KEY) {
        debugLog('activity-replace', `RETRY name="${normalized?.name || ''}" reason=venue_not_found_on_maps`);
        const retryResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userContent },
            { role: 'assistant', content: raw },
            { role: 'user', content: `Your suggestion "${normalized.name}" could not be found on Google Maps — it likely does not exist under that name. Suggest a different, verifiable venue in ${activity.city} that satisfies the same request. Prefer venues from the web research list above. Same JSON format.` }
          ]
        });
        const retryParsed = tryParseJsonObject(extractText(retryResponse.content));
        if (retryParsed?.activity && typeof retryParsed.activity === 'object') {
          const retryNormalized = normalizeActivity(retryParsed.activity, activity.city);
          await enrichWithPlaceDetails([retryNormalized], activity.city);
          if (coordsOk(retryNormalized)) normalized = retryNormalized;
          else unverified = true;
        } else {
          unverified = true;
        }
      }

      const declineSignals = [
        ...(Array.isArray(parsed.preferences) ? parsed.preferences : []),
        ...(Array.isArray(parsed.constraints) ? parsed.constraints : [])
      ];
      // Detached: reconciliation must not delay the replacement response.
      observe({ userId: resolvedUserId, tripId, source: 'decline', candidates: declineSignals });

      debugLog('activity-replace', `DONE name="${normalized?.name || ''}" has_coords=${coordsOk(normalized)} unverified=${unverified} elapsed_ms=${Date.now() - replaceStartTs}`);
      return res.json(unverified ? { activity: normalized, unverified: true } : { activity: normalized });
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

    const { days, activities, lockedActivities, commuteMatrix, profile, numTravelers, numChildren, schedulingPrefs, tripId = null } = req.body || {};
    debugLog('arrange', `INBOUND activities=${Array.isArray(activities) ? activities.length : 'N/A'} locked=${Array.isArray(lockedActivities) ? lockedActivities.length : 0} days=${Array.isArray(days) ? days.length : 'N/A'} city="${Array.isArray(days) ? (days[0]?.city || '') : ''}"`);
    if (!Array.isArray(days) || !Array.isArray(activities)) {
      return res.status(400).json({ error: 'days and activities are required arrays' });
    }
    const resolvedLocked = Array.isArray(lockedActivities) ? lockedActivities : [];
    const lockedIdSet = new Set(resolvedLocked.map((l) => String(l.id)));
    const flexible = activities.filter((a) => !lockedIdSet.has(String(a.id)));

    if (flexible.length === 0) {
      return res.json({ placements: {}, unplaced: [], diagnostics: [], mealRedistributed: 0 });
    }

    const userId = parseUserId(getAuthedUserId(req));
    const prefSummary = recall({ userId, tripId, query: days[0]?.city || '' }).text;
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

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const ARRANGE_SYSTEM = [{ type: 'text', text: STATIC_ARRANGE_SYSTEM, cache_control: { type: 'ephemeral' } }];

    // The LLM only assigns activities to days (no times, no order). Code schedules.
    async function assignDays(prompt) {
      debugLog('arrange', `ASSIGN_CALL model=${ARRANGE_MODEL} prompt_chars=${prompt.length}`);
      const response = await anthropic.messages.create({
        model: ARRANGE_MODEL,
        max_tokens: 8192,
        system: ARRANGE_SYSTEM,
        tools: [ASSIGN_TOOL],
        tool_choice: { type: 'tool', name: 'assign_days' },
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }] }]
      });
      const toolUse = (response.content || []).find((c) => c.type === 'tool_use' && c.name === 'assign_days');
      const u = response.usage || {};
      debugLog('arrange', `LLM_RESPONSE finish=${response.stop_reason} tool_use=${!!toolUse} cache_write=${u.cache_creation_input_tokens || 0} cache_read=${u.cache_read_input_tokens || 0}`);
      if (!toolUse || !toolUse.input || typeof toolUse.input !== 'object') {
        const rawText = extractText(response.content).slice(0, 800);
        const err = new Error('Failed to parse day assignment');
        err.diagnostic = { stop_reason: response.stop_reason, tool_use: false, head: rawText };
        throw err;
      }
      return toolUse.input;
    }

    // Build a clean { date: [ids] } map: keep known, non-locked ids on valid dates, then
    // ensure every flexible activity is assigned somewhere (append any the LLM omitted to
    // the least-loaded day) so the deterministic scheduler — not the LLM — owns feasibility.
    function sanitizeAssignment(parsed) {
      const validDates = new Set(days.map((d) => d.date));
      const assignment = {};
      for (const d of days) assignment[d.date] = [];
      const seen = new Set();
      const rawAssignment = parsed?.assignment && typeof parsed.assignment === 'object' ? parsed.assignment : {};
      for (const [date, ids] of Object.entries(rawAssignment)) {
        if (!validDates.has(date) || !Array.isArray(ids)) continue;
        for (const rawId of ids) {
          const id = String(rawId);
          if (lockedIdSet.has(id) || !activitiesById[id] || seen.has(id)) continue;
          seen.add(id);
          assignment[date].push(id);
        }
      }
      const leastLoadedDate = () => Object.keys(assignment).sort((a, b) => assignment[a].length - assignment[b].length)[0];
      for (const a of flexible) {
        const id = String(a.id);
        if (!seen.has(id)) {
          const target = leastLoadedDate() || days[0].date;
          assignment[target].push(id);
          seen.add(id);
          debugLog('arrange', `ASSIGN_BACKFILL id=${id} -> ${target} (LLM omitted)`);
        }
      }
      return assignment;
    }

    try {
      const prompt = buildAssignPrompt({
        days,
        flexible,
        locked: resolvedLocked,
        profile,
        prefSummary,
        numTravelers,
        numChildren,
        cityName,
        schedulingPrefs
      });
      const parsed = await assignDays(prompt);
      const assignment = sanitizeAssignment(parsed);

      const result = schedule({ assignment, days, activitiesById, lockedActivities: resolvedLocked, commuteMatrix: matrix });
      const droppedByReason = {};
      for (const u of result.unplaced) droppedByReason[u.reason] = (droppedByReason[u.reason] || 0) + 1;
      debugLog('arrange', `RETURN placed=${Object.keys(result.placements).length} unplaced=${result.unplaced.length} redistributed=${result.mealRedistributed} diagnostics=${result.diagnostics.length}`);

      arrangeTelemetry.logRun({
        userId,
        cityName,
        flexibleCount: flexible.length,
        lockedCount: resolvedLocked.length,
        placedCount: Object.keys(result.placements).length,
        unplacedCount: result.unplaced.length,
        mealRedistributed: result.mealRedistributed,
        droppedByReason,
        diagnosticsCount: result.diagnostics.length
      });

      // Arrange feedback → memory. Gated on a deliberate free-text note so we
      // don't fire a reconciliation call on every draft click; structured prefs
      // ride along as context to that one call. Detached.
      const schedNote = String(schedulingPrefs?.notes || '').trim();
      if (schedNote) {
        observe({ userId, tripId, source: 'arrange', candidates: buildArrangeFeedback(schedulingPrefs) });
      }

      return res.json(result);
    } catch (error) {
      debugLog('arrange', `ERROR msg="${error?.message || error}" diag=${JSON.stringify(error?.diagnostic || null)}`);
      arrangeTelemetry.logRun({
        userId,
        cityName,
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

  app.post('/api/plan', async (req, res) => {
    const planStartTs = Date.now();
    const { cities, travels, profile, budget, numTravelers, numChildren, lockedActivities, tripId = null } = req.body || {};
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

    // Nothing crosses the wire between the headers and the first finished city —
    // minutes, for a dense multi-city trip. The comment frames keep intermediaries
    // from idling the connection out and let the client tell "slow" from "dead".
    const heartbeat = setInterval(() => res.write(': ping\n\n'), PLAN_HEARTBEAT_MS);
    req.on('close', () => clearInterval(heartbeat));

    const failures = [];

    try {
      const tripTravels = Array.isArray(travels) ? travels.slice(0, 1) : [];
      const cityTravelTiming = await buildCityTravelTiming(cities);

      const planAndEnrich = async (city) => {
        const timing = cityTravelTiming[String(city?.name || '').trim()] || null;
        const cityLocked = Array.isArray(resolvedLockedActivities[city.name])
          ? resolvedLockedActivities[city.name]
          : [];
        sendEvent({ type: 'city_start', city: city.name });
        await acquireLlmSlot();
        try {
          const activities = await planCity(city, profile, resolvedUserId, tripTravels, timing, resolvedBudget, cities.length, resolvedTravelers, resolvedChildren, cityLocked, tripId || null, {
            onPhase: (phase) => sendEvent({ type: 'phase', city: city.name, phase }),
            splitDays: PLAN_SPLIT_DAYS
          });
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
        } catch (planErr) {
          // One bad city must not discard the cities that succeeded, and it must
          // not end the stream while its siblings are still writing to it.
          debugLog('plan', `CITY_FAILED city=${city.name} err=${planErr?.message || planErr}`);
          failures.push(planErr);
          sendEvent({
            type: 'city_error',
            city: city.name,
            error: planErr?.message || 'Failed to plan this city',
            code: planErr?.code || null
          });
        } finally {
          releaseLlmSlot();
        }
      };

      const CONCURRENCY = 3;
      for (let i = 0; i < cities.length; i += CONCURRENCY) {
        await Promise.all(cities.slice(i, i + CONCURRENCY).map(planAndEnrich));
      }

      if (failures.length === cities.length) throw failures[0];

      sendEvent({ type: 'done' });
      debugLog('plan', `DONE cities=${cities.length} failed=${failures.length} elapsed_ms=${Date.now() - planStartTs}`);
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
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });
}

module.exports = { register, groundActivityToPlace, applyCostShapeToUpdates };
