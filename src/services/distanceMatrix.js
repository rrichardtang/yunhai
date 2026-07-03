const commuteCache = require('./commuteCache');
const { debugLog } = require('./debugLog');
const { arrivalBufferMins, departureBufferMins } = require('../../shared/arrangeBuffers');
const { haversineKm, activityCoords } = require('./geo');

const getActivityCoords = activityCoords;

const DISTANCE_MATRIX_BASE_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const COMMUTE_MODE_ICON = {
  transit: '🚇',
  walking: '🚶',
  driving: '🚗'
};
const COMMUTE_MODE_PRIORITY = ['transit', 'driving', 'walking'];

function buildDistanceMatrixQuery(activity = {}) {
  const hotelLat = Number(activity.hotel_latitude);
  const hotelLng = Number(activity.hotel_longitude);
  if (Number.isFinite(hotelLat) && Number.isFinite(hotelLng)) {
    return `${hotelLat},${hotelLng}`;
  }

  const hotelLocation = String(activity.hotel_location || '').trim();
  if (hotelLocation) return hotelLocation;
  return [activity.name, activity.city].filter(Boolean).join(', ').trim();
}

const WALKING_DISTANCE_KM = 1.5;

function isWalkingDistancePair(fromActivity, toActivity) {
  const a = getActivityCoords(fromActivity);
  const b = getActivityCoords(toActivity);
  if (!a || !b) return false;
  return haversineKm(a.lat, a.lng, b.lat, b.lng) < WALKING_DISTANCE_KM;
}

function formatLatLng(lat, lng) {
  if (lat == null || lng == null) return '';
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  if (latitude === 0 && longitude === 0) return '';
  return `${latitude},${longitude}`;
}

const {
  minutesFromTime: parseMinutesFromTime,
  timeFromMinutes,
  extractTimeFromDateTime
} = require('../../shared/timeHelpers');

function pickAccommodation(city = {}) {
  return city?.accommodation?.address ? city.accommodation : null;
}

function resolveLocationQuery({ lat, lng, fallbackText }) {
  const coords = formatLatLng(lat, lng);
  if (coords) return coords;
  const text = String(fallbackText || '').trim();
  return text || '';
}

async function fetchDistanceMatrixLeg({
  origin,
  destination,
  mode = 'driving',
  departureDateTime = '',
  arrivalDateTime = ''
}) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !origin || !destination) return null;

  const params = new URLSearchParams({
    origins: origin,
    destinations: destination,
    mode,
    key: apiKey
  });

  const departureEpoch = Math.floor(new Date(departureDateTime).getTime() / 1000);
  const arrivalEpoch = Math.floor(new Date(arrivalDateTime).getTime() / 1000);
  if (mode === 'driving' && Number.isFinite(departureEpoch) && departureEpoch > 0) {
    params.set('departure_time', String(departureEpoch));
    params.set('traffic_model', 'best_guess');
  }
  if (mode === 'transit') {
    if (Number.isFinite(departureEpoch) && departureEpoch > 0) {
      params.set('departure_time', String(departureEpoch));
    } else if (Number.isFinite(arrivalEpoch) && arrivalEpoch > 0) {
      params.set('arrival_time', String(arrivalEpoch));
    }
  }

  const response = await fetch(`${DISTANCE_MATRIX_BASE_URL}?${params.toString()}`);
  if (!response.ok) return null;

  const data = await response.json();
  if (data?.status !== 'OK') return null;
  const element = data?.rows?.[0]?.elements?.[0] || null;
  if (!element || element.status !== 'OK') return null;

  const inTrafficSeconds = Number(element?.duration_in_traffic?.value || 0);
  const baseSeconds = Number(element?.duration?.value || 0);
  const totalSeconds = inTrafficSeconds || baseSeconds;
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;

  return {
    durationMinutes: Math.max(1, Math.round(totalSeconds / 60)),
    distanceMeters: Number(element?.distance?.value || 0) || null,
    mode
  };
}

async function estimateTravelMinutes({ origin, destination, departureDateTime = '', arrivalDateTime = '' }) {
  const modeCandidates = ['transit', 'driving'];
  for (const mode of modeCandidates) {
    try {
      const leg = await fetchDistanceMatrixLeg({ origin, destination, mode, departureDateTime, arrivalDateTime });
      if (leg?.durationMinutes) return leg;
    } catch {
      // next mode fallback
    }
  }
  return null;
}

