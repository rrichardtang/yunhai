const OpenAI = require('openai');
const { extractText, tryParseJsonArray } = require('./services/llmJson');
const { recall } = require('./memory');
const { getCategoryDefaults, paceDescFromValue } = require('./arrangeConfig');

const CANONICAL_TYPES = new Set(['tour', 'meal', 'sports', 'museum', 'landmark', 'neighborhood', 'shopping']);
const { searchCityActivities, searchTopRestaurants, searchInsiderTips, searchShoppingDistricts } = require('./braveSearch');
const { enrichWithPlaceDetails } = require('./services/placesEnrich');
const { formatProfileForEnrichment } = require('./services/profilePrompt');
const { shortCity } = require('./services/imageQuery');
const { debugLog } = require('./services/debugLog');
const { isLegacyActivity, parseTimeString, parseDurationToMinutes } = require('../shared/activityMigration');
const { readBasis } = require('../shared/cost');

// Chosen over claude-sonnet-4-6 on a measured bake-off plus a blind read of both
// arms' output — decisions [2026-08-08]. Pairs with SYSTEM_PROMPT_GPT_LEAN, which
// is written for this model; SYSTEM_PROMPT is Claude-shaped and is not a drop-in.
const MODEL = 'gpt-5.6';

const SYSTEM_PROMPT = `## Role
You are a blunt, opinionated travel planning agent. Design itineraries tailored to this specific traveler's preferences and profile. Filter everything through what they actually enjoy — fit-to-person beats fit-to-tourist-list. Skip prestige picks (museums, ceremonies, big-name attractions) when they're likely to feel flat for this person, regardless of cultural or historical reputation. Be concise: at most 3 sentences per activity.

## Output Format

Return a JSON array of activity objects. Each object must have these fields:
- name (string)
- type (string, exactly one of: tour / meal / sports / museum / landmark / neighborhood / shopping)
  - meal: any restaurant or food experience
  - museum: indoor exhibit-style attractions (museums, galleries, art spaces, science centers)
  - landmark: outdoor architectural sights (monuments, castles, cathedrals, viewpoints)
  - tour: any scheduled experience with a fixed start time and operator — guided tours, shows, performances, classes
  - neighborhood: unstructured outdoor exploration on foot (district walks, park strolls, sunset spots); use suggested_time/preferred_time to encode time-of-day intent
  - sports: ticketed sporting events or active recreation
  - shopping: specific stores, markets, or shopping districts
- venue_name (string or null) — the specific place as it appears on Google Maps (e.g. \`Casa Lucio, Madrid\`, \`Colosseum, Rome\`). For meals, this MUST be the restaurant name + city. For unstructured neighborhood activities (free time, district walks, sunset spots), set to null.
- why_it_fits (string, 1-2 sentences)
- pitfall (string, 1 sentence)
- booking_advice (string, 1 sentence)
- insider_tips (string or null, 1-2 sentences) — local knowledge a tourist would not know: peak-crowding window, best arrival time, common tourist mistake, neighborhood quirk, "if you do X also do Y" pairing, or destination-specific value/pricing tip (e.g. tax-free refund eligibility, brands cheaper here than at home). If you have no specific, factual tip, return null — never fabricate a generic "arrive early" platitude.
- smarter_alternative (string or null)
- suggested_time (string — e.g. "9:00am", "2:00pm", "sunset")
- duration_hours (number)
- estimated_cost_usd (number — estimated cost in USD. Overestimate rather than underestimate. Scale to the city's cost of living. Return 0 for free activities like walks, parks, sunsets.)

MANDATORY RULE — meals: Every activity with type "meal" MUST name a specific restaurant (not a cuisine, neighborhood, or meal slot). The why_it_fits field must mention 1–2 must-order dishes at that restaurant.

Example object:
{
  "name": "Wander Alfama at Dawn",
  "type": "neighborhood",
  "venue_name": null,
  "why_it_fits": "..."
}

Return ONLY the JSON array, no markdown, no explanation.`;

