const Anthropic = require('@anthropic-ai/sdk');
const { getSummary } = require('./preferences');
const { inferCategory, getCategoryDefaults } = require('./arrangeConfig');
const { searchCityActivities, searchTopRestaurants } = require('./braveSearch');
const { isLegacyActivity, migrateActivity, parseTimeString, parseDurationToMinutes, inferMealType } = require('./activityMigration');

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

For every recommended activity, channel what someone who has visited ten times knows: the arrival window that beats crowds, the exact vantage or seat, what to skip or order, and any prep detail most visitors miss — capture this as insider_tip.

---

## Output Format

Return a JSON array of activity objects. Each object must have these fields:
- name (string)
- type (string: show / tour / food / sports / cultural / walk / sunset / neighborhood / breakfast / lunch / dinner)
- city (string)
- venue_name (string or null) — the specific place as it appears on Google Maps (e.g. \`Casa Lucio, Madrid\`, \`Colosseum, Rome\`). For meals, this MUST be the restaurant name + city. For generic activities (free time, walks, sunsets, neighborhoods), set to null.
- start_location (string)
- end_location (string)
- why_it_fits (string, 1-2 sentences)
- pitfall (string, 1 sentence)
- booking_advice (string, 1 sentence)
- insider_tip (string or null) — Write as if a friend who knows this place intimately is whispering advice before you go: what they'd tell someone they love to make sure they don't just see it, but actually experience it the right way. One sentence: the optimal arrival window, the best physical position, what to skip or specifically request, or a preparation detail most people miss. Null only if no meaningful timing or positioning advantage exists.
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
    insider_tip: null,
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
    insider_tip: raw.insider_tip == null ? null : String(raw.insider_tip).trim() || null,
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

  const pace = Math.max(1, Math.min(5, Math.round(Number(profile?.answers?.pace) || 3)));
  const paceLabels = { 1: 'very relaxed', 2: 'easy-going', 3: 'moderate', 4: 'active', 5: 'non-stop' };
  const paceDesc = paceLabels[pace];

  const [webResearch, restaurantResearch] = await Promise.all([
    searchCityActivities(name),
    searchTopRestaurants(name)
  ]);
  const webBlock = webResearch
    ? `\n\nWeb research (use as supplementary inspiration, not a strict list):\n${webResearch}`
    : '';
  const restaurantBlock = restaurantResearch
    ? `\n\nTop restaurant research — for every food/breakfast/lunch/dinner activity, pick a specific named restaurant from this list. Choose the one that best fits the day's geographic area relative to the accommodation. Include 1–2 must-order dishes in why_it_fits:\n${restaurantResearch}`
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

  const prompt = `Plan activities for: ${name} (${startDate} to ${endDate}).\n${notes ? `City-specific notes from the traveler: ${notes}\n` : ''}Accommodation context:\n${cityAccommodations}\n\nTravel entry context touching this city:\n${travelContext}\n\nDeparture context:\n${departureContext}\n\nComputed travel-time constraints:\n${travelTimingContext}\n\nThis traveler prefers a ${paceDesc} pace. Generate a number of activities proportional to the length of stay and their pace preference — fewer for relaxed travelers, more for active ones. Use accommodation and travel timing when choosing and sequencing activities (e.g. lighter arrivals/departures, practical first/last activities near accommodation or transport hubs). Respect the computed time windows exactly on arrival/departure/transfer days. Be concise.${budgetBlock}${lockedBlock}${webBlock}${restaurantBlock}\n\nReturn JSON only.`;

  const learnedSummary = getSummary(userId);
  const effectiveSystemPrompt = learnedSummary
    ? `${SYSTEM_PROMPT}\n\n${learnedSummary}`
    : SYSTEM_PROMPT;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16384,
    system: effectiveSystemPrompt,
    messages: [{ role: 'user', content: prompt }]
  });

  const response = extractTextBlock(res.content);
  console.log(`planCity(${name}): stop_reason=${res.stop_reason}, response_length=${response.length}`);
  let parsed = tryParseJsonArray(response);

  if (!parsed) {
    console.error(`JSON parse failed for ${name} (stop_reason=${res.stop_reason}), retrying...`);
    console.error(`Raw response (first 500 chars): ${response.slice(0, 500)}`);
    console.error(`Raw response (last 500 chars): ${response.slice(-500)}`);
    const retry = await client.messages.create({
      model: MODEL,
      max_tokens: 16384,
      system: effectiveSystemPrompt,
      messages: [{ role: 'user', content: prompt + '\n\nIMPORTANT: Return ONLY a valid JSON array. No text before or after.' }]
    });
    const retryResponse = extractTextBlock(retry.content);
    parsed = tryParseJsonArray(retryResponse);
  }

  if (!parsed) {
    console.error('Failed to parse Claude JSON response after retry.');
    throw new Error(`Claude returned invalid JSON for ${name}.`);
  }

  return parsed.map((item) => normalizeActivity(item, name));
}

module.exports = { planCity, normalizeActivity, normalizeLegacyActivity, blankActivity, SYSTEM_PROMPT };