async function buildCityTravelTiming(cities = []) {
  const timingByCity = {};
  const sortedCities = Array.isArray(cities)
    ? cities.slice().sort((a, b) => String(a?.startDate || '').localeCompare(String(b?.startDate || '')))
    : [];

  for (let index = 0; index < sortedCities.length; index += 1) {
    const city = sortedCities[index] || {};
    const cityName = String(city?.name || '').trim();
    if (!cityName) continue;

    const firstAccommodation = pickAccommodation(city);
    const lastAccommodation = pickAccommodation(city);
    const logistics = city?.logistics || {};
    const arrivalTime = logistics?.arrival?.time || logistics?.arrival?.customTime
      || extractTimeFromDateTime(city?.travelEntry?.dateTime)
      || '09:00';
    const arrivalDate = String(city?.startDate || '').slice(0, 10);
    const departureDate = String(city?.endDate || city?.startDate || '').slice(0, 10);
    const departureTime = logistics?.departure?.time || logistics?.departure?.customTime || String(city?.leaveTime || '18:00');

    const timing = {
      city: cityName,
      arrivalTravelMinutes: null,
      arrivalAvailableTime: arrivalTime,
      arrivalSummary: '',
      departureTravelMinutes: null,
      departureMustLeaveTime: departureTime,
      departureSummary: '',
      interCityTravelMinutes: null,
      interCitySummary: ''
    };

    const arrivalOrigin = resolveLocationQuery({
      lat: logistics?.arrival?.latitude ?? city?.travelEntry?.entryPointLat,
      lng: logistics?.arrival?.longitude ?? city?.travelEntry?.entryPointLng,
      fallbackText: logistics?.arrival?.location || city?.travelEntry?.entryPoint
    });
    if (arrivalOrigin && firstAccommodation) {
      const destination = resolveLocationQuery({
        lat: firstAccommodation.latitude,
        lng: firstAccommodation.longitude,
        fallbackText: firstAccommodation.address
      });
      const arrivalDateTime = `${arrivalDate}T${arrivalTime}:00`;
      const leg = await estimateTravelMinutes({ origin: arrivalOrigin, destination, departureDateTime: arrivalDateTime, arrivalDateTime });
      if (leg?.durationMinutes) {
        const procBuf = arrivalBufferMins(logistics?.arrival?.mode, logistics?.arrival?.international);
        timing.arrivalTravelMinutes = leg.durationMinutes;
        timing.arrivalProceduralBufferMinutes = procBuf;
        timing.arrivalAvailableTime = timeFromMinutes(parseMinutesFromTime(arrivalTime) + procBuf + leg.durationMinutes);
        const locationLabel = logistics?.arrival?.location || city?.travelEntry?.entryPoint || cityName;
        timing.arrivalSummary = `User arrives at ${locationLabel} at ${arrivalTime}; ${procBuf} min deplaning/customs/transfer + ${leg.durationMinutes} min travel to accommodation; available for activities at ${timing.arrivalAvailableTime}.`;
      }
    }

    const departureLocation = resolveLocationQuery({
      lat: logistics?.departure?.latitude ?? city?.departureLat,
      lng: logistics?.departure?.longitude ?? city?.departureLng,
      fallbackText: logistics?.departure?.location || city?.departureLocation
    });
    if (lastAccommodation && departureLocation) {
      const origin = resolveLocationQuery({
        lat: lastAccommodation.latitude,
        lng: lastAccommodation.longitude,
        fallbackText: lastAccommodation.address
      });
      const departureDateTime = departureDate ? `${departureDate}T${departureTime}:00` : '';
      const leg = await estimateTravelMinutes({ origin, destination: departureLocation, arrivalDateTime: departureDateTime });
      if (leg?.durationMinutes) {
        const procBuf = departureBufferMins(logistics?.departure?.mode, logistics?.departure?.international);
        timing.departureTravelMinutes = leg.durationMinutes;
        timing.departureProceduralBufferMinutes = procBuf;
        timing.departureMustLeaveTime = timeFromMinutes(parseMinutesFromTime(departureTime) - procBuf - leg.durationMinutes);
        timing.departureSummary = `User must depart accommodation by ${timing.departureMustLeaveTime} to reach departure point and clear ${procBuf} min check-in/security by ${departureTime}.`;
      }
    }

    if (index > 0) {
      const previousCity = sortedCities[index - 1] || {};
      const previousLastAccommodation = pickAccommodation(previousCity);
      if (previousLastAccommodation && firstAccommodation) {
        const origin = resolveLocationQuery({
          lat: previousLastAccommodation.latitude,
          lng: previousLastAccommodation.longitude,
          fallbackText: previousLastAccommodation.address
        });
        const destination = resolveLocationQuery({
          lat: firstAccommodation.latitude,
          lng: firstAccommodation.longitude,
          fallbackText: firstAccommodation.address
        });
        const travelDate = String(city?.startDate || '').slice(0, 10);
        const departureRef = `${String(previousCity?.endDate || city?.startDate || '').slice(0, 10)}T${String(previousCity?.leaveTime || '09:00')}:00`;
        const leg = await estimateTravelMinutes({ origin, destination, departureDateTime: departureRef, arrivalDateTime: `${travelDate}T09:00:00` });
        if (leg?.durationMinutes) {
          timing.interCityTravelMinutes = leg.durationMinutes;
          const earliestAfterTransfer = timeFromMinutes((9 * 60) + leg.durationMinutes);
          timing.arrivalAvailableTime = timeFromMinutes(Math.max(parseMinutesFromTime(timing.arrivalAvailableTime), parseMinutesFromTime(earliestAfterTransfer)));
          timing.interCitySummary = `Inter-city transfer from ${previousCity?.name || 'previous city'} accommodation to ${cityName} accommodation takes about ${leg.durationMinutes} min; schedule no activities before ${timing.arrivalAvailableTime} on ${travelDate || 'travel day'}.`;
        }
      }
    }

    timingByCity[cityName] = timing;
  }

  return timingByCity;
}

