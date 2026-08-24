const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

const { getAuthedUserId, parseUserId } = require('../middleware/auth');
const { acquire: acquireLlmSlot, release: releaseLlmSlot } = require('../middleware/llmSemaphore');
const {
  planCity,
  normalizeActivity,
  dedupeActivities,
  SYSTEM_PROMPT: ACTIVITY_SYSTEM_PROMPT
} = require('../claude');
const { recall, observe } = require('../memory');
const { readBasis, withoutModelBasis, PER_GROUP } = require('../../shared/cost');
const { search, isConfigured: isBraveConfigured, shouldUseBrave } = require('../braveSearch');
const { DEFAULT_ACTIVITY_CATEGORY_CONFIG } = require('../arrangeConfig');
const { buildBookingLinks } = require('../services/bookingLinks');
const { buildAssignPrompt, STATIC_ARRANGE_SYSTEM } = require('../services/arrangePromptDirect');
const { schedule } = require('../services/arrangeScheduler');
const { buildCityTravelTiming } = require('../services/distanceMatrix');
const arrangeTelemetry = require('../services/arrangeTelemetry');
const { extractText, tryParseJsonObject } = require('../services/llmJson');
const { enrichWithPlaceDetails, hasCoords, formatOpeningHoursFromPlaces, PRICE_LEVEL_MAP } = require('../services/placesEnrich');
const { debugLog } = require('../services/debugLog');

const ACTIVITY_REFINE_MODEL = 'gpt-5.4-mini';
// A refine batch is one city's worth of suggestions, so the output budget scales
// with the batch and is capped rather than fixed at a single activity's size. The
// allowance is generous because the prompt requires eleven fields per suggestion,
// four of them prose, and the budget covers reasoning as well as output — a hard
// truncation now costs a whole city's refinements rather than one activity's.
const REFINE_BASE_TOKENS = 600;
const REFINE_TOKENS_PER_ACTIVITY = 400;
const REFINE_MAX_TOKENS = 8000;
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
  const resolvedCostType = readBasis({ cost_type: costType });
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

// Any route that stamps a basis onto a model's price has to tell the model which
// basis to price in first. Stamping alone relabels the number instead of
// describing it — a per-traveler figure marked as a whole-party total.
function pricingClauseFor(pricedLike) {
  return readBasis(pricedLike) === PER_GROUP
    ? '\nPrice estimated_cost_usd as ONE total for the whole party — not per traveler.'
    : '\nPrice estimated_cost_usd per traveler.';
}

// Model output priced in the basis the prompt asked for, labelled to match. The
// model's own basis goes, and `timing` with it: normalizeActivity short-circuits
// on an object that carries `timing`, so a reply volunteering one would skip
// normalization entirely and travel on without the shape the rest of the
// pipeline reads.
function withBasis(suggestion, pricedLike) {
  const { timing, ...raw } = withoutModelBasis(suggestion);
  return { ...raw, cost_type: readBasis(pricedLike) };
}

function activityCostUsd(activity) {
  const nested = Number(activity?.cost?.estimated_usd);
  if (Number.isFinite(nested)) return nested;
  const flat = Number(activity?.estimated_cost_usd);
  return Number.isFinite(flat) ? flat : null;
}

// Wording follows planCity's locked-activity block: naming only venues is not
// enough, because an unstructured activity has no venue to compare. "Explore Dali
// Old Town's Ancient Streets" and "Slow Circuit through Dali Ancient City" share no
// word and no venue_name, so nothing deterministic can tell them apart — only the
// model can, and only if it is told the experience itself is taken.
const VENUE_ROSTER_HEADING = "Already in this traveler's trip — do not repeat any of these, and do not suggest the same place or neighborhood under a different name, or the same experience relabelled:";

// Same shape as the locked-activity block planCity sends (src/claude.js): the
// model is told which venues are taken, and dedupeActivities enforces it after.
function buildVenueRosterBlock(roster) {
  const rows = (Array.isArray(roster) ? roster : [])
    .map((a) => {
      const name = String(a?.name || '').trim();
      if (!name) return '';
      const venue = String(a?.venue_name || '').trim();
      const type = String(a?.type || '').trim();
      return `- "${name}"${venue ? ` | venue: ${venue}` : ''}${type ? ` | type: ${type}` : ''}`;
    })
    .filter(Boolean);
  return rows.length ? `\n\n${VENUE_ROSTER_HEADING}\n${rows.join('\n')}` : '';
}