// Competing arm to SYSTEM_PROMPT, which stays byte-identical so a bake-off moves
// one variable. Standalone rather than a diff: an arm you cannot read end to end
// is an arm you cannot tune. Each rule below guards a specific GPT-5.6 behaviour
// from the first bake-off — src/planPrompt.test.js names which.
const SYSTEM_PROMPT_GPT = `## Role
You are a blunt, opinionated travel planning agent. You are planning for ONE specific traveler whose profile appears in the user message. Fit-to-person beats fit-to-tourist-list. Be concise: at most 3 sentences per activity.

## Reading the traveler profile
Every interest is rated 1-5. Treat the rating as a filter, not a hint:
- 1-2 — actively avoid this category. At most ONE such activity for the entire city, and only if skipping it would be absurd for this specific place.
- 3 — include sparingly.
- 4-5 — this is what the trip is for. Weight the list heavily toward it.

A category rated 1-2 does not become acceptable because the venue is famous, UNESCO-listed, highly rated, or "the thing everyone does here". Cultural or historical reputation is NOT a reason to include something this traveler rated low. If you catch yourself writing a justification for why a low-rated category is worth it anyway, delete the activity instead.

Dietary restrictions and mobility considerations are absolute constraints, not preferences.

## Output Format

Return a JSON array of activity objects. Each object must have these fields:
- name (string) — for meals, the restaurant's name exactly as it is
- type (string, exactly one of: tour / meal / sports / museum / landmark / neighborhood / shopping)
  - meal: any restaurant or food experience
  - museum: indoor exhibit-style attractions (museums, galleries, art spaces, science centers)
  - landmark: outdoor architectural sights (monuments, castles, cathedrals, viewpoints)
  - tour: any scheduled experience with a fixed start time and operator — guided tours, shows, performances, classes
  - neighborhood: unstructured outdoor exploration on foot (district walks, park strolls, sunset spots); use suggested_time to encode time-of-day intent
  - sports: ticketed sporting events or active recreation
  - shopping: specific stores, markets, or shopping districts
- venue_name (string or null) — the place as it appears on Google Maps (e.g. \`Casa Lucio, Madrid\`). Set null ONLY when the activity has no gate, no ticket and no operator — a district walk, a canal at night, a public viewpoint. If it charges admission or has a scheduled start, it HAS a venue: name it. When in doubt, name the venue.
- why_it_fits (string, 1-2 sentences) — reference what this traveler rated highly, not what the city is known for
- pitfall (string, 1 sentence)
- booking_advice (string, 1 sentence)
- insider_tips (string or null, 1-2 sentences) — a fact a first-time visitor could not guess: a specific gate or entrance, a named stretch of street, a pricing quirk, an "if you do X also do Y" pairing.
  Crowd timing IS the platitude. "Arrive early", "go before the tour groups", "mornings are quieter", "come at opening", "visit on a weekday" are all the same non-tip. They are forbidden unless attached to something specific — a named entrance, a particular room, an exact window.
  Expect to return null for roughly a third of activities. A null is a correct answer. A filler tip is a wrong one, and writing one is worse than leaving the field empty.
  Never advise avoiding, evading or re-using an entry fee or ticket.
- smarter_alternative (string or null)
- suggested_time (string — e.g. "9:00am", "2:00pm", "sunset") — the time of day the activity is best, as intent. The schedule is assigned downstream against the venue's real hours.
- duration_hours (number) — the time the WHOLE visit needs, including getting there
- estimated_cost_usd (number — overestimate rather than underestimate, scaled to the city's cost of living. 0 for free activities.)

MANDATORY RULE — meals: Every activity with type "meal" MUST name a specific restaurant, never a cuisine, neighborhood or meal slot. why_it_fits MUST name 1-2 must-order dishes there. A list short on meals is a failed list.

## Do not pad
The activity count is a target, not a quota. It is the least important instruction here. If you run out of places that genuinely fit this traveler, return fewer and stop — a short honest list is a good answer.

Specifically forbidden:
- Logistics as activities: station or airport arrival walks, departure buffers, "pre-departure" strolls, hotel check-in blocks, supermarket runs.
- Splitting one destination across several activities. A national park with four viewpoints is ONE activity with the duration the whole visit needs, not four. A canyon and its boardwalk and its overlook are one activity.
- Any activity whose own pitfall argues against doing it. If you would write "there is little to see here" or "this really needs an overnight to work", drop it instead of writing that sentence.
- A day trip to a city that appears elsewhere in this traveler's itinerary.

Example object:
{
  "name": "Wander Alfama at Dawn",
  "type": "neighborhood",
  "city": "Lisbon",
  "venue_name": null,
  "why_it_fits": "..."
}

Return ONLY the JSON array, no markdown, no explanation.`;