function isUsableLocation(value = '') {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (normalized.length < 3) return false;
  const invalidValues = new Set(['unknown', 'n/a', 'na', 'none', 'tbd', '-', 'null']);
  return !invalidValues.has(normalized.toLowerCase());
}

function resolveCommuteQuery(activity = {}, locationField) {
  const v2Coords = formatLatLng(activity?.location?.lat, activity?.location?.lng);
  if (v2Coords) return v2Coords;

  const preferredCoords = locationField === 'end_location'
    ? formatLatLng(activity.end_latitude, activity.end_longitude)
    : formatLatLng(activity.start_latitude, activity.start_longitude);
  if (preferredCoords) return preferredCoords;

  const v2Address = String(activity?.location?.address || '').trim();
  if (isUsableLocation(v2Address)) return v2Address;

  const v2VenueName = String(activity?.venue_name || '').trim();
  if (isUsableLocation(v2VenueName)) {
    const city = String(activity?.city || '').trim();
    return city ? `${v2VenueName}, ${city}` : v2VenueName;
  }

  const location = activity?.[locationField];
  if (isUsableLocation(location)) return String(location).trim();
  return buildDistanceMatrixQuery(activity);
}

async function fetchDistanceMatrixDuration({ origin, destination, mode }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { minutes: null, source: 'no-key' };

  const cached = commuteCache.get(origin, destination, mode);
  if (cached !== undefined) {
    return { minutes: cached, source: cached === null ? 'cache-neg' : 'cache-hit' };
  }

  const params = new URLSearchParams({
    origins: origin,
    destinations: destination,
    mode,
    key: apiKey
  });
  if (mode === 'transit' || mode === 'driving') {
    params.set('departure_time', 'now');
  }

  const response = await fetch(`${DISTANCE_MATRIX_BASE_URL}?${params.toString()}`);
  if (!response.ok) {
    debugLog('dm', `HTTP ${response.status} mode=${mode} ${origin} -> ${destination}`);
    commuteCache.setNegative(origin, destination, mode);
    return { minutes: null, source: 'live-fail' };
  }

  const data = await response.json();
  if (data?.status !== 'OK' || !Array.isArray(data?.rows) || !data.rows.length) {
    debugLog('dm', `top-status=${data?.status} mode=${mode} msg="${data?.error_message || ''}" ${origin} -> ${destination}`);
    commuteCache.setNegative(origin, destination, mode);
    return { minutes: null, source: 'live-fail' };
  }

  const element = Array.isArray(data.rows[0]?.elements) && data.rows[0].elements.length
    ? data.rows[0].elements[0]
    : null;

  if (!element || element.status !== 'OK') {
    debugLog('dm', `element-status=${element?.status} mode=${mode} ${origin} -> ${destination}`);
    commuteCache.setNegative(origin, destination, mode);
    return { minutes: null, source: 'live-fail' };
  }

  const durationSeconds = Number(element?.duration?.value || 0);
  if (!durationSeconds) {
    debugLog('dm', `no-duration mode=${mode} ${origin} -> ${destination}`);
    commuteCache.setNegative(origin, destination, mode);
    return { minutes: null, source: 'live-fail' };
  }

  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  commuteCache.set(origin, destination, mode, minutes);
  return { minutes, source: 'live-ok' };
}

// Real walking time for a close pair: query the walking mode alone (transit/
// driving ZERO_RESULTS on short hops), falling back to a haversine estimate
// only if Google returns nothing. Used by both the matrix and per-pair paths.
async function walkingCommute(fromActivity, toActivity, origin, destination) {
  let source = 'walking-skip';
  let minutes = null;
  if (origin && destination) {
    const walk = await fetchDistanceMatrixDuration({ origin, destination, mode: 'walking' });
    source = walk.source;
    minutes = walk.minutes;
  }
  if (!Number.isFinite(minutes)) {
    const a = getActivityCoords(fromActivity);
    const b = getActivityCoords(toActivity);
    minutes = a && b ? Math.max(1, Math.round(haversineKm(a.lat, a.lng, b.lat, b.lng) * 12)) : null;
  }
  return { minutes: Number.isFinite(minutes) ? minutes : null, source };
}

