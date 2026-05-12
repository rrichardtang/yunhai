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
  tour: { durationHours: 2.5, openingHours: '09:00-17:00' },
  sports: { durationHours: 2, openingHours: '10:00-21:00' },
  shopping: { durationHours: 2, openingHours: '10:00-20:00' },
  spa: { durationHours: 2, openingHours: '10:00-20:00' },
  default: { durationHours: 1.5, openingHours: '09:00-18:00' }
};

const CATEGORY_HINTS = [
  { pattern: /\b(arrival|arrive|check[- ]?in)\b/i, category: 'arrival' },
  { pattern: /\b(depart|departure|check[- ]?out|airport transfer)\b/i, category: 'departure' },
  { pattern: /\b(museum|exhibit|gallery|art)\b/i, category: 'museum' },
  { pattern: /\b(park|garden)\b/i, category: 'park' },
  { pattern: /\b(neighborhood|district|quarter|walk|hike|stroll|sunset|sightseeing)\b/i, category: 'neighborhood' },
  { pattern: /\b(market|bazaar|souq)\b/i, category: 'market' },
  { pattern: /\b(bar|cocktail|nightlife|club)\b/i, category: 'nightlife' },
  { pattern: /\b(tour|day trip|excursion|show|concert|theatre|theater|performance|class)\b/i, category: 'tour' },
  { pattern: /\b(landmark|monument|castle|palace|cathedral|church)\b/i, category: 'landmark' },
  { pattern: /\b(shop|shopping|boutique|department store|mall|outlet)\b/i, category: 'shopping' }
];

function inferCategory(activity = {}) {
  const raw = String(activity.category || activity.type || '').trim().toLowerCase();
  if (raw) return raw;

  const haystack = `${activity.name || ''} ${activity.type || ''} ${activity.suggested_time || ''}`;
  const hint = CATEGORY_HINTS.find((entry) => entry.pattern.test(haystack));
  if (hint) return hint.category;

  return 'default';
}

function isMealActivity(activity = {}) {
  return String(activity.type || activity.category || '').trim().toLowerCase() === 'meal';
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
  return DEFAULT_ACTIVITY_CATEGORY_CONFIG[normalized] || DEFAULT_ACTIVITY_CATEGORY_CONFIG.default;
}

module.exports = {
  DEFAULT_ACTIVITY_CATEGORY_CONFIG,
  CATEGORY_HINTS,
  LUNCH_WINDOW,
  DINNER_WINDOW,
  inferCategory,
  isMealActivity,
  getCategoryDefaults,
  PACE_LABELS,
  paceDescFromValue
};