// SYSTEM_PROMPT_GPT with the coaching removed: no null-rate quota, no lists of
// forbidden phrasings or padding shapes, no worked examples of a stated rule, no
// meta-instruction about the model's own reasoning. What survives is the schema
// (unguessable), the rating thresholds (the untested fix for the museum failure)
// and each anti-padding principle stated once.
const SYSTEM_PROMPT_GPT_LEAN = `## Role
You are a blunt, opinionated travel planning agent planning for ONE traveler, whose profile is in the user message. Fit-to-person beats fit-to-tourist-list. At most 3 sentences per activity.

## Reading the traveler profile
Every interest is rated 1-5. Treat the rating as a filter, not a hint:
- 1-2 — actively avoid. At most ONE such activity for the entire city, and only if skipping it would be absurd for this place.
- 3 — include sparingly.
- 4-5 — this is what the trip is for. Weight the list heavily toward it.

Fame, a UNESCO listing, or being "the thing everyone does here" is not a reason to include a category this traveler rated low. Dietary restrictions and mobility considerations are absolute constraints, not preferences.

## Output Format

Return a JSON array of activity objects with these fields:
- name (string) — for meals, the restaurant's name as-is
- type (string, exactly one of: tour / meal / sports / museum / landmark / neighborhood / shopping)
  - meal: any restaurant or food experience
  - museum: indoor exhibit-style attractions (museums, galleries, art spaces, science centers)
  - landmark: outdoor architectural sights (monuments, castles, cathedrals, viewpoints)
  - tour: any scheduled experience with a fixed start time and operator — guided tours, shows, performances, classes
  - neighborhood: unstructured outdoor exploration on foot (district walks, park strolls, sunset spots)
  - sports: ticketed sporting events or active recreation
  - shopping: specific stores, markets, or shopping districts
- venue_name (string or null) — the place as it appears on Google Maps (e.g. \`Casa Lucio, Madrid\`). Null ONLY when the activity has no gate, ticket or operator: a district walk, a canal at night, a public viewpoint.
- why_it_fits (string, 1-2 sentences)
- pitfall (string, 1 sentence)
- booking_advice (string, 1 sentence)
- insider_tips (string or null, 1-2 sentences) — something a first-time visitor could not guess: a specific gate, a named stretch of street, a pricing quirk, an "if you do X also do Y" pairing. Crowd timing is not a tip unless it names something specific. Return null rather than write filler — a null is a correct answer. Never advise avoiding or re-using an entry fee.
- smarter_alternative (string or null)
- suggested_time (string — e.g. "9:00am", "sunset") — the time of day the activity is best, as intent. The schedule is assigned downstream against the venue's real hours.
- duration_hours (number) — what the whole visit needs, including getting there
- estimated_cost_usd (number — overestimate rather than under, scaled to the city's cost of living. 0 for free activities.)

MANDATORY RULE — meals: every activity of type "meal" names a specific restaurant, and why_it_fits names 1-2 must-order dishes there. A list short on meals is a failed list.

## Do not pad
The activity count is a target, not a quota, and it is the least important instruction here. If you run out of places that genuinely fit this traveler, return fewer and stop. One destination is one activity, whatever its internal parts. Drop any activity whose own pitfall argues against doing it, rather than writing that sentence.

Example object:
{
  "name": "Wander Alfama at Dawn",
  "type": "neighborhood",
  "venue_name": null,
  "why_it_fits": "..."
}

Return ONLY the JSON array, no markdown, no explanation.`;

const MAX_OUTPUT_TOKENS = 32768;

// The only provider-specific step in planCity. Everything before it is prompt
// assembly and everything after is parsing and grounding, so swapping this one
// function is enough to run the same pipeline on another model — which is how
// the bake-off ran Sonnet 4.6 and Sonnet 5 through this exact code path.
function openaiGenerator() {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error('OpenAI API key not configured');
    err.code = 'OPENAI_KEY_MISSING';
    throw err;
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const generate = async ({ system, prompt }) => {
    const res = await client.chat.completions.create({
      model: MODEL,
      // Without an explicit cap a truncated array cannot be told apart from the
      // model's own ceiling, and trunc% is what would catch that regression.
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }]
    });
    const choice = res.choices?.[0];
    return { text: choice?.message?.content || '', stop_reason: choice?.finish_reason };
  };
  generate.modelId = MODEL;
  return generate;
}

