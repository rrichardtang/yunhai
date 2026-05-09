const Anthropic = require('@anthropic-ai/sdk');
const { getSummary } = require('./preferences');
const { inferCategory, getCategoryDefaults, paceDescFromValue } = require('./arrangeConfig');
const { searchCityActivities, searchTopRestaurants, searchInsiderTips, searchShoppingDistricts } = require('./braveSearch');
const { enrichWithPlaceDetails } = require('./services/placesEnrich');
const { isLegacyActivity, migrateActivity, parseTimeString, parseDurationToMinutes, inferMealType } = require('../shared/activityMigration');

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `## Role
You are a blunt, opinionated travel planning agent. Your job is to design itineraries tailored to the specific traveler's preferences and profile. You are not a generalist — you filter everything through what this specific user actually enjoys. Be concise. At most 3 sentences per activity. Use provided accommodation and trip entry context to shape recommendation timing and geography.

---


## Decision Framework

Evaluate every activity across five dimensions before recommending it:

| Dimension | What to assess |
|---|---|
| **Fun Factor** | Will it hold attention? Is there energy, novelty, or interactivity? |
| **Disappointment Risk** | Could it feel repetitive, flat, overly ceremonial, or staged? |
| **Cost vs. Payoff** | Is the price justified for what this traveler actually experiences? |
| **Planning Flexibility** | Can it be booked last-minute or adjusted around weather/schedule? |
| **Engagement Type** | Is it interactive, sensory, visceral, or purely observational? |

**Default recommendation rule:**
- Recommend if: Fun Factor is HIGH or MEDIUM and Disappointment Risk is LOW or MEDIUM
- Flag with warning if: Disappointment Risk is HIGH but the traveler may still want it
- Do not recommend if: Fun Factor is LOW, regardless of cultural or historical prestige

When in doubt between two activities, recommend the one that better fits the traveler's stated preferences.

---

## Output Format

Return a JSON array of activity objects. Each object must have these fields:
- name (string)
- type (string: show / tour / food / sports / cultural / walk / sunset / neighborhood / breakfast / lunch / dinner / shopping)
- city (string)
- venue_name (string or null) — the specific place as it appears on Google Maps (e.g. \`Casa Lucio, Madrid\`, \`Colosseum, Rome\`). For meals, this MUST be the restaurant name + city. For generic activities (free time, walks, sunsets, neighborhoods), set to null.
- start_location (string)
- end_location (string)
- why_it_fits (string, 1-2 sentences)
- pitfall (string, 1 sentence)
- booking_advice (string, 1 sentence)
- insider_tips (string or null, 1-2 sentences) — local knowledge a tourist would not know: peak-crowding window, best arrival time, common tourist mistake, neighborhood quirk, "if you do X also do Y" pairing, or destination-specific value/pricing tip (e.g. tax-free refund eligibility, brands cheaper here than at home). If you have no specific, factual tip, return null — never fabricate a generic "arrive early" platitude.
- smarter_alternative (string or null)
- verdict (string: "Recommend" / "Recommend with caveats" / "Skip")
- dedicated_time_block (boolean — true if this requires 2+ hours of committed time)
- suggested_time (string — e.g. "9:00am", "2:00pm", "sunset")
- duration_hours (number)
- duration (string, e.g. "2 hours")
- category (string, e.g. museum / restaurant / park)
- opening_hours (string, e.g. "10:00-18:00" or "12:00-14:30,19:00-22:00")
- estimated_cost_usd (number — estimated cost in USD. Overestimate rather than underestimate. Scale to the city's cost of living. Return 0 for free activities like walks, parks, sunsets.)
- cost_type (string: "per_person" or "per_group" — per_person: any activity where each person pays individually (museum entry, meal, theme park ticket, boat tour ticket, cooking class). per_group: a single price covers the whole group regardless of headcount (private airport transfer, car rental, private guided tour hired for the group, apartment/villa rental). When in doubt, use per_person.)
- booking_type (string: "tour" / "attraction" / "restaurant" / "none" — tour: guided or operator-led experiences booked through tour platforms, e.g. "Guided Walking Tour of Alhambra", "Pub Crawl", "Cooking Class with Local Chef". attraction: standalone venues with their own ticketing website, e.g. "teamLab Borderless", "Colosseum", "Disneyland", "Sagrada Familia". restaurant: a specific named restaurant, e.g. "Sukiyabashi Jiro", "Café Central". none: generic or free activities, e.g. "Morning walk", "Sunset at the beach" — NEVER use "none" for food/breakfast/lunch/dinner activities.)

MANDATORY RULE — meals: Every activity with type food, breakfast, lunch, or dinner MUST name a specific restaurant (not a cuisine, neighborhood, or meal type). The name field must be the restaurant's name, e.g. "Ichiran Ramen Shinjuku", not "Ramen lunch in Shinjuku". The why_it_fits field must mention 1–2 must-order dishes at that restaurant.

MANDATORY RULE — shopping: If the traveler's profile indicates shopping interest (>= 3) and shoppingInterests are listed, generate shopping activities anchored on their stated interests. Each shopping activity MUST: (1) name a specific store, district, or market — never "go shopping in {city}"; (2) set type to "shopping" and booking_type to "none"; (3) include insider_tips covering tax-free refund eligibility for non-EU travelers (where applicable), price comparison vs the traveler's home country if obvious (e.g. Zara, Mango, Massimo Dutti are notably cheaper in Spain than in the US), and the best neighborhood for the category (e.g. Salamanca for luxury, Malasaña for vintage, Druni / Primor for fragrance & beauty deals).

For each activity, provide realistic start and end locations based on the activity description and the city. Use recognizable landmarks, neighborhoods, or points of interest.

Example object:
{
  "name": "Wander Alfama at Dawn",
  "type": "walk",
  "city": "Lisbon",
  "venue_name": null,
  "start_location": "Alfama neighborhood, Lisbon",
  "end_location": "Miradouro da Graça, Lisbon",
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

    verdict: 'Recommend',
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

  const verdictRaw = String(raw.verdict || '').trim();
  const verdict = ['Recommend', 'Recommend with caveats', 'Skip'].includes(verdictRaw)
    ? verdictRaw : 'Recommend';

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

  return {
    id: raw.id,
    name,
    city,
    venue_name,

    location: {
      name: venue_name || name,
      address: String(raw.start_location || '').trim(),
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

    verdict,
    dedicated_time_block: Boolean(raw.dedicated_time_block),
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
  const minMeals = 3 * tripDays;
  const minTotal = minNonMeal + minMeals;

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
    ? `\n\nTop restaurant research — for every food/breakfast/lunch/dinner activity, pick a specific named restaurant from this list. Choose the one that best fits the day's geographic area relative to the accommodation. Include 1–2 must-order dishes in why_it_fits:\n${restaurantResearch}`
    : '';
  const insiderBlock = insiderResearch
    ? `\n\nLocal knowledge / insider notes — use these to populate the insider_tips field with specific, factual tips (peak crowding, best arrival time, common tourist mistakes, neighborhood quirks). Do not copy phrases verbatim; synthesize:\n${insiderResearch}`
    : '';
  const shoppingPerDay = { 3: 0.33, 4: 0.5, 5: 0.75 };
  const shoppingTarget = shoppingActive ? Math.max(1, Math.round((shoppingPerDay[shoppingPerson] || 0.5) * tripDays)) : 0;
  const shoppingBlock = shoppingActive
    ? `\n\nShopping — this traveler shops while traveling (interest level ${shoppingPerson}/5)${shoppingInterests ? `, specifically interested in: ${shoppingInterests}` : ''}. Generate at least ${shoppingTarget} shopping activit${shoppingTarget === 1 ? 'y' : 'ies'} across this stay, anchored on their stated interests. Each must name a specific store, district, or market — see the MANDATORY shopping rule. ${shoppingResearch ? `\n\nShopping research:\n${shoppingResearch}` : ''}`
    : '';

  const travelersDesc = numChildren > 0 ? `${numTravelers} adult${numTravelers > 1 ? 's' : ''} and ${numChildren} child${numChildren > 1 ? 'ren' : ''}` : `${numTravelers} adult${numTravelers > 1 ? 's' : ''}`;
  const budgetBlock = budget && numCities
    ? `\nBudget context: The traveler has a total trip budget of $${budget} for ${travelersDesc} across ${numCities} cit${numCities > 1 ? 'ies' : 'y'} (~$${Math.round(budget / numCities)} per city). Children's tickets/meals are typically ~60% of adult price. Be budget-conscious — prefer good-value activities and flag expensive options with a caveat in the verdict.`
    : '';

  const lockedBlock = Array.isArray(lockedActivities) && lockedActivities.length
    ? `\n\nAlready locked activities — DO NOT re-suggest or generate similar alternatives for these (same name, same venue, same cuisine type, or same attraction type at the same location):\n${
        lockedActivities.map((a) =>
          `- "${a.name}" | type: ${a.type || ''} | category: ${a.category || ''} | location: ${a.start_location || ''} | time: ${a.suggested_time || 'flexible'}, ~${a.duration_hours || 1}h`
        ).join('\n')
      }\n\nNew activities must: (1) not overlap with the above time blocks, (2) not duplicate any of the above venues, cuisines, or experience types, (3) complement the locked set rather than replace it.`
    : '';

  const prompt = `Plan activities for: ${name} (${startDate} to ${endDate}).\n${notes ? `City-specific notes from the traveler: ${notes}\n` : ''}Accommodation context:\n${cityAccommodations}\n\nTravel entry context touching this city:\n${travelContext}\n\nDeparture context:\n${departureContext}\n\nComputed travel-time constraints:\n${travelTimingContext}\n\nThis traveler prefers a ${paceDesc} pace.\n\nMANDATORY ACTIVITY COUNT — this is a hard floor, not a target. Generate AT LEAST ${minTotal} activities total for this ${tripDays}-day stay: ${minNonMeal} non-meal activities (${nonMealPerDay} per day) PLUS ${minMeals} meals (1 breakfast + 1 lunch + 1 dinner per day). Meals count as activities and MUST be included as separate items with named restaurants. Skip meals whose natural time falls outside the day's available window (e.g. no breakfast on a 3pm arrival, no dinner on a 10am departure) — each skipped meal reduces the floor by 1. You may exceed the floor; you may NOT go below it otherwise. Arrival/departure days still need their meals; only reduce non-meal activities on those days if travel timing makes it impossible to fit ${nonMealPerDay}. Use accommodation and travel timing when choosing and sequencing activities (e.g. lighter arrivals/departures, practical first/last activities near accommodation or transport hubs). Respect the computed time windows exactly on arrival/departure/transfer days. Be concise.${budgetBlock}${lockedBlock}${webBlock}${restaurantBlock}${insiderBlock}${shoppingBlock}\n\nReturn JSON only.`;

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