// The suggestion alone becomes the replacement activity. It is never merged with
// the activity being replaced: a merge makes the replaced venue's value the default
// for every field the model omits, which is how its address, hours, duration,
// booking reference and prose each followed the swap in turn.
//
// `timing` is stripped because normalizeActivity returns an already-normalized input
// untouched (isLegacyActivity is `timing === undefined`), and a model that emits a
// timing object would otherwise pass straight through unnormalized — leaving no
// `booking` for applyBookingLinks and failing the whole city's batch.
function buildRefinedActivity(activity, suggestion, city) {
  const { id, ...rest } = suggestion || {};
  if (!rest.name) return null;
  // withBasis stamps the basis the prompt asked this suggestion to be priced in,
  // which normalizeActivity then reads — no post-hoc repair.
  const refined = normalizeActivity({ ...withBasis(rest, activity), city }, city);
  // The swap keeps the itinerary slot: arrange placements, checklist entries and
  // calendar fingerprints all key on this id.
  refined.id = activity.id;
  // Not part of normalizeActivity's shape, so this route owns clearing them. Cleared
  // before grounding, so any value they carry afterwards came from a Places lookup
  // keyed on the new venue.
  refined.place_id = null;
  refined.imageUrl = null;
  refined.price_level = null;
  return refined;
}