function blankActivity(overrides = {}) {
  return {
    id: overrides.id || '',
    name: overrides.name || 'Untitled activity',
    city: overrides.city || '',
    venue_name: overrides.venue_name || null,
    type: overrides.type || 'tour',

    location: {
      name: overrides.venue_name || overrides.name || 'Untitled activity',
      address: '',
      lat: null,
      lng: null
    },

    tags: [],

    timing: {
      duration_minutes: 60,
      opening_hours: '',
      preferred_time: null,
      fixed: null,
      must_happen_on_day: null
    },

    experience: { intensity: 'medium', is_highlight: false },

    booking: { type: 'none', links: [], reference: null },

    cost: { estimated_usd: null, type: 'per_person' },

    dedicated_time_block: false,
    why_it_fits: '',
    pitfall: '',
    booking_advice: '',
    insider_tips: null,
    smarter_alternative: null,
    ...overrides
  };
}

// The arrange step picks lunch vs dinner from opening_hours, so a slot baked into
// the name is both wrong and unremovable downstream. Mirrors the client-side
// stripper in public/js/activityCard.js.
const MEAL_PREFIX_RE = /^(Lunch|Dinner|Breakfast|Brunch|Drinks|Coffee|Visit)\s+at\s+/i;

function stripMealPrefix(name) {
  return String(name || '').replace(MEAL_PREFIX_RE, '').replace(/^Visit\s+/i, '').trim();
}

// booking_type tracks whether there is anything to buy, not the category. A
// type-only mapping disagreed with the model on 36 of 135 saved activities, and
// in both directions: it put an affiliate link on free hikes and viewpoints, and
// stripped it from ticketed parks typed `neighborhood`. Cost is the signal the
// model was actually reading. Shopping is excluded because its cost is estimated
// spend, not admission.
function bookingTypeFor(type, costUsd) {
  if (type === 'meal') return 'restaurant';
  if (type === 'tour') return 'tour';
  if (type === 'shopping') return 'none';
  return Number(costUsd) > 0 ? 'attraction' : 'none';
}

function normalizeActivity(raw = {}, fallbackCity = '') {
  if (!isLegacyActivity(raw)) return raw;

  const type = String(raw.type || '').trim().toLowerCase();
  const isMealType = type === 'meal';
  const defaults = getCategoryDefaults(type);
  const duration = Number(raw.duration_hours);
  const durationHours = Number.isFinite(duration) && duration > 0 ? duration : defaults.durationHours;

  const name = stripMealPrefix(String(raw.name || 'Untitled activity'));

  const city = String(raw.city || fallbackCity).trim();
  const rawVenue = raw.venue_name == null ? '' : String(raw.venue_name).trim();
  const venue_name = rawVenue || (isMealType && name ? `${name}, ${city}` : null);

  const rawSuggested = String(raw.suggested_time || '').trim();
  const preferred_time = (rawSuggested && rawSuggested !== '10:00am')
    ? parseTimeString(rawSuggested) : null;

  const costUsd = (Number.isFinite(Number(raw.estimated_cost_usd)) && Number(raw.estimated_cost_usd) >= 0)
    ? Number(raw.estimated_cost_usd) : null;
  const bookingType = bookingTypeFor(type, costUsd);

  const address = String(raw.start_location || raw.location?.address || venue_name || '').trim();

  return {
    id: raw.id,
    name,
    city,
    venue_name,
    type,

    location: {
      name: venue_name || name,
      address,
      lat: null,
      lng: null
    },

    tags: [],

    timing: {
      duration_minutes: parseDurationToMinutes(durationHours),
      // A category default is a guess about a gate, so it is only honest for a
      // place that has one. An unstructured activity — a district walk, a sunset
      // spot — has no opening hours, and '' is how the scheduler spells "any
      // time" (parseOpeningHours -> [[0, 1440]]). Giving it neighborhood's
      // 09:00-21:00 invented a constraint that then blocked the dawn walk the
      // model asked for.
      opening_hours: venue_name
        ? String(raw.opening_hours || defaults.openingHours || '').trim()
        : String(raw.opening_hours || '').trim(),
      preferred_time,
      fixed: null,
      must_happen_on_day: null
    },

    experience: { intensity: 'medium', is_highlight: false },

    booking: {
      type: bookingType,
      links: Array.isArray(raw.booking_links) ? raw.booking_links : [],
      reference: null
    },

    // Read, not assumed. Hardcoding per_person here made this the one field in
    // the whole normalizer that discarded its input, so every caller with a real
    // basis had to repair it afterwards — /add re-applied it, /refine
    // re-assigned it, and /replace silently dropped the traveler's choice.
    cost: {
      estimated_usd: costUsd,
      type: readBasis(raw)
    },

    dedicated_time_block: durationHours >= 2,
    why_it_fits: String(raw.why_it_fits || '').trim(),
    pitfall: String(raw.pitfall || '').trim(),
    booking_advice: String(raw.booking_advice || '').trim(),
    insider_tips: raw.insider_tips == null ? null : (String(raw.insider_tips).trim() || null),
    smarter_alternative: raw.smarter_alternative == null ? null : String(raw.smarter_alternative).trim()
  };
}

