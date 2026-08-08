const placesCache = require('./placesCache');
const { debugLog } = require('./debugLog');
const { fetchWithTimeout } = require('./fetchWithTimeout');
const { haversineKm } = require('./geo');

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

const ALL_DAY = '00:00-23:59';

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
      ranges.add(ALL_DAY);
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

const CITY_BIAS_RADIUS_M = 30000;
// Search is biased to the city centre, but the reject radius has to clear a
// full day trip: Meili Snow Mountain is 104km from Shangri-La and Baishuitai
// ~60km, and rejecting those threw away correct coordinates, leaving arrange to
// guess a commute for a three-hour drive. 150km still catches a venue that
// resolved to the wrong province.
const CITY_REJECT_RADIUS_KM = 150;
const PHOTO_MAX_WIDTH_PX = 800;

// Resolves a photo resource name to a public googleusercontent URL. skipHttpRedirect
// returns the URL as JSON instead of a 302, so the API key never reaches the client.
async function fetchPlacePhotoUrl(photoName) {
  try {
    const res = await fetchWithTimeout(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${PHOTO_MAX_WIDTH_PX}&skipHttpRedirect=true`,
      { headers: { 'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.photoUri || null;
  } catch {
    return null;
  }
}

async function fetchPlaceDetails(name, city, cityCenter = null) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    debugLog('places-fetch', `FAIL name="${name}" city="${city}" reason=no_api_key`);
    return null;
  }
  const query = `${name}${city ? `, ${city}` : ''}`;
  const body = { textQuery: query, maxResultCount: 1 };
  if (cityCenter && Number.isFinite(cityCenter.lat) && Number.isFinite(cityCenter.lng)) {
    body.locationBias = {
      circle: {
        center: { latitude: cityCenter.lat, longitude: cityCenter.lng },
        radius: CITY_BIAS_RADIUS_M
      }
    };
  }
  try {
    const res = await fetchWithTimeout(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.priceLevel,places.displayName,places.regularOpeningHours,places.location,places.photos'
      },
      body: JSON.stringify(body)
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
      // Distinguished from the null returns above: those are transient (no key,
      // HTTP error, timeout) and must never be cached or treated as a ghost.
      return { miss: 'no_place' };
    }
    const tier = PRICE_LEVEL_MAP[place.priceLevel];
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    if (cityCenter && Number.isFinite(lat) && Number.isFinite(lng)) {
      const distKm = haversineKm(cityCenter.lat, cityCenter.lng, lat, lng);
      if (distKm > CITY_REJECT_RADIUS_KM) {
        debugLog('places-fetch', `REJECT name="${name}" city="${city}" reason=too_far_from_city dist_km=${distKm.toFixed(1)} lat=${lat} lng=${lng}`);
        // Carries no usable detail, so callers treat it as a miss — but the
        // reason distinguishes an invented venue from a real one out of range.
        return { rejected: 'too_far', distanceKm: distKm };
      }
    }
    // photoName is the stable resource id; photoUri expires, so keeping the name
    // alongside it leaves a cheap refresh path when a cached URL goes stale.
    const photoName = place.photos?.[0]?.name || null;
    const imageUrl = photoName ? await fetchPlacePhotoUrl(photoName) : null;
    debugLog('places-fetch', `OK name="${name}" city="${city}" lat=${lat ?? 'none'} lng=${lng ?? 'none'} price=${Number.isInteger(tier) ? tier : 'none'} photo=${imageUrl ? 'yes' : 'no'} source=live`);
    return {
      priceTier: Number.isInteger(tier) ? tier : null,
      openingHours: formatOpeningHoursFromPlaces(place.regularOpeningHours),
      location: place.location || null,
      displayName: place.displayName?.text || null,
      photoName,
      imageUrl
    };
  } catch (err) {
    debugLog('places-fetch', `FAIL name="${name}" city="${city}" reason=exception msg="${(err?.message || err).toString().slice(0, 200).replace(/"/g, "'")}"`);
    return null;
  }
}

