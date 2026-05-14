const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const { getSummary } = require('./preferences');
const { inferCategory, getCategoryDefaults, paceDescFromValue } = require('./arrangeConfig');

const MEAL_DEBUG_LOG = '/tmp/meal-debug.log';
function mealDebug(line) {
  try { fs.appendFileSync(MEAL_DEBUG_LOG, `${new Date().toISOString()} ${line}\n`); } catch {}
}

const CANONICAL_TYPES = new Set(['tour', 'meal', 'sports', 'museum', 'landmark', 'neighborhood', 'shopping']);
const { searchCityActivities, searchTopRestaurants, searchInsiderTips, searchShoppingDistricts } = require('./braveSearch');
const { enrichWithPlaceDetails } = require('./services/placesEnrich');
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
- category (string, e.g. museum / restaurant / park)
- opening_hours (string, e.g. "10:00-18:00" or "12:00-14:30,19:00-22:00") — MANDATORY for type "meal". Use the restaurant's actual hours from the restaurant research provided. Format: "HH:MM-HH:MM" or "HH:MM-HH:MM,HH:MM-HH:MM" for split-shift venues. If actual hours are not in the research, OMIT the restaurant from your output rather than guessing.
- estimated_cost_usd (number — estimated cost in USD. Overestimate rather than underestimate. Scale to the city's cost of living. Return 0 for free activities like walks, parks, sunsets.)
- cost_type (string: "per_person" or "per_group" — per_person: any activity where each person pays individually (museum entry, meal, theme park ticket, boat tour ticket, cooking class). per_group: a single price covers the whole group regardless of headcount (private airport transfer, car rental, private guided tour hired for the group, apartment/villa rental). When in doubt, use per_person.)
- booking_type (string: "tour" / "attraction" / "restaurant" / "none" — tour: guided or operator-led experiences booked through tour platforms, e.g. "Guided Walking Tour of Alhambra", "Pub Crawl", "Cooking Class with Local Chef". attraction: standalone venues with their own ticketing website, e.g. "teamLab Borderless", "Colosseum", "Disneyland", "Sagrada Familia". restaurant: a specific named restaurant, e.g. "Sukiyabashi Jiro", "Café Central". none: generic or free activities, e.g. "Morning walk", "Sunset at the beach" — NEVER use "none" for type "meal" activities.)

MANDATORY RULE — meals: Every activity with type "meal" MUST name a specific restaurant (not a cuisine, neighborhood, or meal slot). The name field MUST be the restaurant's name as-is (e.g. "Ichiran Ramen Shinjuku", "Sukiyabashi Jiro"). DO NOT prefix the name with "Lunch at" / "Dinner at" / "Breakfast at" / "Brunch at" — the arrange step decides which slot each meal fills based on opening_hours, not the name. The why_it_fits field must mention 1–2 must-order dishes at that restaurant.

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

    category: overrides.category || 'default',
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

  const normalizedCategory = inferCategory(raw);
  const defaults = getCategoryDefaults(normalizedCategory);
  const duration = Number(raw.duration_hours);
  const durationHours = Number.isFinite(duration) && duration > 0 ? duration : defaults.durationHours;

  const type = String(raw.type || '').trim().toLowerCase();
  const isMealType = type === 'meal';

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

    location: {
      name: venue_name || name,
      address,
      lat: null,
      lng: null
    },

    category: normalizedCategory,
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

function normalizeLegacyActivity(raw, fallbackCity = '') {
  return normalizeActivity(raw, fallbackCity);
}

async function planCity(city, profile = null, userId = 'default', travels = [], travelTiming = null, budget = null, numCities = 1, numTravelers = 1, numChildren = 0, lockedActivities = []) {
  const { name, startDate, endDate, leaveTime, notes, accommodations } = city;
  mealDebug(`planCity ENTRY city=${name} dates=${startDate}..${endDate}`);
  const client = getClient();
  if (!client) {
    mealDebug(`planCity ABORT city=${name} reason=no_anthropic_key`);
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

  const prompt = `Plan activities for: ${name} (${startDate} to ${endDate}).\n${notes ? `City-specific notes from the traveler: ${notes}\n` : ''}Accommodation context:\n${cityAccommodations}\n\nTravel entry context touching this city:\n${travelContext}\n\nDeparture context:\n${departureContext}\n\nComputed travel-time constraints:\n${travelTimingContext}\n\nThis traveler prefers a ${paceDesc} pace.\n\nACTIVITY COUNT\nGenerate ${minTotal} activities (${minTotal}–${maxTotal} acceptable). Composition: ${minNonMeal} non-meal (${nonMealPerDay}/day) + AT MOST ${minMeals} meal-type activities total. Slot assignment (lunch vs dinner) is decided downstream by the arrange step — do not pre-assign by name. Names must be the restaurant name as-is, no "Lunch at" / "Dinner at" prefix. If you have more strong restaurant candidates than slots, pick the best ${minMeals} and skip the rest. On arrival/departure days, drop a meal whose natural time falls outside the available window (e.g. drop lunch on a 3pm arrival, drop dinner on an 11am departure) — each dropped meal reduces the count by 1. Use accommodation and travel timing to shape sequencing — lighter arrivals/departures, first/last activities near accommodation or transport hubs.${budgetBlock}${lockedBlock}${webBlock}${restaurantBlock}${insiderBlock}${shoppingBlock}\n\nReturn JSON only.`;

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
  mealDebug(`${name} | claude_response: stop_reason=${stop_reason} length=${response.length} first200=${JSON.stringify(response.slice(0, 200))}`);
  console.log(`planCity(${name}): stop_reason=${stop_reason}, response_length=${response.length}`);
  let parsed = tryParseJsonArray(response);

  if (!parsed) {
    mealDebug(`${name} | parse_failed_first_attempt last200=${JSON.stringify(response.slice(-200))}`);
    console.error(`JSON parse failed for ${name} (stop_reason=${stop_reason}), retrying...`);
    console.error(`Raw response (first 500 chars): ${response.slice(0, 500)}`);
    console.error(`Raw response (last 500 chars): ${response.slice(-500)}`);
    const retry = await streamMessage(prompt + '\n\nIMPORTANT: Return ONLY a valid JSON array. No text before or after.');
    parsed = tryParseJsonArray(retry.text);
  }

  if (!parsed) {
    mealDebug(`${name} | parse_failed_after_retry`);
    console.error('Failed to parse Claude JSON response after retry.');
    throw new Error(`Claude returned invalid JSON for ${name}.`);
  }

  const rawMealCount = parsed.filter((a) => String(a?.type || '').toLowerCase() === 'meal').length;
  const rawTypeBreakdown = parsed.reduce((acc, a) => {
    const t = String(a?.type || '<none>').toLowerCase();
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  mealDebug(`${name} | minMeals=${minMeals} | claude_raw: total=${parsed.length} meals=${rawMealCount} types=${JSON.stringify(rawTypeBreakdown)}`);

  const normalized = parsed.map((item) => normalizeActivity(item, name));
  const normalizedMealCount = normalized.filter((a) => String(a?.category || '').toLowerCase() === 'meal').length;
  const mealsWithHours = normalized.filter((a) => String(a?.category || '').toLowerCase() === 'meal' && a?.timing?.opening_hours).length;
  mealDebug(`${name} | after_normalize: total=${normalized.length} meals=${normalizedMealCount} meals_with_hours=${mealsWithHours}`);

  const validTyped = filterInvalidTypes(normalized, name);
  const validMealCount = validTyped.filter((a) => String(a?.category || '').toLowerCase() === 'meal').length;
  mealDebug(`${name} | after_filterInvalidTypes: total=${validTyped.length} meals=${validMealCount}`);

  const filtered = applyMealPoolCap(validTyped, { city: name, minMeals });
  const finalMealCount = filtered.filter((a) => String(a?.category || '').toLowerCase() === 'meal').length;
  mealDebug(`${name} | after_applyMealPoolCap: total=${filtered.length} meals=${finalMealCount}`);

  try {
    await enrichWithPlaceDetails(filtered, name);
  } catch (e) {
    mealDebug(`${name} | enrichWithPlaceDetails THREW: ${e?.message || e}`);
    throw e;
  }
  mealDebug(`${name} | RETURN total=${filtered.length} meals=${finalMealCount}`);
  return filtered;
}

function filterInvalidTypes(activities, city) {
  const kept = [];
  const dropped = [];
  for (const a of activities) {
    const t = String(a?.category || '').toLowerCase();
    if (CANONICAL_TYPES.has(t)) kept.push(a);
    else dropped.push({ name: a?.name, type: t });
  }
  if (dropped.length) {
    console.warn('[plan] dropped activities with invalid type', { city, dropped });
  }
  return kept;
}

function isMealNormalized(activity) {
  return String(activity?.category || '').toLowerCase() === 'meal';
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

module.exports = { planCity, normalizeActivity, normalizeLegacyActivity, blankActivity, SYSTEM_PROMPT };
