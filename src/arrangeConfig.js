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

function isMealActivity(activity = {}) {
  return String(activity?.type || '').trim().toLowerCase() === 'meal';
}

const LUNCH_WINDOW = [11 * 60, 14 * 60 + 30];
const DINNER_WINDOW = [17 * 60, 22 * 60];

const COMMUTE_BUFFER_MIN = 10;
const WALKING_FALLBACK_MIN = 10;

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

function getCategoryDefaults(type = '') {
  const normalized = String(type || '').trim().toLowerCase();
  return DEFAULT_ACTIVITY_CATEGORY_CONFIG[normalized] || DEFAULT_ACTIVITY_CATEGORY_CONFIG.default;
}

module.exports = {
  DEFAULT_ACTIVITY_CATEGORY_CONFIG,
  LUNCH_WINDOW,
  DINNER_WINDOW,
  COMMUTE_BUFFER_MIN,
  WALKING_FALLBACK_MIN,
  isMealActivity,
  getCategoryDefaults,
  PACE_LABELS,
  paceDescFromValue
};