// normalizeActivity always returns the nested shape, so there is one booking shape
// to handle here. reference is already null on it — the replaced venue's booking
// cannot follow the swap.
function applyBookingLinks(activity, city, date = '') {
  const bookingType = activity.booking?.type || 'none';
  activity.booking.links = bookingType === 'none'
    ? []
    : buildBookingLinks({ bookingType, name: activity.venue_name || activity.name, city, date });
  return activity;
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
    // What the traveler chose in the form, in the shape readBasis reads.
    const pricedLike = { cost_type: costType };

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
        const userContent = `The traveler manually added "${canonicalName}"${addressClause} in ${city} to their itinerary.${verifiedClause} The "name" field must be exactly "${canonicalName}".${noteClause}${pricingClauseFor(pricedLike)}
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
          // The traveler picked the basis in the form; the model is never asked
          // for one. Without this their choice survives only when they also typed
          // a price, because groundActivityToPlace re-applies it on cost — and a
          // nested cost the model volunteered would outrank the flat field.
          activity = normalizeActivity(withBasis(rawActivity, pricedLike), city);
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

  // One call per city, not per activity: a suggestion can only duplicate a venue
  // in the same city, so the city is the smallest batch that lets the model see
  // every venue it must avoid. It also isolates a failure to one city, and cuts
  // one Brave search and one recall() per activity down to one per city.
  app.post('/api/activity/refine', async (req, res) => {
    const refineStartTs = Date.now();
    if (!process.env.OPENAI_API_KEY) {
      debugLog('activity-refine', `REJECT reason=openai_key_missing`);
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    // Per activity, not one figure for the batch: a city mixes price tiers and
    // per_group with per_person costs, so a single ceiling either fails to bind on
    // the cheap half or is several times too tight on the expensive half.
    const { city, activities, note, budget_targets = {}, exclude = [], tripId = null } = req.body || {};
    const targets = (Array.isArray(activities) ? activities : []).filter((a) => a?.id && a?.name);
    debugLog('activity-refine', `INBOUND city="${city || ''}" activities=${targets.length} exclude=${Array.isArray(exclude) ? exclude.length : 0} note_chars=${(note || '').length}`);
    if (!city || !targets.length || !note) {
      debugLog('activity-refine', `REJECT reason=missing_city_activities_or_note`);
      return res.status(400).json({ error: 'city, activities and note are required' });
    }

    // The activities being refined are themselves on the roster: a suggestion that
    // lands back on the venue it was replacing is the duplicate users were seeing.
    const roster = [...targets, ...(Array.isArray(exclude) ? exclude : [])];

    try {
      // Built from the city and the types in play, never from the venues being
      // replaced — searching those returned articles about the very venue the
      // suggestion had to move away from, which is what anchored it there.
      const types = [...new Set(targets.map((a) => String(a.type || '').trim().toLowerCase()).filter(Boolean))].slice(0, 4);
      const targetById = new Map(targets.map((a) => {
        const target = Number(budget_targets?.[a.id]);
        return [a.id, Number.isFinite(target) && target > 0 ? target : null];
      }));
      const anyBudgetTarget = [...targetById.values()].some((t) => t != null);
      const researchQuery = `${anyBudgetTarget ? 'best value affordable' : 'best'} ${types.join(' ')} in ${city}`.replace(/\s{2,}/g, ' ');
      const braveResults = isBraveConfigured()
        ? await search(researchQuery, { task: 'entity_enrichment', count: 5 })
        : [];
      const braveBlock = braveResults.length
        ? `\n\nWeb research (use to anchor each suggestion in a real venue — do not invent place names):\n${braveResults.map((r) => `- ${r.title}: ${r.description}`).join('\n')}`
        : '';
      // Deliberately does not offer "downscale the same venue": a suggestion that
      // keeps the original venue collides with it on the roster and is dropped, and
      // prompting for something the pipeline then silently discards is exactly what
      // this codebase forbids.
      // Scoped to the activities that carry a target: a blanket rule with one
      // visible number is how a suggestion ends up borrowing a neighbour's ceiling.
      // Guidance, not a limit. Stated as a hard cap, an unreachable target makes
      // the model either invent an implausibly cheap venue or return nothing for
      // that activity — both of which the traveler sees as the step failing.
      const budgetClause = anyBudgetTarget
        ? `\n\nWhere an activity below shows a "target", aim to bring that suggestion's estimated_cost_usd to or below it, in that activity's stated pricing basis. The target is what the traveler is aiming for, not a limit you must satisfy: if no venue worth recommending exists at that price, suggest the best one you can that still costs less than the activity's current cost, and price it honestly. Never invent an unrealistically low cost to meet a target. Choose a cheaper venue of the same activity type in ${city} — a different venue, never the same one at a lower price.`
        : '';
      const memText = recall({ userId: parseUserId(getAuthedUserId(req)), tripId, query: `${city} ${note}` }).text;
      const memBlock = memText ? `\n\nTraveler profile & learned preferences (honor these in every suggestion):\n${memText}` : '';

      const activityLines = targets.map((a) => {
        const cost = activityCostUsd(a);
        const target = targetById.get(a.id);
        // Unconditional, because the stamp is: buildRefinedActivity labels every
        // suggestion with this activity's basis whether or not a figure is shown.
        // The Rules turn this label into an instruction — on its own it reads as a
        // description of the activity being replaced, not as how to price the reply.
        const pricedAs = readBasis(a) === PER_GROUP ? 'per group' : 'per person';
        return `- id: ${a.id} | ${a.name}${a.venue_name ? ` | venue: ${a.venue_name}` : ''}${a.type ? ` | type: ${a.type}` : ''}${cost != null ? ` | current cost: $${cost}` : ''}${target != null ? ` | target: at or below $${target}` : ''} | priced: ${pricedAs}`;
      }).join('\n');

      const userContent = `You are swapping ${targets.length} activit${targets.length === 1 ? 'y' : 'ies'} in a traveler's ${city} itinerary for different venues.

Activities to swap:
${activityLines}

Traveler's request: "${note}"${budgetClause}${buildVenueRosterBlock(roster)}${braveBlock}${memBlock}

Rules:
- Price each suggestion's estimated_cost_usd in the basis shown on its line: "priced: per person" means per traveler, "priced: per group" means ONE total for the whole party.
- Every suggestion must be a DIFFERENT real venue in ${city} from the activity it replaces.
- No two suggestions may name the same venue, and none may match a venue listed above.
- "venue_name" is required on every suggestion: the place exactly as it appears on Google Maps.
- If the traveler's request names a specific place, that suggestion's "name" must include it verbatim.
- These fields describe the venue, so every suggestion must carry all of them, written for the NEW venue: name, venue_name, type, why_it_fits, pitfall, booking_advice, insider_tips, duration_hours, suggested_time, opening_hours, estimated_cost_usd. Never leave one out to mean "unchanged" — nothing about the replaced venue's description carries over.

Return ONLY a JSON object: {"suggestions":[{"id":"<an id listed above>", ...changed fields...}]}`;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      await acquireLlmSlot();
      let response;
      try {
        response = await openai.chat.completions.create({
          model: ACTIVITY_REFINE_MODEL,
          max_completion_tokens: Math.min(REFINE_MAX_TOKENS, REFINE_BASE_TOKENS + targets.length * REFINE_TOKENS_PER_ACTIVITY),
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: userContent }]
        });
      } finally {
        releaseLlmSlot();
      }

      const parsed = tryParseJsonObject(response.choices?.[0]?.message?.content || '');
      if (!Array.isArray(parsed?.suggestions)) {
        debugLog('activity-refine', `PARSE_FAIL city="${city}" elapsed_ms=${Date.now() - refineStartTs}`);
        return res.status(500).json({ error: 'Failed to parse refinement JSON' });
      }

      // Normalize before deduping, so both sides of the comparison use one naming
      // convention. Keying on the model's raw labels let "Dinner at Casa Lucio" past
      // a roster holding "Casa Lucio" — and stripMealPrefix then shipped it as
      // exactly "Casa Lucio", the venue it was replacing.
      const byId = new Map(targets.map((a) => [String(a.id), a]));
      const candidates = [];
      for (const suggestion of parsed.suggestions) {
        const activity = byId.get(String(suggestion?.id || ''));
        if (!activity) continue;
        const refined = buildRefinedActivity(activity, suggestion, city);
        if (refined) candidates.push({ activity, refined });
      }

      // Accepted one at a time, roster first, so a suggestion colliding with a venue
      // the trip already has is the one dropped rather than the venue itself. Testing
      // each candidate against only what has been accepted means a candidate that is
      // never used — a second suggestion for an id already filled — cannot consume a
      // venue that another activity's suggestion needed. Runs ahead of grounding:
      // enrichment does not touch the names this keys on, so it cannot improve the
      // comparison, and a dropped candidate would otherwise cost a billed lookup.
      //
      // First *surviving* suggestion per id wins. Claiming the id before the roster
      // check would let a dropped suggestion block a valid second one for it.
      const activitiesById = {};
      const survivors = [];
      const accepted = [];
      for (const { activity, refined } of candidates) {
        if (activitiesById[activity.id]) continue;
        if (!dedupeActivities([...roster, ...accepted, refined], city).includes(refined)) continue;
        accepted.push(refined);
        activitiesById[activity.id] = refined;
        survivors.push({ refined, date: activity.scheduled_date || '' });
      }

      if (survivors.length && process.env.GOOGLE_MAPS_API_KEY) {
        await enrichWithPlaceDetails(survivors.map((s) => s.refined), city);
      }
      survivors.forEach(({ refined, date }) => applyBookingLinks(refined, city, date));

      debugLog('activity-refine', `DONE city="${city}" requested=${targets.length} suggested=${candidates.length} kept=${survivors.length} elapsed_ms=${Date.now() - refineStartTs}`);
      return res.json({ activities: activitiesById });
    } catch (error) {
      debugLog('activity-refine', `ERROR city="${city}" msg="${error?.message || error}" elapsed_ms=${Date.now() - refineStartTs}`);
      return res.status(500).json({ error: error.message || 'Failed to refine activities' });
    }
  });

  app.post('/api/activity/replace', async (req, res) => {
    const replaceStartTs = Date.now();
    if (!process.env.ANTHROPIC_API_KEY) {
      debugLog('activity-replace', `REJECT reason=anthropic_key_missing`);
      return res.status(503).json({ error: 'Anthropic API key not configured' });
    }

    const { activity, reason, notes, exclude = [], tripId = null } = req.body || {};
    debugLog('activity-replace', `INBOUND name="${activity?.name || ''}" city="${activity?.city || ''}" type="${activity?.type || ''}" exclude=${Array.isArray(exclude) ? exclude.length : 0} reason_chars=${(reason || '').length}`);
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

    await acquireLlmSlot();
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const contextClause = reasonText ? `\nReason for declining: "${reasonText}"` : '';
      const notesClause = notesText ? `\nAdditional saved notes: "${notesText}"` : '';
      const mealReminderClause = isMeal
        ? '\nThis is a meal activity — name a specific restaurant and include 1–2 must-order dishes in why_it_fits.'
        : '';
      // Without this the model has no way to know which basis it is pricing in,
      // and the reply inherits the declined activity's basis blind — relabelling
      // a per-traveler number as a whole-party one, or the reverse.
      const pricingClause = pricingClauseFor(activity);
      // The declined activity rides on the roster too, so one block states every
      // thing the replacement may not be.
      const rosterBlock = buildVenueRosterBlock([activity, ...(Array.isArray(exclude) ? exclude : [])]);
      const userContent = `The traveler DECLINED "${activity.name}" in ${activity.city} and wants a different ${activityType || 'activity'}.${contextClause}${notesClause}${mealReminderClause}${pricingClause}${rosterBlock}${braveBlock}

Find a DIFFERENT real-world venue — NOT "${activity.name}", and nothing already in the trip above. The replacement must directly address the reason for declining (e.g. if the reason mentions a neighborhood, the replacement must be in that neighborhood; if it mentions a cuisine or price level, match that). Use the web research to ground it in an actual venue, and fill in pricing, booking info, duration, and other details.

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

      const roster = [activity, ...(Array.isArray(exclude) ? exclude : [])];
      // Only catches a replacement that reuses a name or venue outright. Two
      // unstructured activities describing the same place under different labels
      // are invisible here — the roster block in the prompt is what covers those.
      const duplicatesTrip = (a) => !dedupeActivities([...roster, a], activity.city).includes(a);

      const declineSignals = [
        ...(Array.isArray(parsed.preferences) ? parsed.preferences : []),
        ...(Array.isArray(parsed.constraints) ? parsed.constraints : [])
      ];
      // Ingested before the retry can bail out with a 409: what the traveler said is
      // worth learning whether or not a usable replacement comes back, and refusing a
      // duplicate then telling them to give a better reason must not also discard the
      // reason they already gave. Detached — reconciliation must not delay the response.
      observe({ userId: resolvedUserId, tripId, source: 'decline', candidates: declineSignals });

      // The model priced it in the basis pricingClause asked for, which is the
      // declined activity's, so the label follows the number. `cost` is dropped
      // first: readBasis prefers a nested cost.type, so a model that volunteers
      // one would outrank the basis we just asked it to price in — and the
      // normalizer only reads the flat field, so the price would be lost too.
      let normalized = normalizeActivity(withBasis(parsed.activity, activity), activity.city);
      await enrichWithPlaceDetails([normalized], activity.city);

      let unverified = false;
      // hasCoords, not Number.isFinite(Number(lat)): normalizeActivity always seeds
      // location.lat as null, and Number(null) is 0, which is finite — so the naive
      // form reported every ungeocoded replacement as verified and this retry never
      // ran in the one case it exists for.
      const needsVenue = !hasCoords(normalized) && process.env.GOOGLE_MAPS_API_KEY;
      const isDuplicate = duplicatesTrip(normalized);
      if (needsVenue || isDuplicate) {
        const retryReason = isDuplicate
          ? `"${normalized.name}" is already in the traveler's itinerary — suggesting it again would duplicate an activity they already have.`
          : `Your suggestion "${normalized.name}" could not be found on Google Maps — it likely does not exist under that name.`;
        debugLog('activity-replace', `RETRY name="${normalized?.name || ''}" reason=${isDuplicate ? 'duplicates_trip' : 'venue_not_found_on_maps'}`);
        const retryResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userContent },
            { role: 'assistant', content: raw },
            { role: 'user', content: `${retryReason} Suggest a different, verifiable venue in ${activity.city} that satisfies the same request and is not already in the trip. Prefer venues from the web research list above. Same JSON format.` }
          ]
        });
        const retryParsed = tryParseJsonObject(extractText(retryResponse.content));
        if (retryParsed?.activity && typeof retryParsed.activity === 'object') {
          const retryNormalized = normalizeActivity(withBasis(retryParsed.activity, activity), activity.city);
          await enrichWithPlaceDetails([retryNormalized], activity.city);
          if (duplicatesTrip(retryNormalized)) {
            // Refuse only when the duplicate is what we retried for. When the original
            // was merely ungeocodable it was never a duplicate, so keep it rather than
            // throwing a good suggestion away over the retry's collision — and the
            // "already in your trip" message would be untrue of it.
            if (isDuplicate) {
              debugLog('activity-replace', `REJECT name="${retryNormalized.name}" reason=duplicates_trip_after_retry elapsed_ms=${Date.now() - replaceStartTs}`);
              return res.status(409).json({ error: 'duplicate_venue' });
            }
            unverified = true;
          } else {
            normalized = retryNormalized;
            // Without a Maps key nothing was geocoded, so a missing coordinate says
            // nothing about the venue — flagging it unverified here while the
            // no-retry path calls the identical state verified is just inconsistent.
            unverified = !!process.env.GOOGLE_MAPS_API_KEY && !hasCoords(retryNormalized);
          }
        } else if (isDuplicate) {
          debugLog('activity-replace', `REJECT name="${normalized.name}" reason=duplicate_retry_unparsed elapsed_ms=${Date.now() - replaceStartTs}`);
          return res.status(409).json({ error: 'duplicate_venue' });
        } else {
          unverified = true;
        }
      }

      debugLog('activity-replace', `DONE name="${normalized?.name || ''}" has_coords=${hasCoords(normalized)} unverified=${unverified} elapsed_ms=${Date.now() - replaceStartTs}`);
      return res.json(unverified ? { activity: normalized, unverified: true } : { activity: normalized });
    } catch (error) {
      debugLog('activity-replace', `ERROR msg="${error?.message || error}" elapsed_ms=${Date.now() - replaceStartTs}`);
      return res.status(500).json({ error: error.message || 'Failed to replace activity' });
    } finally {
      releaseLlmSlot();
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
      if (error.code === 'OPENAI_KEY_MISSING') {
        sendEvent({
          type: 'error',
          error: 'OpenAI API key not configured',
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

module.exports = {
  register,
  groundActivityToPlace,
  buildRefinedActivity,
  buildVenueRosterBlock,
  applyBookingLinks
};