async function getFastestCommuteWithSource(fromActivity, toActivity) {
  const origin = resolveCommuteQuery(fromActivity, 'end_location');
  const destination = resolveCommuteQuery(toActivity, 'start_location');
  if (isWalkingDistancePair(fromActivity, toActivity)) {
    const { minutes, source } = await walkingCommute(fromActivity, toActivity, origin, destination);
    return { minutes, sources: [source] };
  }
  if (!origin || !destination) return { minutes: null, sources: ['no-query'] };

  const sources = [];
  const transit = await fetchDistanceMatrixDuration({ origin, destination, mode: 'transit' });
  sources.push(transit.source);
  if (transit.minutes != null) return { minutes: transit.minutes, sources };

  const driving = await fetchDistanceMatrixDuration({ origin, destination, mode: 'driving' });
  sources.push(driving.source);
  if (driving.minutes != null) return { minutes: driving.minutes, sources };

  // Last resort when transit AND driving both fail (ZERO_RESULTS gaps): real walking
  // time, then haversine estimate — an honest large value beats a silent miss.
  const walk = await walkingCommute(fromActivity, toActivity, origin, destination);
  sources.push(walk.source);
  return { minutes: walk.minutes, sources };
}

async function getCommuteBetweenActivities(fromActivity, toActivity) {
  const origin = resolveCommuteQuery(fromActivity, 'end_location');
  const destination = resolveCommuteQuery(toActivity, 'start_location');

  if (!origin || !destination) {
    return {
      modes: {},
      selectedMode: 'walking',
      durationMinutes: null,
      modeIcon: COMMUTE_MODE_ICON.walking,
      sources: ['no-coords']
    };
  }

  if (isWalkingDistancePair(fromActivity, toActivity)) {
    const { minutes, source } = await walkingCommute(fromActivity, toActivity, origin, destination);
    return {
      modes: Number.isFinite(minutes)
        ? { walking: { durationMinutes: minutes, modeIcon: COMMUTE_MODE_ICON.walking, isWalkingDistance: true } }
        : {},
      selectedMode: 'walking',
      durationMinutes: Number.isFinite(minutes) ? minutes : null,
      modeIcon: COMMUTE_MODE_ICON.walking,
      isWalkingDistance: true,
      sources: [source]
    };
  }

  const sources = [];
  const modeResults = await Promise.all(
    COMMUTE_MODE_PRIORITY.map(async (mode) => {
      try {
        const result = await fetchDistanceMatrixDuration({ origin, destination, mode });
        sources.push(result.source);
        return { mode, durationMinutes: result.minutes };
      } catch {
        sources.push('exception');
        return { mode, durationMinutes: null };
      }
    })
  );

  const modes = {};
  for (const mode of ['transit', 'driving', 'walking']) {
    const d = modeResults.find((r) => r.mode === mode)?.durationMinutes;
    if (Number.isFinite(d) && d > 0) {
      modes[mode] = { durationMinutes: d, modeIcon: COMMUTE_MODE_ICON[mode] };
    }
  }

  const fastest = COMMUTE_MODE_PRIORITY
    .map((mode) => ({ mode, durationMinutes: modes[mode]?.durationMinutes }))
    .filter((result) => Number.isFinite(result.durationMinutes))
    .sort((a, b) => a.durationMinutes - b.durationMinutes)[0];

  const selectedMode = fastest?.mode || 'walking';

  return {
    modes,
    selectedMode,
    durationMinutes: modes[selectedMode]?.durationMinutes ?? null,
    modeIcon: modes[selectedMode]?.modeIcon || COMMUTE_MODE_ICON.walking,
    sources
  };
}

module.exports = {
  DISTANCE_MATRIX_BASE_URL,
  COMMUTE_MODE_ICON,
  COMMUTE_MODE_PRIORITY,
  buildDistanceMatrixQuery,
  formatLatLng,
  parseMinutesFromTime,
  timeFromMinutes,
  extractTimeFromDateTime,
  pickAccommodation,
  resolveLocationQuery,
  fetchDistanceMatrixLeg,
  estimateTravelMinutes,
  buildCityTravelTiming,
  isUsableLocation,
  resolveCommuteQuery,
  fetchDistanceMatrixDuration,
  getCommuteBetweenActivities,
  getFastestCommuteWithSource,
  haversineKm,
  getActivityCoords,
  isWalkingDistancePair,
  WALKING_DISTANCE_KM
};