function applyDetails(activity, details) {
  if (!details) return;
  if (Number.isInteger(details.priceTier) && isFoodActivity(activity)) {
    activity.price_level = details.priceTier;
  }
  const llmHours = activity?.timing?.opening_hours || activity?.opening_hours || '';
  // ALL_DAY is what Places returns for a district or any venue with no posted
  // hours — the absence of hours data, not a schedule. Letting it overwrite the
  // model's window turned "Lijiang Old Town Night Wander" into an activity
  // arrange could book at 08:00.
  if (details.openingHours && !(details.openingHours === ALL_DAY && llmHours)) {
    if (llmHours && llmHours !== details.openingHours) {
      debugLog('places-hours-delta', JSON.stringify({
        name: activity.name, llm: llmHours, places: details.openingHours
      }));
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
  if (details.imageUrl && !activity.imageUrl) activity.imageUrl = details.imageUrl;
}

// venue_name is the model's Google-Maps-resolvable place ("Casa Lucio, Madrid");
// name is a descriptive label ("Zhuanshan Temple Kora Circuit") that Places
// resolves to whatever sounds closest. Same preference distanceMatrix and the
// activity add/replace routes already apply. Unstructured activities carry a
// null venue_name by design, so the label is all there is to search on.
function placesQuery(activity) {
  return String(activity?.venue_name || '').trim() || activity?.name;
}

function hasCoords(activity) {
  const rawLat = activity?.location?.lat;
  const rawLng = activity?.location?.lng;
  if (rawLat == null || rawLng == null) return false;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

// onOutcome is instrumentation for the model bake-off: it reports per activity
// whether the venue resolved, and the model's opening hours before applyDetails
// replaces them with the real ones — that comparison is unrecoverable
// afterwards. Production callers omit it.
async function enrichWithPlaceDetails(activities, cityName, cityCenter = null, onOutcome = null) {
  if (!Array.isArray(activities) || activities.length === 0) return activities;
  const report = (activity, status, details) => {
    if (!onOutcome) return;
    onOutcome({
      name: activity.name,
      type: activity.type,
      venueName: activity.venue_name || null,
      status,
      distanceKm: details?.distanceKm ?? null,
      llmHours: activity?.timing?.opening_hours || activity?.opening_hours || null,
      placesHours: details?.openingHours || null
    });
  };
  const targets = activities.filter((a) => !hasCoords(a) || !a.imageUrl);
  const withCoordsBefore = activities.length - activities.filter((a) => !hasCoords(a)).length;
  debugLog('places-enrich', `START city="${cityName}" activities=${activities.length} targets=${targets.length} with_coords_before=${withCoordsBefore} bias=${cityCenter ? `${cityCenter.lat},${cityCenter.lng}` : 'none'}`);
  function hasUsefulDetails(d) {
    return !!(d && (Number.isInteger(d.priceTier) || d.openingHours || d.imageUrl || (d.location?.latitude && d.location?.longitude)));
  }
  function hasLocation(d) {
    return !!(d && d.location?.latitude && d.location?.longitude);
  }
  // Activities resolve concurrently, so several at one venue all miss the disk
  // cache at the same instant and fetch it separately — one Shangri-La run spent
  // 10 lookups on 4 venues, each photo hit billed twice over. Sharing the
  // in-flight promise collapses them. The map lives for this call only.
  // Flagged rather than deleted: a no_place on a named venue is a likely
  // invention, but deleting on it would empty an itinerary the moment Places has
  // a bad day. An activity with venue_name null resolved nothing by design and is
  // not a ghost.
  const markUnverified = (activity) => {
    if (activity?.venue_name) activity.unverified = true;
  };
  const inFlight = new Map();
  const resolveVenue = (name) => {
    if (!inFlight.has(name)) inFlight.set(name, fetchPlaceDetails(name, cityName, cityCenter));
    return inFlight.get(name);
  };
  await Promise.all(targets.map(async (activity) => {
    const lookupName = placesQuery(activity);
    const cached = placesCache.get(lookupName, cityName);
    // Entries written before photo support lack the key entirely. Without this the
    // 90-day cache would serve permanently photo-less hits for every known venue.
    const cacheCoversPhotos = cached && Object.prototype.hasOwnProperty.call(cached, 'photoName');
    if (hasUsefulDetails(cached) && hasLocation(cached) && cacheCoversPhotos) {
      const cLat = Number(cached.location?.latitude);
      const cLng = Number(cached.location?.longitude);
      if (cityCenter && Number.isFinite(cLat) && Number.isFinite(cLng)
        && haversineKm(cityCenter.lat, cityCenter.lng, cLat, cLng) > CITY_REJECT_RADIUS_KM) {
        debugLog('places-fetch', `REJECT name="${lookupName}" city="${cityName}" reason=too_far_cached lat=${cLat} lng=${cLng}`);
      } else {
        debugLog('places-fetch', `OK name="${lookupName}" city="${cityName}" lat=${cLat} lng=${cLng} source=cache`);
        report(activity, 'resolved', cached);
        applyDetails(activity, cached);
        return;
      }
    }
    if (cached?.miss) {
      debugLog('places-fetch', `SKIP name="${lookupName}" city="${cityName}" reason=cached_miss`);
      markUnverified(activity);
      report(activity, 'no_place', null);
      return;
    }
    const details = await resolveVenue(lookupName);
    if (hasUsefulDetails(details)) {
      report(activity, 'resolved', details);
      applyDetails(activity, details);
      // Aliasing under Google's own name means the next run resolves any phrasing
      // it already knows — the cache learns the synonyms instead of us guessing.
      placesCache.set(lookupName, cityName, details, [details.displayName].filter(Boolean));
    } else if (hasUsefulDetails(cached)) {
      report(activity, 'resolved', cached);
      applyDetails(activity, cached);
    } else {
      // Only a genuine no_place is cacheable or a ghost. A null here is transient
      // — missing key, HTTP error, timeout — and freezing that into the cache
      // would outlive the outage that caused it.
      if (details?.miss === 'no_place') {
        placesCache.setMiss(lookupName, cityName);
        markUnverified(activity);
      }
      report(activity, details?.rejected === 'too_far' ? 'too_far' : 'no_place', details);
    }
  }));
  const stillMissing = activities.filter((a) => !hasCoords(a));
  const withCoordsAfter = activities.length - stillMissing.length;
  const withPhotos = activities.filter((a) => a.imageUrl).length;
  debugLog('places-enrich', `DONE city="${cityName}" with_coords_after=${withCoordsAfter}/${activities.length} with_photos=${withPhotos}/${activities.length}`);
  if (stillMissing.length) {
    const names = stillMissing.slice(0, 10).map((a) => a.name).join(' | ');
    const overflow = stillMissing.length > 10 ? ` (+${stillMissing.length - 10} more)` : '';
    debugLog('places-enrich', `MISSING_COORDS_AFTER ${names}${overflow}`);
  }
  return activities;
}

module.exports = {
  enrichWithPlaceDetails,
  isFoodActivity,
  isVenueActivity,
  formatOpeningHoursFromPlaces,
  ALL_DAY,
  PRICE_LEVEL_MAP,
  VENUE_TYPES
};
