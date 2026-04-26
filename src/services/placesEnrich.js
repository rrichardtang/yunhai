const placesCache = require('./placesCache');
const { inferCategory } = require('../arrangeConfig');

const FOOD_CATEGORIES = new Set(['breakfast', 'lunch', 'dinner', 'restaurant', 'food', 'cafe', 'nightlife']);
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

async function fetchPriceLevel(name, city) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const query = `${name}${city ? `, ${city}` : ''}`;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.priceLevel,places.displayName'
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1 })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) return null;
    const tier = PRICE_LEVEL_MAP[place.priceLevel];
    return Number.isInteger(tier) ? tier : null;
  } catch {
    return null;
  }
}

async function enrichWithPriceLevel(activities, cityName) {
  if (!Array.isArray(activities) || activities.length === 0) return activities;
  const food = activities.filter(isFoodActivity);
  await Promise.all(food.map(async (activity) => {
    const cached = placesCache.get(activity.name, cityName);
    if (cached && Number.isInteger(cached.priceTier)) {
      activity.price_tier = cached.priceTier;
      return;
    }
    const tier = await fetchPriceLevel(activity.name, cityName);
    if (Number.isInteger(tier)) {
      activity.price_tier = tier;
      placesCache.set(activity.name, cityName, { priceTier: tier });
    }
  }));
  return activities;
}

module.exports = { enrichWithPriceLevel, isFoodActivity, PRICE_LEVEL_MAP };
