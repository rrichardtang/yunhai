const placesCache = require('./placesCache');
const { debugLog } = require('./debugLog');

const FOOD_TYPES = new Set(['meal', 'nightlife']);
const VENUE_TYPES = new Set([
  ...FOOD_TYPES,
  'museum', 'landmark', 'market', 'tour', 'shopping', 'sports'
]);
const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

const PRICE_LEVEL_MAP = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4
};

function activityType(activity) {
  return String(activity?.type || '').trim().toLowerCase();
}

function isFoodActivity(activity) {
  return FOOD_TYPES.has(activityType(activity));
}

function isVenueActivity(activity) {
  return VENUE_TYPES.has(activityType(activity));
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
  if (!apiKey) {
    debugLog('places-fetch', `FAIL name="${name}" city="${city}" reason=no_api_key`);
    return null;
  }
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
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      debugLog('places-fetch', `FAIL name="${name}" city="${city}" reason=HTTP_${res.status} msg="${errText.slice(0, 200).replace(/"/g, "'")}"`);
      return null;
    }
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) {
      debugLog('places-fetch', `FAIL name="${name}" city="${city}" reason=no_place`);
      return null;
    }
    const tier = PRICE_LEVEL_MAP[place.priceLevel];
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    debugLog('places-fetch', `OK name="${name}" city="${city}" lat=${lat ?? 'none'} lng=${lng ?? 'none'} price=${Number.isInteger(tier) ? tier : 'none'} source=live`);
    return {
      priceTier: Number.isInteger(tier) ? tier : null,
      openingHours: formatOpeningHoursFromPlaces(place.regularOpeningHours),
      location: place.location || null
    };
  } catch (err) {
    debugLog('places-fetch', `FAIL name="${name}" city="${city}" reason=exception msg="${(err?.message || err).toString().slice(0, 200).replace(/"/g, "'")}"`);
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
  const lat = Number(details.location?.latitude);
  const lng = Number(details.location?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    if (!activity.location || typeof activity.location !== 'object') activity.location = {};
    activity.location.lat = lat;
    activity.location.lng = lng;
  }
}

function hasCoords(activity) {
  const lat = Number(activity?.location?.lat);
  const lng = Number(activity?.location?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

async function enrichWithPlaceDetails(activities, cityName) {
  if (!Array.isArray(activities) || activities.length === 0) return activities;
  const targets = activities.filter((a) => !hasCoords(a));
  const withCoordsBefore = activities.length - targets.length;
  debugLog('places-enrich', `START city="${cityName}" activities=${activities.length} targets=${targets.length} with_coords_before=${withCoordsBefore}`);
  function hasUsefulDetails(d) {
    return !!(d && (Number.isInteger(d.priceTier) || d.openingHours || (d.location?.latitude && d.location?.longitude)));
  }
  function hasLocation(d) {
    return !!(d && d.location?.latitude && d.location?.longitude);
  }
  await Promise.all(targets.map(async (activity) => {
    const cached = placesCache.get(activity.name, cityName);
    if (hasUsefulDetails(cached) && hasLocation(cached)) {
      debugLog('places-fetch', `OK name="${activity.name}" city="${cityName}" lat=${cached.location?.latitude} lng=${cached.location?.longitude} source=cache`);
      applyDetails(activity, cached);
      return;
    }
    const details = await fetchPlaceDetails(activity.name, cityName);
    if (hasUsefulDetails(details)) {
      applyDetails(activity, details);
      placesCache.set(activity.name, cityName, details);
    } else if (hasUsefulDetails(cached)) {
      applyDetails(activity, cached);
    }
  }));
  const stillMissing = activities.filter((a) => !hasCoords(a));
  const withCoordsAfter = activities.length - stillMissing.length;
  debugLog('places-enrich', `DONE city="${cityName}" with_coords_after=${withCoordsAfter}/${activities.length}`);
  if (stillMissing.length) {
    const names = stillMissing.slice(0, 10).map((a) => a.name).join(' | ');
    const overflow = stillMissing.length > 10 ? ` (+${stillMissing.length - 10} more)` : '';
    debugLog('places-enrich', `MISSING_COORDS_AFTER ${names}${overflow}`);
  }
  return activities;
}

module.exports = {
  enrichWithPlaceDetails,
  enrichWithPriceLevel: enrichWithPlaceDetails,
  isFoodActivity,
  isVenueActivity,
  formatOpeningHoursFromPlaces,
  PRICE_LEVEL_MAP,
  VENUE_TYPES
};