function coordsOf(source = {}) {
  const lat = Number(source.latitude);
  const lng = Number(source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

// The client sends a single `accommodation`; older payloads carried an
// `accommodations` array. Accept both, and drop entries with nothing usable.
function resolveAccommodations(city = {}) {
  const entries = Array.isArray(city.accommodations) ? city.accommodations : [city.accommodation];
  return entries.filter((a) => a && (String(a.address || '').trim() || coordsOf(a)));
}

function addDays(ymd, n) {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

// Generation time is linear in activity count — ~6.2s each, with no measurable
// fixed cost — so a long stay is far quicker as parallel day-windows than as one
// serial call. Returns a single window when splitting is off or the stay is short.
function dateWindows(startDate, tripDays, splitDays) {
  if (!splitDays || !startDate || tripDays <= splitDays) {
    return [{ startDate, endDate: startDate ? addDays(startDate, tripDays - 1) : '', days: tripDays }];
  }
  const windows = [];
  for (let offset = 0; offset < tripDays; offset += splitDays) {
    const days = Math.min(splitDays, tripDays - offset);
    windows.push({
      startDate: addDays(startDate, offset),
      endDate: addDays(startDate, offset + days - 1),
      days
    });
  }
  return windows;
}

// Parallel windows cannot see each other's picks, so the same activity can come
// back twice under one name. That is the only duplicate a window boundary
// creates, so name identity is the whole rule.
//
// Keying on the grounded coordinate looked stronger and was much worse: a
// district centroid is the correct coordinate for every activity in that
// district, so one run deleted a rooftop visit, a cultural performance and a
// departure-morning wander at Dukezong as duplicates of an evening wander. A
// model selling one park three times under three names is a different problem —
// a model-quality one, which the bake-off's distinct% measures and selects
// against. Collapsing it here would only hide it.
// Collapses a repeated name, and a repeated venue under two names — one café sold
// three times was the padding shape both models produced. venue_name is null by
// design for unstructured activities, and two district walks are genuinely
// distinct, so only a named venue counts. Coordinates cannot make this call: a
// district centroid is the correct point for every activity in that district.
function dedupeActivities(activities, city) {
  const seenNames = new Set();
  const seenVenues = new Set();
  const kept = [];
  const dropped = [];
  for (const activity of activities) {
    const name = String(activity?.name || '').trim().toLowerCase();
    const venue = String(activity?.venue_name || '').trim().toLowerCase();
    if (seenNames.has(name) || (venue && seenVenues.has(venue))) {
      dropped.push(activity?.name);
      continue;
    }
    seenNames.add(name);
    if (venue) seenVenues.add(venue);
    kept.push(activity);
  }
  if (dropped.length) {
    debugLog('plan-city', `DEDUPE city="${city}" dropped=${dropped.length} names="${dropped.slice(0, 8).join(' | ')}"`);
  }
  return kept;
}

async function planCity(city, profile = null, userId = 'default', travels = [], travelTiming = null, budget = null, numCities = 1, numTravelers = 1, numChildren = 0, lockedActivities = [], tripId = null, { onPhase = () => {}, generate = null, splitDays = null, onEnrichOutcome = null, systemPrompt = null } = {}) {
  const planCityStartTs = Date.now();
  const { name, startDate, endDate, leaveTime, notes } = city;
  const accommodations = resolveAccommodations(city);
  debugLog('plan-city', `START city="${name}" travelers=${numTravelers} children=${numChildren} budget=${budget || 'none'} locked=${Array.isArray(lockedActivities) ? lockedActivities.length : 0}`);
  let generateText;
  try {
    generateText = generate || openaiGenerator();
  } catch (err) {
    debugLog('plan-city', `THREW city="${name}" reason=openai_key_missing`);
    throw err;
  }

  const cityAccommodationText = accommodations.length
    ? accommodations.map((accommodation) => {
      const coords = coordsOf(accommodation);
      const coordText = coords ? ` [${coords.lat}, ${coords.lng}]` : '';
      return `Accommodation: ${accommodation.address || 'Address missing'}${coordText} | ${accommodation.checkIn || '?'} → ${accommodation.checkOut || '?'}`;
    }).join('\n')
    : 'No accommodation booked yet — plan around the city centre and keep first/last activities near transport hubs.';

  const relatedTravels = Array.isArray(travels) ? travels.slice(0, 1) : [];

  const travelContext = relatedTravels.length
    ? relatedTravels.map((travel) => {
      const coordText = (Number.isFinite(Number(travel.entryPointLat)) && Number.isFinite(Number(travel.entryPointLng)))
        ? ` at [${Number(travel.entryPointLat)}, ${Number(travel.entryPointLng)}]`
        : '';
      return `Trip entry via ${travel.entryPoint || '?'} @ ${travel.dateTime || '?'}${coordText}`;
    }).join('\n')
    : 'No trip entry details provided yet.';

  const departureContext = `User leaving ${name} on ${endDate || '?'} at ${leaveTime || '18:00'}`;
  const travelTimingContext = [
    travelTiming?.arrivalSummary || '',
    travelTiming?.departureSummary || '',
    travelTiming?.interCitySummary || ''
  ].filter(Boolean).join('\n') || 'No computed transfer-time constraints available.';

  const { value: pace } = paceDescFromValue(profile?.answers?.pace);
  const nonMealPerDayByPace = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
  const nonMealPerDay = nonMealPerDayByPace[pace];
  const profileBlock = formatProfileForEnrichment(profile || {});

  const tripDays = (() => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.round((end - start) / 86400000) + 1;
    return Number.isFinite(diff) && diff > 0 ? diff : 1;
  })();
  const minNonMeal = nonMealPerDay * tripDays;
  const minMeals = 2 * tripDays;
  const minTotal = minNonMeal + minMeals;
  const maxTotal = Math.round(minTotal * 1.15);

  const tripYear = (() => {
    if (startDate) {
      const y = new Date(startDate).getFullYear();
      if (Number.isFinite(y) && y >= 2000) return y;
    }
    return new Date().getFullYear();
  })();
  const shoppingPersonRaw = Number(profile?.answers?.shoppingPerson);
  const shoppingPerson = Number.isFinite(shoppingPersonRaw) ? Math.max(1, Math.min(5, Math.round(shoppingPersonRaw))) : 1;
  const shoppingInterests = String(profile?.answers?.shoppingInterests || '').trim();
  const shoppingActive = shoppingPerson >= 3;

  onPhase('research');
  const [webResearch, restaurantResearch, insiderResearch, shoppingResearch] = await Promise.all([
    searchCityActivities(name, { year: tripYear }),
    searchTopRestaurants(name, { year: tripYear }),
    searchInsiderTips(name, { year: tripYear }),
    shoppingActive ? searchShoppingDistricts(name, shoppingInterests, { year: tripYear }) : Promise.resolve('')
  ]);
  const webBlock = webResearch
    ? `\n\nWeb research (use as supplementary inspiration, not a strict list):\n${webResearch}`
    : '';
  const restaurantBlock = restaurantResearch
    ? `\n\nTop restaurant research — output up to ${minMeals} meal-type activities total across the stay, picked from this list, and aim for that number rather than treating it only as a ceiling. Include 1–2 must-order dishes in why_it_fits:\n${restaurantResearch}`
    : '';
  const insiderBlock = insiderResearch
    ? `\n\nLocal knowledge / insider notes — use these to populate the insider_tips field with specific, factual tips (peak crowding, best arrival time, common tourist mistakes, neighborhood quirks). Do not copy phrases verbatim; synthesize:\n${insiderResearch}`
    : '';
  const shoppingPerDay = { 3: 0.33, 4: 0.5, 5: 0.75 };
  const shoppingTarget = shoppingActive ? Math.max(1, Math.round((shoppingPerDay[shoppingPerson] || 0.5) * tripDays)) : 0;
  const shoppingBlock = shoppingActive
    ? `\n\nSHOPPING (traveler interest ${shoppingPerson}/5${shoppingInterests ? `, focus: ${shoppingInterests}` : ''})\nInclude ${shoppingTarget} shopping activit${shoppingTarget === 1 ? 'y' : 'ies'} across the stay (counted within the non-meal target above, not in addition). Each must name a specific store/district/market — never "go shopping in ${name}". Set type to "shopping" and booking_type to "none". insider_tips should cover tax-free refund eligibility for non-EU travelers (where applicable), price-vs-home-country deltas if obvious (e.g. Zara cheaper in Spain than US), and the best neighborhood for the category.${shoppingResearch ? `\n\nShopping research:\n${shoppingResearch}` : ''}`
    : '';

  const travelersDesc = numChildren > 0 ? `${numTravelers} adult${numTravelers > 1 ? 's' : ''} and ${numChildren} child${numChildren > 1 ? 'ren' : ''}` : `${numTravelers} adult${numTravelers > 1 ? 's' : ''}`;
  const budgetBlock = budget && numCities
    ? `\nBudget context: The traveler has a total trip budget of $${budget} for ${travelersDesc} across ${numCities} cit${numCities > 1 ? 'ies' : 'y'} (~$${Math.round(budget / numCities)} per city). Children's tickets/meals are typically ~60% of adult price. Be budget-conscious — prefer good-value activities.`
    : '';

  const lockedBlock = Array.isArray(lockedActivities) && lockedActivities.length
    ? `\n\nAlready locked activities — do not duplicate venues, cuisines, or experience types from this set:\n${
        lockedActivities.map((a) =>
          `- "${a.name}" | type: ${a.type || ''} | category: ${a.category || ''}`
        ).join('\n')
      }`
    : '';

  const windows = dateWindows(startDate, tripDays, splitDays);

  // Each window carries the same city context and research, and differs only in
  // its dates and its share of the activity budget.
  const buildPrompt = (window, index) => {
    const winNonMeal = nonMealPerDay * window.days;
    const winMeals = 2 * window.days;
    const winTotal = winNonMeal + winMeals;
    const segmentBlock = windows.length > 1
      ? `\n\nThis is days ${window.startDate} to ${window.endDate} of a longer stay in ${name} (${startDate} to ${endDate}). Plan ONLY these days. Other days are being planned separately, so choose venues that stand on their own and avoid the single most obvious headline sight unless it belongs in this window.`
      : '';
    // Shopping is a whole-stay target, so it rides on the first window only
    // rather than being multiplied across every one of them.
    const winShoppingBlock = index === 0 ? shoppingBlock : '';
    return `Plan activities for: ${name} (${window.startDate} to ${window.endDate}).${segmentBlock}\n${notes ? `City-specific notes from the traveler: ${notes}\n` : ''}Accommodation context:\n${cityAccommodationText}\n\nTravel entry context touching this city:\n${travelContext}\n\nDeparture context:\n${departureContext}\n\nComputed travel-time constraints:\n${travelTimingContext}\n\nTRAVELER PROFILE — filter every candidate through this before the city's reputation:\n${profileBlock}\n\nACTIVITY COUNT\nGenerate ${winTotal} activities (${winTotal}–${Math.round(winTotal * 1.15)} acceptable). Composition: ${winNonMeal} non-meal (${nonMealPerDay}/day) + AT MOST ${winMeals} meal-type activities. If you have more strong restaurant candidates than slots, pick the best ${winMeals} and skip the rest. On arrival/departure days, drop a meal whose natural time falls outside the available window (e.g. drop lunch on a 3pm arrival, drop dinner on an 11am departure) — each dropped meal reduces the count by 1. Use accommodation and travel timing to shape sequencing — lighter arrivals/departures, first/last activities near accommodation or transport hubs.${budgetBlock}${lockedBlock}${webBlock}${restaurantBlock}${insiderBlock}${winShoppingBlock}\n\nReturn JSON only.`;
  };

  const basePrompt = systemPrompt || SYSTEM_PROMPT_GPT_LEAN;
  const learnedSummary = recall({ userId, tripId, query: name }).text;
  const effectiveSystemPrompt = learnedSummary
    ? `${basePrompt}\n\n${learnedSummary}`
    : basePrompt;

  const streamMessage = (userContent) => generateText({ system: effectiveSystemPrompt, prompt: userContent });

  const generateWindow = async (window, index) => {
    const prompt = buildPrompt(window, index);
    const label = windows.length > 1 ? `${name} [${window.startDate}..${window.endDate}]` : name;
    debugLog('plan-city', `LLM_CALL city="${label}" model=${generateText.modelId || MODEL} prompt_chars=${prompt.length}`);
    const first = await streamMessage(prompt);
    debugLog('plan-city', `LLM_RESPONSE city="${label}" chars=${first.text.length} stop_reason=${first.stop_reason}`);
    let parsed = tryParseJsonArray(first.text);
    let last = first;

    if (!parsed) {
      debugLog('plan-city', `PARSE_FAIL city="${label}" stop_reason=${first.stop_reason} tail="${first.text.slice(-200).replace(/"/g, "'")}"`);
      debugLog('plan-city', `RETRY city="${label}"`);
      last = await streamMessage(`${prompt}\n\nIMPORTANT: Return ONLY a valid JSON array. No text before or after.`);
      debugLog('plan-city', `LLM_RESPONSE city="${label}" chars=${last.text.length} stop_reason=${last.stop_reason} (retry)`);
      parsed = tryParseJsonArray(last.text);
    }

    if (!parsed) {
      debugLog('plan-city', `THREW city="${label}" reason=parse_failed_after_retry`);
      throw new Error(`Claude returned invalid JSON for ${label}.`);
    }
    return { parsed, retried: last !== first, response: last };
  };

  onPhase('generating');
  const results = await Promise.all(windows.map(generateWindow));
  const parsed = results.flatMap((result) => result.parsed);
  if (windows.length > 1) {
    debugLog('plan-city', `WINDOWS city="${name}" count=${windows.length} split_days=${splitDays} activities=${parsed.length}`);
  }

  // The model no longer emits `city`, so the fallback is the only source. It must
  // be the short form: the qualified name ("Lijiang, Yunnan, China") is what broke
  // every image query, and it rides into the Places and commute lookups too.
  const normalized = parsed.map((item) => normalizeActivity(item, shortCity(name)));
  const validTyped = filterInvalidTypes(normalized, name);
  const filtered = applyMealPoolCap(validTyped, { city: name, minMeals });
  debugLog('plan-city', `NORMALIZED city="${name}" raw=${parsed.length} after_type_filter=${validTyped.length} after_meal_cap=${filtered.length}`);
  // Bias venue lookups to the hotel when there is one, otherwise to the city
  // itself — a trip planned before booking still deserves a bias centre.
  const cityCenter = accommodations.map(coordsOf).find(Boolean) || coordsOf(city);
  onPhase('enriching');
  debugLog('plan-city', `ENRICH_CALL city="${name}" activities=${filtered.length} bias=${cityCenter ? `${cityCenter.lat},${cityCenter.lng}` : 'none'}`);
  await enrichWithPlaceDetails(filtered, name, cityCenter, onEnrichOutcome);
  // Runs after grounding so duplicates are caught by resolved venue rather than
  // by name — the same place arrives under three different labels.
  const deduped = dedupeActivities(filtered, name);
  debugLog('plan-city', `RETURN city="${name}" count=${deduped.length} elapsed_ms=${Date.now() - planCityStartTs}`);
  return deduped;
}

function filterInvalidTypes(activities, city) {
  const kept = [];
  const dropped = [];
  for (const a of activities) {
    const t = String(a?.type || '').toLowerCase();
    if (CANONICAL_TYPES.has(t)) kept.push(a);
    else dropped.push({ name: a?.name, type: t });
  }
  if (dropped.length) {
    console.warn('[plan] dropped activities with invalid type', { city, dropped });
  }
  return kept;
}

function isMealNormalized(activity) {
  return String(activity?.type || '').toLowerCase() === 'meal';
}

function mealQualityScore(activity) {
  let score = 0;
  if (activity?.insider_tips) score += 2;
  const why = String(activity?.why_it_fits || '');
  if (/\b(must[- ]?order|signature|famous for|known for|order the)\b/i.test(why)) score += 2;
  if (why.length > 80) score += 1;
  return score;
}

function applyMealPoolCap(activities, { city, minMeals }) {
  const meals = [];
  const nonMeals = [];
  for (const a of activities) {
    if (isMealNormalized(a)) meals.push(a);
    else nonMeals.push(a);
  }
  if (meals.length <= minMeals) return [...nonMeals, ...meals];

  const ranked = [...meals]
    .map((m, idx) => ({ m, idx, score: mealQualityScore(m) }))
    .sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
  const finalMeals = ranked.slice(0, minMeals).map((entry) => entry.m);

  console.warn('[plan] meal pool trim', {
    city,
    generated: meals.length,
    kept: finalMeals.length,
    cap: minMeals,
    dropped_overage: ranked.slice(minMeals).map((entry) => entry.m.name)
  });
  return [...nonMeals, ...finalMeals];
}

module.exports = { planCity, normalizeActivity, blankActivity, dedupeActivities, dateWindows, SYSTEM_PROMPT, SYSTEM_PROMPT_GPT, SYSTEM_PROMPT_GPT_LEAN };
