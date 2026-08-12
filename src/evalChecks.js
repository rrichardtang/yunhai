// Deterministic quality checks over a finished activity list.
//
// Every check here encodes a defect the 2026-08-08 blind read found by hand
// (changelog). None of them needs an LLM, so they run keyless in `npm test` and
// against saved lists for free — which is the point: a human read cost real
// money to discover these, and a `for` loop is enough to keep them from coming
// back. What is left over for the judge is only what genuinely needs reading.
const { shortCity } = require('./services/imageQuery');

// `nightlife` and `park` are absent from CANONICAL_TYPES in claude.js, so
// filterInvalidTypes drops anything typed that way and a bar crawl arrives as
// some other type. Those two axes match on wording instead; the rest map to a
// real type and are counted exactly.
const PROFILE_AXES = [
  { key: 'structuredTours', label: 'guided tours', type: 'tour' },
  { key: 'museumPerson', label: 'museums', type: 'museum' },
  { key: 'shoppingPerson', label: 'shopping', type: 'shopping' },
  { key: 'foodTravel', label: 'meals', type: 'meal' },
  { key: 'nightlifeBars', label: 'nightlife', pattern: /\b(bar|bars|pub|pubs|club|clubbing|nightlife|night-life|cocktail|crawl|speakeasy)\b/i },
  { key: 'livePerformances', label: 'live performances', pattern: /\b(show|performance|concert|theatre|theater|opera|recital|cabaret|live music)\b/i }
];

// The pitfall arguing against its own activity. SYSTEM_PROMPT_GPT_LEAN carries
// "Drop any activity whose own pitfall argues against doing it" — this is the
// check that notices if that line ever stops working.
const PITFALL_CONTRADICTIONS = [
  { pattern: /\bovernight\b/i, why: 'needs an overnight stay' },
  { pattern: /requires?\s+(a\s+|an\s+)?(second|extra|additional)\s+day/i, why: 'needs a second day' },
  { pattern: /not\s+(feasible|possible|realistic|doable|advisable)\s+(in|as)\s+(one|a\s+single)\s+day/i, why: 'not doable in a day' },
  { pattern: /\b(multi-day|two-day|2-day|three-day|3-day)\b/i, why: 'is a multi-day trip' },
  { pattern: /\b(brutal|punishing|gruelling|grueling|exhausting)\b/i, why: 'is described as punishing' }
];

const typeOf = (activity) => String(activity?.type || '').trim().toLowerCase();
const textOf = (activity) => `${activity?.name || ''} ${activity?.venue_name || ''} ${activity?.why_it_fits || ''}`;

