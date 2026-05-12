const Anthropic = require('@anthropic-ai/sdk');
const { getSummary } = require('./preferences');
const { inferCategory, getCategoryDefaults, paceDescFromValue } = require('./arrangeConfig');
const { searchCityActivities, searchTopRestaurants, searchInsiderTips, searchShoppingDistricts } = require('./braveSearch');
const { enrichWithPlaceDetails } = require('./services/placesEnrich');
const { isLegacyActivity, migrateActivity, parseTimeString, parseDurationToMinutes, inferMealType } = require('../shared/activityMigration');

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `## Role
You are a blunt, opinionated travel planning agent. Design itineraries tailored to this specific traveler's preferences and profile. Filter everything through what they actually enjoy — fit-to-person beats fit-to-tourist-list. Skip prestige picks (museums, ceremonies, big-name attractions) when they're likely to feel flat for this person, regardless of cultural or historical reputation. Be concise: at most 3 sentences per activity.

## Output Format

Return a JSON array of activity objects. Each object must have these fields:
- name (string)
- type (string: show / tour / food / sports / cultural / walk / sunset / neighborhood / lunch / dinner / shopping)
- city (string)
- venue_name (string or null) — the specific place as it appears on Google Maps (e.g. \`Casa Lucio, Madrid\`, \`Colosseum, Rome\`). For meals, this MUST be the restaurant name + city. For generic activities (free time, walks, sunsets, neighborhoods), set to null.
- why_it_fits (string, 1-2 sentences)
- pitfall (string, 1 sentence)
- booking_advice (string, 1 sentence)
- insider_tips (string or null, 1-2 sentences) — local knowledge a tourist would not know: peak-crowding window, best arrival time, common tourist mistake, neighborhood quirk, "if you do X also do Y" pairing, or destination-specific value/pricing tip (e.g. tax-free refund eligibility, brands cheaper here than at home). If you have no specific, factual tip, return null — never fabricate a generic "arrive early" platitude.
- smarter_alternative (string or null)
- suggested_time (string — e.g. "9:00am", "2:00pm", "sunset")
- duration_hours (number)
- category (string, e.g. museum / restaurant / park)
- opening_hours (string, e.g. "10:00-18:00" or "12:00-14:30,19:00-22:00")
- estimated_cost_usd (number — estimated cost in USD. Overestimate rather than underestimate. Scale to the city's cost of living. Return 0 for free activities like walks, parks, sunsets.)
- cost_type (string: "per_person" or "per_group" — per_person: any activity where each person pays individually (museum entry, meal, theme park ticket, boat tour ticket, cooking class). per_group: a single price covers the whole group regardless of headcount (private airport transfer, car rental, private guided tour hired for the group, apartment/villa rental). When in doubt, use per_person.)
- booking_type (string: "tour" / "attraction" / "restaurant" / "none" — tour: guided or operator-led experiences booked through tour platforms, e.g. "Guided Walking Tour of Alhambra", "Pub Crawl", "Cooking Class with Local Chef". attraction: standalone venues with their own ticketing website, e.g. "teamLab Borderless", "Colosseum", "Disneyland", "Sagrada Familia". restaurant: a specific named restaurant, e.g. "Sukiyabashi Jiro", "Café Central". none: generic or free activities, e.g. "Morning walk", "Sunset at the beach" — NEVER use "none" for food/lunch/dinner activities.)

MANDATORY RULE — meals: Every activity with type food, lunch, or dinner MUST name a specific restaurant (not a cuisine, neighborhood, or meal type). The name field must be the restaurant's name, e.g. "Ichiran Ramen Shinjuku", not "Ramen lunch in Shinjuku". The why_it_fits field must mention 1–2 must-order dishes at that restaurant.

Example object:
{
  "name": "Wander Alfama at Dawn",
  "type": "walk",
  "city": "Lisbon",
  "venue_name": null,
  "why_it_fits": "..."
}

Return ONLY the JSON array, no markdown, no explanation.`;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function extractTextBlock(content) {
  if (!Array.isArray(content)) return '';
  return content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

function stripCodeFences(raw = '') {
  let cleaned = String(raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

function extractLikelyJsonArray(raw = '') {
  const text = String(raw || '');
  const start = text.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '[') depth += 1;
    if (ch === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function repairTruncatedJson(raw = '') {
  let text = raw.trim();
  // Remove trailing comma
  text = text.replace(/,\s*$/, '');
  // Remove last incomplete key-value (e.g. trailing `"key": ` or `"key": "partial...`)
  text = text.replace(/,?\s*"[^"]*"\s*:\s*(?:"[^"]*)?$/, '');
  // Close unclosed braces/brackets
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

function tryParseJsonArray(raw = '') {
  const attempts = [];
  const stripped = stripCodeFences(raw);
  attempts.push(stripped);

  const extracted = extractLikelyJsonArray(stripped);
  if (extracted && extracted !== stripped) attempts.push(extracted);

  const relaxed = extracted
    ? extracted
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
    : null;
  if (relaxed && !attempts.includes(relaxed)) attempts.push(relaxed);

  // Truncation repair: try closing unclosed brackets
  const repaired = repairTruncatedJson(stripped);
  if (!attempts.includes(repaired)) attempts.push(repaired);

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // try next strategy
    }
  }

  return null;
}

function blankActivity(overrides = {}) {
  return {
    id: overrides.id || '',
    name: overrides.name || 'Untitled activity',
    city: overrides.city || '',
    venue_name: overrides.venue_name || null,

    location: {
      name: overrides.venue_name || overrides.name || 'Untitled activity',
      address: '',
      lat: null,
      lng: null
    },

    category: overrides.category || 'sightseeing',
    tags: [],
    meal_type: null,

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

  const normalizedCategory = inferCategory(raw);
  const defaults = getCategoryDefaults(normalizedCategory);
  const duration = Number(raw.duration_hours);
  const durationHours = Number.isFinite(duration) && duration > 0 ? duration : defaults.durationHours;

  const name = String(raw.name || 'Untitled activity').trim();
  const type = String(raw.type || 'tour').trim().toLowerCase();
  const city = String(raw.city || fallbackCity).trim();
  const rawVenue = raw.venue_name == null ? '' : String(raw.venue_name).trim();
  const mealTypes = ['food', 'breakfast', 'lunch', 'dinner', 'restaurant'];
  const venue_name = rawVenue || (mealTypes.includes(type) && name ? `${name}, ${city}` : null);

  const rawSuggested = String(raw.suggested_time || '').trim();
  const preferred_time = (rawSuggested && rawSuggested !== '10:00am')
    ? parseTimeString(rawSuggested) : null;

  const bookingType = (() => {
    if (['tour', 'attraction', 'restaurant', 'none'].includes(raw.booking_type)) return raw.booking_type;
    if (type === 'tour' || type === 'show') return 'tour';
    if (['cultural', 'sports'].includes(type)) return 'attraction';
    if (['food', 'breakfast', 'lunch', 'dinner'].includes(type)) return 'restaurant';
    return 'none';
  })();

  const address = String(raw.start_location || raw.location?.address || venue_name || '').trim();

  return {
    id: raw.id,
    name,
    city,
    venue_name,

    location: {
      name: venue_name || name,
      address,
      lat: null,
      lng: null
    },

    category: normalizedCategory,
    tags: [],
    meal_type: inferMealType({ type, name }),

    timing: {
      duration_minutes: parseDurationToMinutes(durationHours),
      opening_hours: String(raw.opening_hours || defaults.openingHours || '').trim(),
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

function normalizeLegacyActivity(raw, fallbackCity = '') {
  return normalizeActivity(raw, fallbackCity);
}

async function planCity(city, profile = null, userId = 'default', travels = [], travelTiming = null, budget = null, numCities = 1, numTravelers = 1, numChildren = 0, lockedActivities = []) {
  const { name, startDate, endDate, leaveTime, notes, accommodations } = city;
  const client = getClient();
  if (!client) {
    const err = new Error('Anthropic API key not configured');
    err.code = 'ANTHROPIC_KEY_MISSING';
    throw err;
  }

  const cityAccommodations = Array.isArray(accommodations) && accommodations.length
    ? accommodations.map((accommodation) => {
      const coordText = (Number.isFinite(Number(accommodation.latitude)) && Number.isFinite(Number(accommodation.longitude)))
        ? ` [${Number(accommodation.latitude)}, ${Number(accommodation.longitude)}]`
        : '';
      return `Accommodation: ${accommodation.address || 'Address missing'}${coordText} | ${accommodation.checkIn || '?'} → ${accommodation.checkOut || '?'}`;
    }).join('\n')
    : 'No accommodations provided for this city yet.';

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

  const { value: pace, desc: paceDesc } = paceDescFromValue(profile?.answers?.pace);
  const nonMealPerDayByPace = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
  const nonMealPerDay = nonMealPerDayByPace[pace];

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
    ? `\n\nTop restaurant research — pick named restaurants from this list to fill the ${minMeals} meal slots above (one per slot). Do NOT generate additional food/restaurant activities beyond the meal target — each slot is one restaurant. Choose ones that fit the day's geographic area relative to the accommodation. Include 1–2 must-order dishes in why_it_fits:\n${restaurantResearch}`
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

  const prompt = `Plan activities for: ${name} (${startDate} to ${endDate}).\n${notes ? `City-specific notes from the traveler: ${notes}\n` : ''}Accommodation context:\n${cityAccommodations}\n\nTravel entry context touching this city:\n${travelContext}\n\nDeparture context:\n${departureContext}\n\nComputed travel-time constraints:\n${travelTimingContext}\n\nThis traveler prefers a ${paceDesc} pace.\n\nACTIVITY COUNT\nGenerate ${minTotal} activities (${minTotal}–${maxTotal} acceptable). Composition: ${minNonMeal} non-meal (${nonMealPerDay}/day) + EXACTLY ${minMeals} meals (1 lunch + 1 dinner per full day, no more). Do not generate additional food/restaurant activities beyond the meal count — if you have many strong restaurant candidates, pick the ${minMeals} best and skip the rest. On arrival/departure days, drop a meal whose natural time falls outside the available window (e.g. drop lunch on a 3pm arrival, drop dinner on an 11am departure) — each dropped meal reduces the count by 1. Use accommodation and travel timing to shape sequencing — lighter arrivals/departures, first/last activities near accommodation or transport hubs.${budgetBlock}${lockedBlock}${webBlock}${restaurantBlock}${insiderBlock}${shoppingBlock}\n\nReturn JSON only.`;

  const learnedSummary = getSummary(userId);
  const effectiveSystemPrompt = learnedSummary
    ? `${SYSTEM_PROMPT}\n\n${learnedSummary}`
    : SYSTEM_PROMPT;

  async function streamMessage(userContent) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 32768,
      system: effectiveSystemPrompt,
      messages: [{ role: 'user', content: userContent }]
    });
    const final = await stream.finalMessage();
    return { text: extractTextBlock(final.content), stop_reason: final.stop_reason };
  }

  const { text: response, stop_reason } = await streamMessage(prompt);
  console.log(`planCity(${name}): stop_reason=${stop_reason}, response_length=${response.length}`);
  let parsed = tryParseJsonArray(response);

  if (!parsed) {
    console.error(`JSON parse failed for ${name} (stop_reason=${stop_reason}), retrying...`);
    console.error(`Raw response (first 500 chars): ${response.slice(0, 500)}`);
    console.error(`Raw response (last 500 chars): ${response.slice(-500)}`);
    const retry = await streamMessage(prompt + '\n\nIMPORTANT: Return ONLY a valid JSON array. No text before or after.');
    parsed = tryParseJsonArray(retry.text);
  }

  if (!parsed) {
    console.error('Failed to parse Claude JSON response after retry.');
    throw new Error(`Claude returned invalid JSON for ${name}.`);
  }

  const normalized = parsed.map((item) => normalizeActivity(item, name));
  await enrichWithPlaceDetails(normalized, name);
  return normalized;
}

module.exports = { planCity, normalizeActivity, normalizeLegacyActivity, blankActivity, SYSTEM_PROMPT };
