const Anthropic = require('@anthropic-ai/sdk');
const { extractText, tryParseJsonArray } = require('./services/llmJson');
const { recall } = require('./memory');
const { getCategoryDefaults, paceDescFromValue } = require('./arrangeConfig');

const CANONICAL_TYPES = new Set(['tour', 'meal', 'sports', 'museum', 'landmark', 'neighborhood', 'shopping']);
const { searchCityActivities, searchTopRestaurants, searchInsiderTips, searchShoppingDistricts } = require('./braveSearch');
const { enrichWithPlaceDetails } = require('./services/placesEnrich');
const { formatProfileForEnrichment } = require('./services/profilePrompt');
const { debugLog } = require('./services/debugLog');
const { isLegacyActivity, parseTimeString, parseDurationToMinutes } = require('../shared/activityMigration');

const MODEL = 'claude-sonnet-4-6';

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
- city (string)
- venue_name (string or null) — the specific place as it appears on Google Maps (e.g. \`Casa Lucio, Madrid\`, \`Colosseum, Rome\`). For meals, this MUST be the restaurant name + city. For unstructured neighborhood activities (free time, district walks, sunset spots), set to null.
- why_it_fits (string, 1-2 sentences)
- pitfall (string, 1 sentence)
- booking_advice (string, 1 sentence)
- insider_tips (string or null, 1-2 sentences) — local knowledge a tourist would not know: peak-crowding window, best arrival time, common tourist mistake, neighborhood quirk, "if you do X also do Y" pairing, or destination-specific value/pricing tip (e.g. tax-free refund eligibility, brands cheaper here than at home). If you have no specific, factual tip, return null — never fabricate a generic "arrive early" platitude.
- smarter_alternative (string or null)
- suggested_time (string — e.g. "9:00am", "2:00pm", "sunset")
- duration_hours (number)
- opening_hours (string, e.g. "10:00-18:00" or "12:00-14:30,19:00-22:00") — MANDATORY for type "meal". Use the restaurant's actual hours from the restaurant research provided. Format: "HH:MM-HH:MM" or "HH:MM-HH:MM,HH:MM-HH:MM" for split-shift venues. If actual hours are not in the research, OMIT the restaurant from your output rather than guessing.
- estimated_cost_usd (number — estimated cost in USD. Overestimate rather than underestimate. Scale to the city's cost of living. Return 0 for free activities like walks, parks, sunsets.)
- cost_type (string: "per_person" or "per_group" — per_person: any activity where each person pays individually (museum entry, meal, theme park ticket, boat tour ticket, cooking class). per_group: a single price covers the whole group regardless of headcount (private airport transfer, car rental, private guided tour hired for the group, apartment/villa rental). When in doubt, use per_person.)
- booking_type (string: "tour" / "attraction" / "restaurant" / "none" — tour: guided or operator-led experiences booked through tour platforms, e.g. "Guided Walking Tour of Alhambra", "Pub Crawl", "Cooking Class with Local Chef". attraction: standalone venues with their own ticketing website, e.g. "teamLab Borderless", "Colosseum", "Disneyland", "Sagrada Familia". restaurant: a specific named restaurant, e.g. "Sukiyabashi Jiro", "Café Central". none: generic or free activities, e.g. "Morning walk", "Sunset at the beach" — NEVER use "none" for type "meal" activities.)

MANDATORY RULE — meals: Every activity with type "meal" MUST name a specific restaurant (not a cuisine, neighborhood, or meal slot). The name field MUST be the restaurant's name as-is (e.g. "Ichiran Ramen Shinjuku", "Sukiyabashi Jiro"). DO NOT prefix the name with "Lunch at" / "Dinner at" / "Breakfast at" / "Brunch at" — the arrange step decides which slot each meal fills based on opening_hours, not the name. The why_it_fits field must mention 1–2 must-order dishes at that restaurant.

Example object:
{
  "name": "Wander Alfama at Dawn",
  "type": "neighborhood",
  "city": "Lisbon",
  "venue_name": null,
  "why_it_fits": "..."
}

Return ONLY the JSON array, no markdown, no explanation.`;

// Deliberately a standalone prompt rather than a diff over SYSTEM_PROMPT: the two
// are competing experiment arms, and an arm you cannot read end-to-end is an arm
// you cannot tune. SYSTEM_PROMPT stays byte-identical so a bake-off comparing the
// two moves exactly one variable.
//
// Written against what GPT-5.6 actually did on the first bake-off, where it read
// the Claude-tuned prompt literally and we scored it for obeying us:
//   - "OMIT the restaurant rather than guessing" (opening_hours) beat the
//     mandatory-meals rule. It returned zero meals in both cities.
//   - "Skip prestige picks when they're likely to feel flat" is a judgement call
//     with no threshold, so it quoted the sentence back as justification prose
//     and included the museums anyway. Ratings are now thresholds.
//   - It never once returned insider_tips: null across 70 activities, filling
//     ~17% with the exact "arrive early" platitude the prompt forbids. A null
//     rate is now stated as an expectation, not permission.
//   - It padded to the target with logistics blocks and split single
//     destinations four ways, because nothing said it could return fewer.
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
- name (string) — for meals, the restaurant's name exactly as it is, with no "Lunch at" / "Dinner at" prefix
- type (string, exactly one of: tour / meal / sports / museum / landmark / neighborhood / shopping)
  - meal: any restaurant or food experience
  - museum: indoor exhibit-style attractions (museums, galleries, art spaces, science centers)
  - landmark: outdoor architectural sights (monuments, castles, cathedrals, viewpoints)
  - tour: any scheduled experience with a fixed start time and operator — guided tours, shows, performances, classes
  - neighborhood: unstructured outdoor exploration on foot (district walks, park strolls, sunset spots); use suggested_time to encode time-of-day intent
  - sports: ticketed sporting events or active recreation
  - shopping: specific stores, markets, or shopping districts
- city (string)
- venue_name (string or null) — the place as it appears on Google Maps (e.g. \`Casa Lucio, Madrid\`). Set null ONLY when the activity has no gate, no ticket and no operator — a district walk, a canal at night, a public viewpoint. If it charges admission or has a scheduled start, it HAS a venue: name it. When in doubt, name the venue.
- why_it_fits (string, 1-2 sentences) — reference what this traveler rated highly, not what the city is known for
- pitfall (string, 1 sentence)
- booking_advice (string, 1 sentence)
- insider_tips (string or null, 1-2 sentences) — a fact a first-time visitor could not guess: a specific gate or entrance, a named stretch of street, a pricing quirk, an "if you do X also do Y" pairing.
  Crowd timing IS the platitude. "Arrive early", "go before the tour groups", "mornings are quieter", "come at opening", "visit on a weekday" are all the same non-tip. They are forbidden unless attached to something specific — a named entrance, a particular room, an exact window.
  Expect to return null for roughly a third of activities. A null is a correct answer. A filler tip is a wrong one, and writing one is worse than leaving the field empty.
  Never advise avoiding, evading or re-using an entry fee or ticket.
- smarter_alternative (string or null)
- suggested_time (string — e.g. "9:00am", "2:00pm", "sunset") — must fall inside opening_hours. If the activity only works at dawn or after closing, that is the wrong venue for this slot; pick another.
- duration_hours (number) — the time the WHOLE visit needs, including getting there
- opening_hours (string, e.g. "10:00-18:00" or "12:00-14:30,19:00-22:00", or null if genuinely unknown)
- estimated_cost_usd (number — overestimate rather than underestimate, scaled to the city's cost of living. 0 for free activities.)
- cost_type (string: "per_person" or "per_group" — per_person: each person pays individually (museum entry, meal, ticket, cooking class). per_group: one price covers the whole group (private transfer, car rental, private guide). When in doubt, per_person.)
- booking_type (string: "tour" / "attraction" / "restaurant" / "none" — tour: operator-led experiences. attraction: venues with their own ticketing. restaurant: a specific named restaurant. none: generic or free activities — NEVER "none" for type "meal".)

MANDATORY RULE — meals: Every activity with type "meal" MUST name a specific restaurant, never a cuisine, neighborhood or meal slot. why_it_fits MUST name 1-2 must-order dishes there. If the research does not give that restaurant's hours, set opening_hours to null and STILL INCLUDE IT — downstream enrichment fills real hours from Google. Missing hours is never a reason to drop a meal, and a list short on meals is a failed list.

## Do not pad
The activity count is a target, not a quota. It is the least important instruction here. If you run out of places that genuinely fit this traveler, return fewer and stop — a short honest list is a good answer.

Specifically forbidden:
- Logistics as activities: station or airport arrival walks, departure buffers, "pre-departure" strolls, hotel check-in blocks, supermarket runs.
- Splitting one destination across several activities. A national park with four viewpoints is ONE activity with the duration the whole visit needs, not four. A canyon and its boardwalk and its overlook are one activity.
- Re-using a venue. Each venue appears at most once in the whole list; a restaurant you already used is not available for a second meal.
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

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const MAX_OUTPUT_TOKENS = 32768;

// The only provider-specific step in planCity. Everything before it is prompt
// assembly and everything after is parsing and grounding, so swapping this one
// function is enough to run the same pipeline on another model.
function anthropicGenerator() {
  const client = getClient();
  if (!client) {
    const err = new Error('Anthropic API key not configured');
    err.code = 'ANTHROPIC_KEY_MISSING';
    throw err;
  }
  const generate = async ({ system, prompt }) => {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: [{ role: 'user', content: prompt }]
    });
    const final = await stream.finalMessage();
    return { text: extractText(final.content), stop_reason: final.stop_reason, usage: final.usage };
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

function normalizeActivity(raw = {}, fallbackCity = '') {
  if (!isLegacyActivity(raw)) return raw;

  const type = String(raw.type || '').trim().toLowerCase();
  const isMealType = type === 'meal';
  const defaults = getCategoryDefaults(type);
  const duration = Number(raw.duration_hours);
  const durationHours = Number.isFinite(duration) && duration > 0 ? duration : defaults.durationHours;

  const name = String(raw.name || 'Untitled activity').trim();

  const city = String(raw.city || fallbackCity).trim();
  const rawVenue = raw.venue_name == null ? '' : String(raw.venue_name).trim();
  const venue_name = rawVenue || (isMealType && name ? `${name}, ${city}` : null);

  const rawSuggested = String(raw.suggested_time || '').trim();
  const preferred_time = (rawSuggested && rawSuggested !== '10:00am')
    ? parseTimeString(rawSuggested) : null;

  const bookingType = (() => {
    if (['tour', 'attraction', 'restaurant', 'none'].includes(raw.booking_type)) return raw.booking_type;
    if (type === 'tour') return 'tour';
    if (['museum', 'landmark', 'sports'].includes(type)) return 'attraction';
    if (type === 'meal') return 'restaurant';
    return 'none';
  })();

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
      opening_hours: isMealType
        ? String(raw.opening_hours || '').trim()
        : String(raw.opening_hours || defaults.openingHours || '').trim(),
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

    cost: {
      estimated_usd: (Number.isFinite(Number(raw.estimated_cost_usd)) && Number(raw.estimated_cost_usd) >= 0)
        ? Number(raw.estimated_cost_usd) : null,
      type: raw.cost_type === 'per_group' ? 'per_group' : 'per_person'
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
function dedupeByName(activities, city) {
  const seen = new Set();
  const kept = [];
  const dropped = [];
  for (const activity of activities) {
    const key = String(activity?.name || '').trim().toLowerCase();
    if (seen.has(key)) {
      dropped.push(activity?.name);
      continue;
    }
    seen.add(key);
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
    generateText = generate || anthropicGenerator();
  } catch (err) {
    debugLog('plan-city', `THREW city="${name}" reason=anthropic_key_missing`);
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
  // Every answer except pace and shopping used to be read off the profile and
  // dropped here, so the model planned for a stranger: the interest ratings the
  // SYSTEM_PROMPT tells it to filter on never arrived, and neither did dietary
  // restrictions or mobility needs. Same block the profile summariser gets.
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
    ? `\n\nTop restaurant research — output AT MOST ${minMeals} meal-type activities total across the stay, picked from this list. Each meal MUST include the restaurant's actual opening_hours from the research (if hours aren't listed, omit that restaurant). Use neutral names — the restaurant name itself, no "Lunch at" / "Dinner at" prefix. Choose options that fit the day's geographic area relative to the accommodation. The arrange step decides which slot (lunch vs dinner) each meal fills based on opening_hours. Include 1–2 must-order dishes in why_it_fits:\n${restaurantResearch}`
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
    return `Plan activities for: ${name} (${window.startDate} to ${window.endDate}).${segmentBlock}\n${notes ? `City-specific notes from the traveler: ${notes}\n` : ''}Accommodation context:\n${cityAccommodationText}\n\nTravel entry context touching this city:\n${travelContext}\n\nDeparture context:\n${departureContext}\n\nComputed travel-time constraints:\n${travelTimingContext}\n\nTRAVELER PROFILE — filter every candidate through this before the city's reputation:\n${profileBlock}\n\nACTIVITY COUNT\nGenerate ${winTotal} activities (${winTotal}–${Math.round(winTotal * 1.15)} acceptable). Composition: ${winNonMeal} non-meal (${nonMealPerDay}/day) + AT MOST ${winMeals} meal-type activities. Slot assignment (lunch vs dinner) is decided downstream by the arrange step — do not pre-assign by name. Names must be the restaurant name as-is, no "Lunch at" / "Dinner at" prefix. If you have more strong restaurant candidates than slots, pick the best ${winMeals} and skip the rest. On arrival/departure days, drop a meal whose natural time falls outside the available window (e.g. drop lunch on a 3pm arrival, drop dinner on an 11am departure) — each dropped meal reduces the count by 1. Use accommodation and travel timing to shape sequencing — lighter arrivals/departures, first/last activities near accommodation or transport hubs.${budgetBlock}${lockedBlock}${webBlock}${restaurantBlock}${insiderBlock}${winShoppingBlock}\n\nReturn JSON only.`;
  };

  const basePrompt = systemPrompt || SYSTEM_PROMPT;
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

  const normalized = parsed.map((item) => normalizeActivity(item, name));
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
  const deduped = dedupeByName(filtered, name);
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

  const kept = [];
  const droppedNoHours = [];
  for (const m of meals) {
    if (m.timing?.opening_hours) kept.push(m);
    else droppedNoHours.push(m);
  }

  let droppedOverage = [];
  let finalMeals = kept;
  if (kept.length > minMeals) {
    const ranked = [...kept]
      .map((m, idx) => ({ m, idx, score: mealQualityScore(m) }))
      .sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
    finalMeals = ranked.slice(0, minMeals).map((entry) => entry.m);
    droppedOverage = ranked.slice(minMeals).map((entry) => entry.m);
  }

  if (droppedNoHours.length || droppedOverage.length) {
    console.warn('[plan] meal pool trim', {
      city,
      generated: meals.length,
      kept: finalMeals.length,
      cap: minMeals,
      dropped_no_hours: droppedNoHours.map((m) => m.name),
      dropped_overage: droppedOverage.map((m) => m.name)
    });
  }

  return [...nonMeals, ...finalMeals];
}

module.exports = { planCity, normalizeActivity, blankActivity, dedupeByName, dateWindows, SYSTEM_PROMPT, SYSTEM_PROMPT_GPT };