function normalizeVenue(activity) {
  const raw = String(activity?.venue_name || '').trim();
  if (!raw) return '';
  // normalizeActivity spells a venue-less meal as "Name, City", so the city has
  // to come off or two entries for the same restaurant look distinct.
  const withoutCity = raw.replace(new RegExp(`,\\s*${shortCity(activity?.city)}\\s*$`, 'i'), '');
  return withoutCity.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function ratingFor(profile, key) {
  const value = Number(profile?.answers?.[key]);
  return Number.isFinite(value) ? Math.max(1, Math.min(5, Math.round(value))) : null;
}

function matchesAxis(activity, axis) {
  return axis.type ? typeOf(activity) === axis.type : axis.pattern.test(textOf(activity));
}

// Symmetric on purpose. Suppressing tours for a 1/5 traveler was the lean
// prompt's win, so the failure mode a future edit is most likely to introduce is
// suppressing them for everyone — which only an under-delivery arm can see.
function typeMixVsProfile(activities, profile) {
  const overThreshold = Math.max(2, Math.ceil(activities.length * 0.1));
  const findings = [];

  for (const axis of PROFILE_AXES) {
    const rating = ratingFor(profile, axis.key);
    if (rating === null) continue;
    const matched = activities.filter((a) => matchesAxis(a, axis));

    if (rating <= 2 && matched.length >= overThreshold) {
      findings.push({
        check: 'typeMixVsProfile',
        severity: 'high',
        detail: `${matched.length} ${axis.label} against ${axis.key} ${rating}/5`,
        names: matched.map((a) => a.name)
      });
    }
    if (rating >= 4 && matched.length === 0) {
      findings.push({
        check: 'typeMixVsProfile',
        severity: 'high',
        detail: `no ${axis.label} against ${axis.key} ${rating}/5`,
        names: []
      });
    }
  }
  return findings;
}

// distinct% already tried to catch this and missed: it keys on Places
// coordinates, and Places collapses separate old-town restaurants onto one
// point. The venue name is what the model actually chose, so it is the honest
// key. Exact normalized matches only — near-duplicates stay for the judge.
function repeatedVenues(activities) {
  const byVenue = new Map();
  for (const activity of activities) {
    const key = normalizeVenue(activity);
    if (!key) continue;
    if (!byVenue.has(key)) byVenue.set(key, []);
    byVenue.get(key).push(activity);
  }

  const findings = [];
  for (const [, group] of byVenue) {
    if (group.length < 2) continue;
    const meals = group.filter((a) => typeOf(a) === 'meal');
    findings.push({
      check: 'repeatedVenues',
      severity: meals.length >= 2 ? 'high' : 'medium',
      detail: `"${group[0].venue_name}" used ${group.length}x${meals.length >= 2 ? ` (${meals.length} of them meals)` : ''}`,
      names: group.map((a) => a.name)
    });
  }
  return findings;
}

// Sonnet filed Tiger Leaping Gorge under Shangri-La with venue city Lijiang, and
// Places snapped it to a plausible coordinate — so it scored as a clean resolve
// and no existing column saw it.
// Two ways this goes wrong, and the second is the one that actually happened:
// the gorge entry declared city "Shangri-La" while its venue_name read "Tiger
// Leaping Gorge, Lijiang". Reading a.city alone sees nothing. The venue text is
// only compared against the trip's own other cities, so a trailing province or
// country in an address cannot masquerade as a mismatch.
function venueCityMismatch(activities, scenarioCity, otherCities = []) {
  const expected = cityStem(scenarioCity);
  if (!expected) return [];

  const foreignCities = otherCities
    .map((entry) => ({ name: shortCity(entry?.name || entry), stem: cityStem(entry?.name || entry), pattern: cityNamePattern(entry?.name || entry) }))
    .filter((c) => c.pattern && c.stem && c.stem !== expected);

  const findings = [];
  for (const activity of activities) {
    const declared = cityStem(activity?.city);
    if (declared && declared !== expected) {
      findings.push({
        check: 'venueCityMismatch',
        severity: 'high',
        detail: `"${activity.name}" is filed under ${shortCity(activity.city)}, list is ${shortCity(scenarioCity)}`,
        names: [activity.name]
      });
      continue;
    }

    const venueText = `${activity?.venue_name || ''} ${activity?.location?.address || ''}`;
    const foreign = foreignCities.find((c) => c.pattern.test(venueText));
    if (foreign) {
      findings.push({
        check: 'venueCityMismatch',
        severity: 'high',
        detail: `"${activity.name}" is filed under ${shortCity(scenarioCity)} but its venue is in ${foreign.name}`,
        names: [activity.name]
      });
    }
  }
  return findings;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A city's own name is rarely how an activity spells it: the trip carries
// "Shangri-La City, Diqing Tibetan Autonomous Prefecture, Yunnan, China" and the
// activity writes "Shangri-La". Comparing the full short names called 29 of 30
// activities a city mismatch and buried the one real one, so every comparison
// here runs on the bare stem.
const ADMIN_SUFFIX = /\s+(City|Prefecture|Province|Municipality|Metropolitan Area)$/i;

function cityStem(cityName) {
  return shortCity(cityName).replace(ADMIN_SUFFIX, '').trim().toLowerCase();
}

function cityNamePattern(cityName) {
  const short = shortCity(cityName);
  if (!short) return null;
  const variants = [...new Set([short, short.replace(ADMIN_SUFFIX, '')])].map(escapeRegex);
  return new RegExp(`\\b(${variants.join('|')})\\b`, 'i');
}

// The 10-hour "Lijiang to Shangri-La Scenic Drive (Day Trip)" on an itinerary
// that moves to Shangri-La five days later.
function crossCityDayTrips(activities, otherCities = []) {
  const findings = [];
  for (const other of otherCities) {
    const name = shortCity(other?.name || other);
    const pattern = cityNamePattern(other?.name || other);
    if (!pattern) continue;
    const matched = activities.filter((a) => pattern.test(textOf(a)));
    if (!matched.length) continue;
    findings.push({
      check: 'crossCityDayTrips',
      severity: 'high',
      detail: `${matched.length} activit${matched.length === 1 ? 'y' : 'ies'} reference ${name}, a city the traveler stays in separately`,
      names: matched.map((a) => a.name)
    });
  }
  return findings;
}

function selfContradictingPitfall(activities) {
  const findings = [];
  for (const activity of activities) {
    const pitfall = String(activity?.pitfall || '');
    if (!pitfall) continue;
    const hit = PITFALL_CONTRADICTIONS.find((rule) => rule.pattern.test(pitfall));
    if (!hit) continue;
    findings.push({
      check: 'selfContradictingPitfall',
      severity: 'medium',
      detail: `"${activity.name}" ${hit.why}, by its own pitfall`,
      names: [activity.name]
    });
  }
  return findings;
}

// applyMealPoolCap silently deleted every meal that arrived without opening
// hours, and the report displayed that as "the model returned no meals". A
// count with the stay length beside it is what would have caught it in one line.
function mealCoverage(activities, days) {
  const meals = activities.filter((a) => typeOf(a) === 'meal');
  if (!days || meals.length >= days) return [];
  return [{
    check: 'mealCoverage',
    severity: meals.length === 0 ? 'high' : 'medium',
    detail: `${meals.length} meals for a ${days}-day stay`,
    names: meals.map((a) => a.name)
  }];
}

function stayDays(city = {}) {
  const start = Date.parse(city.startDate);
  const end = Date.parse(city.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

function runChecks(activities = [], scenario = {}) {
  const city = scenario.city || {};
  const findings = [
    ...typeMixVsProfile(activities, scenario.profile),
    ...repeatedVenues(activities),
    ...venueCityMismatch(activities, city.name, scenario.otherCities),
    ...crossCityDayTrips(activities, scenario.otherCities),
    ...selfContradictingPitfall(activities),
    ...mealCoverage(activities, stayDays(city))
  ];

  const byCheck = {};
  for (const finding of findings) byCheck[finding.check] = (byCheck[finding.check] || 0) + 1;
  return { findings, byCheck, total: findings.length };
}

module.exports = {
  runChecks,
  typeMixVsProfile,
  repeatedVenues,
  venueCityMismatch,
  crossCityDayTrips,
  selfContradictingPitfall,
  mealCoverage,
  stayDays,
  PROFILE_AXES
};
