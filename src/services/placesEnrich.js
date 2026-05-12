const placesCache = require('./placesCache');
const { inferCategory } = require('../arrangeConfig');

const FOOD_CATEGORIES = new Set(['meal', 'breakfast', 'lunch', 'dinner', 'restaurant', 'food', 'cafe', 'nightlife']);
const VENUE_CATEGORIES = new Set([
  ...FOOD_CATEGORIES,
  'museum', 'landmark', 'market', 'show', 'shopping', 'spa', 'sports'
]);
const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

const PRICE_LEVEL_MAP = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4
};

function isFoodActivity(activity) {
  return FOOD_CATEGORIES.has(inferCategory(activity));
}

function isVenueActivity(activity) {
  return VENUE_CATEGORIES.has(inferCategory(activity));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatOpeningHoursFromPlaces(regularOpeningHours) {
  const periods = regularOpeningHours?.periods;
  if (!Array.isArray(periods) || !periods.length) return null;
  const ranges = new Set();
  for (const p of periods) {
    if (!p?.open) continue;
    const sh = Number(p.open.hour) || 0;
    const sm = Number(p.open.minute) || 0;
    if (!p.close) {
      ranges.add('00:00-23:59');
      continue;
    }
    let eh = Number(p.close.hour) || 0;
    let em = Number(p.close.minute) || 0;
    if (p.close.day !== p.open.day) { eh = 23; em = 59; }
    if (eh * 60 + em <= sh * 60 + sm) { eh = 23; em = 59; }
    ranges.add(`${pad2(sh)}:${pad2(sm)}-${pad2(eh)}:${pad2(em)}`);
  }
  return ranges.size ? [...ranges].sort().join(',') : null;
}

async function fetchPlaceDetails(name, city) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const query = `${name}${city ? `, ${city}` : ''}`;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.priceLevel,places.displayName,places.regularOpeningHours,places.location'
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) return null;
    const tier = PRICE_LEVEL_MAP[place.priceLevel];
    return {
      priceTier: Number.isInteger(tier) ? tier : null,
      openingHours: formatOpeningHoursFromPlaces(place.regularOpeningHours),
      location: place.location || null
    };
  } catch {
    return null;
  }
}

function applyDetails(activity, details) {
  if (!details) return;
  if (Number.isInteger(details.priceTier) && isFoodActivity(activity)) {
    activity.price_tier = details.priceTier;
  }
  if (details.openingHours) {
    const llmHours = activity?.timing?.opening_hours || activity?.opening_hours || '';
    if (llmHours && llmHours !== details.openingHours) {
      console.log(`[places-hours-delta] ${JSON.stringify({
        name: activity.name, llm: llmHours, places: details.openingHours
      })}`);
    }
    if (activity.timing) activity.timing.opening_hours = details.openingHours;
    activity.opening_hours = details.openingHours;
  }
}

async function enrichWithPlaceDetails(activities, cityName) {
  if (!Array.isArray(activities) || activities.length === 0) return activities;
  const targets = activities.filter(isVenueActivity);
  await Promise.all(targets.map(async (activity) => {
    const cached = placesCache.get(activity.name, cityName);
    if (cached && (Number.isInteger(cached.priceTier) || cached.openingHours)) {
      applyDetails(activity, cached);
      return;
    }
    const details = await fetchPlaceDetails(activity.name, cityName);
    if (details && (Number.isInteger(details.priceTier) || details.openingHours)) {
      applyDetails(activity, details);
      placesCache.set(activity.name, cityName, details);
    }
  }));
  return activities;
}

module.exports = {
  enrichWithPlaceDetails,
  enrichWithPriceLevel: enrichWithPlaceDetails,
  isFoodActivity,
  isVenueActivity,
  formatOpeningHoursFromPlaces,
  PRICE_LEVEL_MAP,
  VENUE_CATEGORIES
};
