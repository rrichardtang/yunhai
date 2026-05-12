const DEFAULT_ACTIVITY_CATEGORY_CONFIG = {
  arrival: { durationHours: 1, openingHours: '00:00-23:59' },
  departure: { durationHours: 1, openingHours: '00:00-23:59' },
  museum: { durationHours: 2.5, openingHours: '10:00-18:00' },
  landmark: { durationHours: 1.5, openingHours: '09:00-18:00' },
  park: { durationHours: 1.5, openingHours: '07:00-19:00' },
  neighborhood: { durationHours: 2, openingHours: '09:00-21:00' },
  market: { durationHours: 1.5, openingHours: '09:00-17:00' },
  meal: { durationHours: 1.5, openingHours: '' },
  nightlife: { durationHours: 2, openingHours: '20:00-23:59' },
  show: { durationHours: 2, openingHours: '19:00-23:00' },
  tour: { durationHours: 2.5, openingHours: '09:00-17:00' },
  walk: { durationHours: 1.5, openingHours: '08:00-19:00' },
  sunset: { durationHours: 1, openingHours: '17:30-20:30' },
  sports: { durationHours: 2, openingHours: '10:00-21:00' },
  shopping: { durationHours: 2, openingHours: '10:00-20:00' },
  spa: { durationHours: 2, openingHours: '10:00-20:00' },
  default: { durationHours: 1.5, openingHours: '09:00-18:00' }
};

const LEGACY_MEAL_TYPES = ['food', 'restaurant', 'breakfast', 'lunch', 'dinner', 'supper', 'dining', 'brunch'];
const LEGACY_CULTURE_TYPES = ['cultural', 'gallery'];

const CATEGORY_HINTS = [
  { pattern: /\b(arrival|arrive|check[- ]?in)\b/i, category: 'arrival' },
  { pattern: /\b(depart|departure|check[- ]?out|airport transfer)\b/i, category: 'departure' },
  { pattern: /\b(museum|exhibit|gallery|art)\b/i, category: 'museum' },
  { pattern: /\b(park|garden)\b/i, category: 'park' },
  { pattern: /\b(neighborhood|district|quarter)\b/i, category: 'neighborhood' },
  { pattern: /\b(market|bazaar|souq)\b/i, category: 'market' },
  { pattern: /\b(breakfast|brunch|cafe|lunch|dinner|supper)\b/i, category: 'meal' },
  { pattern: /\b(bar|cocktail|nightlife|club)\b/i, category: 'nightlife' },
  { pattern: /\b(show|concert|theatre|theater|performance)\b/i, category: 'show' },
  { pattern: /\b(tour|day trip|excursion)\b/i, category: 'tour' },
  { pattern: /\b(walk|hike|stroll)\b/i, category: 'walk' },
  { pattern: /\b(sunset)\b/i, category: 'sunset' },
  { pattern: /\b(shop|shopping|boutique|department store|mall|outlet)\b/i, category: 'shopping' }
];

function canonicalizeCategory(raw) {
  if (!raw) return raw;
  if (LEGACY_MEAL_TYPES.includes(raw)) return 'meal';
  if (LEGACY_CULTURE_TYPES.includes(raw)) return 'museum';
  return raw;
}

function inferCategory(activity = {}) {
  const rawCategory = String(activity.category || activity.type || '').trim().toLowerCase();
  if (rawCategory) return canonicalizeCategory(rawCategory);

  const haystack = `${activity.name || ''} ${activity.type || ''} ${activity.suggested_time || ''}`;
  const hint = CATEGORY_HINTS.find((entry) => entry.pattern.test(haystack));
  if (hint) return hint.category;

  return 'default';
}

function isMealActivity(activity = {}) {
  const type = String(activity.type || '').trim().toLowerCase();
  if (type === 'meal') return true;
  if (LEGACY_MEAL_TYPES.includes(type)) return true;
  return inferCategory(activity) === 'meal';
}

const LUNCH_WINDOW = [11 * 60, 14 * 60 + 30];
const DINNER_WINDOW = [17 * 60, 22 * 60];

const PACE_LABELS = {
  1: 'very relaxed',
  2: 'easy-going',
  3: 'moderate',
  4: 'active',
  5: 'non-stop'
};

function paceDescFromValue(n) {
  const v = Math.max(1, Math.min(5, Math.round(Number(n) || 3)));
  return { value: v, desc: PACE_LABELS[v] };
}

function getCategoryDefaults(category = '') {
  const normalized = String(category || '').trim().toLowerCase();
  const canonical = canonicalizeCategory(normalized);
  return DEFAULT_ACTIVITY_CATEGORY_CONFIG[canonical] || DEFAULT_ACTIVITY_CATEGORY_CONFIG.default;
}

module.exports = {
  DEFAULT_ACTIVITY_CATEGORY_CONFIG,
  CATEGORY_HINTS,
  LEGACY_MEAL_TYPES,
  LUNCH_WINDOW,
  DINNER_WINDOW,
  inferCategory,
  isMealActivity,
  canonicalizeCategory,
  getCategoryDefaults,
  PACE_LABELS,
  paceDescFromValue
};
