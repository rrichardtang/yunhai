const CATEGORY_MAP = {
  breakfast: 'food', lunch: 'food', dinner: 'food', food: 'food', restaurant: 'food',
  tour: 'tour', show: 'tour',
  museum: 'cultural', gallery: 'cultural',
  walk: 'sightseeing', walking: 'sightseeing',
  park: 'nature', garden: 'nature',
  market: 'shopping', shopping: 'shopping',
  spa: 'relaxation', relax: 'relaxation', relaxation: 'relaxation',
  landmark: 'landmark', viewpoint: 'landmark',
  cultural: 'cultural',
  sightseeing: 'sightseeing',
  nature: 'nature'
};

const TAG_MAP = {
  museum: 'museum', gallery: 'gallery',
  walk: 'walking', walking: 'walking',
  market: 'market'
};

const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'cafe']);
const FOOD_TYPES = new Set(['food', 'restaurant']);

function parseTimeString(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
    if (ampm[3] === 'pm' && h !== 12) h += 12;
    if (ampm[3] === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const m = parseInt(h24[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return null;
}

function parseDurationToMinutes(hours) {
  return Math.max(15, Math.round(Number(hours) * 60));
}

function inferMealType(raw) {
  const t = String(raw.type || '').toLowerCase();
  if (MEAL_TYPES.has(t)) return t;
  if (FOOD_TYPES.has(t)) return null;
  const name = String(raw.name || '').toLowerCase();
  if (name.includes('breakfast')) return 'breakfast';
  if (name.includes('lunch')) return 'lunch';
  if (name.includes('dinner')) return 'dinner';
  if (name.includes('cafe') || name.includes('café') || name.includes('coffee')) return 'cafe';
  return null;
}

function normalizeCategory(legacyType) {
  return CATEGORY_MAP[String(legacyType || '').toLowerCase()] || 'sightseeing';
}

function inferTags(legacyType) {
  const key = String(legacyType || '').toLowerCase();
  const tag = TAG_MAP[key];
  return tag ? [tag] : [];
}

function isLegacyActivity(obj) {
  return obj != null && typeof obj === 'object' && obj.timing === undefined;
}

function migrateActivity(a) {
  if (!isLegacyActivity(a)) return a;

  const legacyType = String(a.type || '').toLowerCase();
  const category = normalizeCategory(legacyType);
  const tags = inferTags(legacyType);

  const rawSuggested = String(a.suggested_time || '').trim();
  const preferred_time = (rawSuggested && rawSuggested !== '10:00am')
    ? parseTimeString(rawSuggested)
    : null;

  const durationHours = Number(a.duration_hours);
  const duration_minutes = Number.isFinite(durationHours) && durationHours > 0
    ? parseDurationToMinutes(durationHours)
    : 60;

  const venueName = a.venue_name || null;

  return {
    id: a.id,
    name: a.name,
    city: a.city,
    venue_name: venueName,

    location: {
      name: venueName || a.name,
      address: String(a.start_location || '').trim(),
      lat: null,
      lng: null
    },

    category,
    tags,
    meal_type: inferMealType(a),

    timing: {
      duration_minutes,
      opening_hours: String(a.opening_hours || '').trim(),
      preferred_time,
      fixed: null,
      must_happen_on_day: null
    },

    experience: {
      intensity: 'medium',
      is_highlight: false
    },

    booking: {
      type: (['tour', 'attraction', 'restaurant', 'none'].includes(a.booking_type) ? a.booking_type : 'none'),
      links: Array.isArray(a.booking_links) ? a.booking_links : [],
      reference: null
    },

    cost: {
      estimated_usd: (Number.isFinite(Number(a.estimated_cost_usd)) && Number(a.estimated_cost_usd) >= 0)
        ? Number(a.estimated_cost_usd) : null,
      type: a.cost_type === 'per_group' ? 'per_group' : 'per_person'
    },

    verdict: a.verdict || 'Recommend',
    dedicated_time_block: Boolean(a.dedicated_time_block),

    why_it_fits: String(a.why_it_fits || '').trim(),
    pitfall: String(a.pitfall || '').trim(),
    booking_advice: String(a.booking_advice || '').trim(),
    insider_tip: a.insider_tip == null ? null : String(a.insider_tip).trim() || null,
    smarter_alternative: a.smarter_alternative == null ? null : String(a.smarter_alternative).trim()
  };
}

module.exports = { isLegacyActivity, migrateActivity, parseTimeString, parseDurationToMinutes, inferMealType };
