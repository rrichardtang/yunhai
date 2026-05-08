const DEFAULT_ACTIVITY_CATEGORY_CONFIG = {
  arrival: { durationHours: 1, openingHours: '00:00-23:59' },
  departure: { durationHours: 1, openingHours: '00:00-23:59' },
  museum: { durationHours: 2.5, openingHours: '10:00-18:00' },
  gallery: { durationHours: 2, openingHours: '10:00-18:00' },
  landmark: { durationHours: 1.5, openingHours: '09:00-18:00' },
  park: { durationHours: 1.5, openingHours: '07:00-19:00' },
  neighborhood: { durationHours: 2, openingHours: '09:00-21:00' },
  market: { durationHours: 1.5, openingHours: '09:00-17:00' },
  food: { durationHours: 1.5, openingHours: '12:00-22:00' },
  restaurant: { durationHours: 1.75, openingHours: '12:00-14:30,19:00-22:00' },
  breakfast: { durationHours: 1, openingHours: '07:30-10:30' },
  lunch: { durationHours: 1.25, openingHours: '12:00-14:30' },
  dinner: { durationHours: 1.75, openingHours: '18:30-22:30' },
  nightlife: { durationHours: 2, openingHours: '20:00-23:59' },
  show: { durationHours: 2, openingHours: '19:00-23:00' },
  tour: { durationHours: 2.5, openingHours: '09:00-17:00' },
  walk: { durationHours: 1.5, openingHours: '08:00-19:00' },
  sunset: { durationHours: 1, openingHours: '17:30-20:30' },
  sports: { durationHours: 2, openingHours: '10:00-21:00' },
  cultural: { durationHours: 2, openingHours: '10:00-18:00' },
  shopping: { durationHours: 2, openingHours: '10:00-20:00' },
  spa: { durationHours: 2, openingHours: '10:00-20:00' },
  default: { durationHours: 1.5, openingHours: '09:00-18:00' }
};

const CATEGORY_HINTS = [
  { pattern: /\b(arrival|arrive|check[- ]?in)\b/i, category: 'arrival' },
  { pattern: /\b(depart|departure|check[- ]?out|airport transfer)\b/i, category: 'departure' },
  { pattern: /\b(museum|exhibit)\b/i, category: 'museum' },
  { pattern: /\b(gallery|art)\b/i, category: 'gallery' },
  { pattern: /\b(park|garden)\b/i, category: 'park' },
  { pattern: /\b(neighborhood|district|quarter)\b/i, category: 'neighborhood' },
  { pattern: /\b(market|bazaar|souq)\b/i, category: 'market' },
  { pattern: /\b(breakfast|brunch|cafe)\b/i, category: 'breakfast' },
  { pattern: /\b(lunch)\b/i, category: 'lunch' },
  { pattern: /\b(dinner|supper)\b/i, category: 'dinner' },
  { pattern: /\b(bar|cocktail|nightlife|club)\b/i, category: 'nightlife' },
  { pattern: /\b(show|concert|theatre|theater|performance)\b/i, category: 'show' },
  { pattern: /\b(tour|day trip|excursion)\b/i, category: 'tour' },
  { pattern: /\b(walk|hike|stroll)\b/i, category: 'walk' },
  { pattern: /\b(sunset)\b/i, category: 'sunset' },
  { pattern: /\b(shop|shopping|boutique|department store|mall|outlet)\b/i, category: 'shopping' }
];

function inferCategory(activity = {}) {
  const rawCategory = String(activity.category || activity.type || '').trim().toLowerCase();
  if (rawCategory) return rawCategory;

  const haystack = `${activity.name || ''} ${activity.type || ''} ${activity.suggested_time || ''}`;
  const hint = CATEGORY_HINTS.find((entry) => entry.pattern.test(haystack));
  if (hint) return hint.category;

  return 'default';
}

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
  inferCategory,
  getCategoryDefaults,
  PACE_LABELS,
  paceDescFromValue
};
