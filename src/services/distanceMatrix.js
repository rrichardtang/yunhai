const commuteCache = require('./commuteCache');

const DISTANCE_MATRIX_BASE_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const COMMUTE_MODE_ICON = {
  transit: '🚇',
  walking: '🚶',
  driving: '🚗',
  bicycling: '🚴'
};
const COMMUTE_MODE_PRIORITY = ['transit', 'driving', 'walking'];

function normalizeTravelMode(mode = '') {
  const m = String(mode || '').toLowerCase();
  if (m === 'transit' || m === 'walking' || m === 'driving' || m === 'bicycling') return m;
  return 'walking';
}

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

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getActivityCoords(activity) {
  const lat = Number(activity?.location?.lat);
  const lng = Number(activity?.location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  const sLat = Number(activity?.start_latitude);
  const sLng = Number(activity?.start_longitude);
  if (Number.isFinite(sLat) && Number.isFinite(sLng)) return { lat: sLat, lng: sLng };
  return null;
}

function isWalkingDistancePair(fromActivity, toActivity) {
  const a = getActivityCoords(fromActivity);
  const b = getActivityCoords(toActivity);
  if (!a || !b) return false;
  return haversineKm(a.lat, a.lng, b.lat, b.lng) < WALKING_DISTANCE_KM;
}

function formatLatLng(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
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
        timing.arrivalTravelMinutes = leg.durationMinutes;
        timing.arrivalAvailableTime = timeFromMinutes(parseMinutesFromTime(arrivalTime) + leg.durationMinutes);
        const locationLabel = logistics?.arrival?.location || city?.travelEntry?.entryPoint || cityName;
        timing.arrivalSummary = `User arrives at ${locationLabel} at ${arrivalTime}, ${leg.durationMinutes} min travel to accommodation, available for activities at ${timing.arrivalAvailableTime}.`;
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
        timing.departureTravelMinutes = leg.durationMinutes;
        timing.departureMustLeaveTime = timeFromMinutes(parseMinutesFromTime(departureTime) - leg.durationMinutes);
        timing.departureSummary = `User must depart by ${timing.departureMustLeaveTime} to reach departure point by ${departureTime}.`;
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
  if (!apiKey) return null;

  const cached = commuteCache.get(origin, destination, mode);
  if (cached != null) return cached;

  const params = new URLSearchParams({
    origins: origin,
    destinations: destination,
    mode,
    key: apiKey
  });

  const response = await fetch(`${DISTANCE_MATRIX_BASE_URL}?${params.toString()}`);
  if (!response.ok) return null;

  const data = await response.json();
  if (data?.status !== 'OK' || !Array.isArray(data?.rows) || !data.rows.length) return null;

  const element = Array.isArray(data.rows[0]?.elements) && data.rows[0].elements.length
    ? data.rows[0].elements[0]
    : null;

  if (!element || element.status !== 'OK') return null;

  const durationSeconds = Number(element?.duration?.value || 0);
  if (!durationSeconds) return null;

  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  commuteCache.set(origin, destination, mode, minutes);
  return minutes;
}

async function getFastestCommuteMinutes(fromActivity, toActivity) {
  if (isWalkingDistancePair(fromActivity, toActivity)) return null;

  const origin = resolveCommuteQuery(fromActivity, 'end_location');
  const destination = resolveCommuteQuery(toActivity, 'start_location');
  if (!origin || !destination) return null;

  let minutes = await fetchDistanceMatrixDuration({ origin, destination, mode: 'transit' });
  if (minutes == null) {
    minutes = await fetchDistanceMatrixDuration({ origin, destination, mode: 'driving' });
  }
  return minutes;
}

async function getCommuteBetweenActivities(fromActivity, toActivity) {
  const origin = resolveCommuteQuery(fromActivity, 'end_location');
  const destination = resolveCommuteQuery(toActivity, 'start_location');

  const defaultModes = {
    transit: { durationMinutes: null, modeIcon: COMMUTE_MODE_ICON.transit },
    driving: { durationMinutes: null, modeIcon: COMMUTE_MODE_ICON.driving },
    walking: { durationMinutes: null, modeIcon: COMMUTE_MODE_ICON.walking }
  };

  if (!origin || !destination) {
    return {
      modes: defaultModes,
      selectedMode: 'transit',
      durationMinutes: null,
      modeIcon: COMMUTE_MODE_ICON.transit
    };
  }

  if (isWalkingDistancePair(fromActivity, toActivity)) {
    return {
      modes: {
        transit: { durationMinutes: null, modeIcon: COMMUTE_MODE_ICON.transit },
        driving: { durationMinutes: null, modeIcon: COMMUTE_MODE_ICON.driving },
        walking: { durationMinutes: null, modeIcon: COMMUTE_MODE_ICON.walking, isWalkingDistance: true }
      },
      selectedMode: 'walking',
      durationMinutes: null,
      modeIcon: COMMUTE_MODE_ICON.walking,
      isWalkingDistance: true
    };
  }

  const modeResults = await Promise.all(
    COMMUTE_MODE_PRIORITY.map(async (mode) => {
      try {
        const durationMinutes = await fetchDistanceMatrixDuration({ origin, destination, mode });
        return { mode, durationMinutes };
      } catch {
        return { mode, durationMinutes: null };
      }
    })
  );

  const modes = {
    transit: {
      durationMinutes: modeResults.find((r) => r.mode === 'transit')?.durationMinutes ?? null,
      modeIcon: COMMUTE_MODE_ICON.transit
    },
    driving: {
      durationMinutes: modeResults.find((r) => r.mode === 'driving')?.durationMinutes ?? null,
      modeIcon: COMMUTE_MODE_ICON.driving
    },
    walking: {
      durationMinutes: modeResults.find((r) => r.mode === 'walking')?.durationMinutes ?? null,
      modeIcon: COMMUTE_MODE_ICON.walking
    }
  };

  const fastest = COMMUTE_MODE_PRIORITY
    .map((mode) => ({ mode, durationMinutes: modes[mode]?.durationMinutes }))
    .filter((result) => Number.isFinite(result.durationMinutes))
    .sort((a, b) => a.durationMinutes - b.durationMinutes)[0];

  const selectedMode = fastest?.mode || 'transit';

  return {
    modes,
    selectedMode,
    durationMinutes: modes[selectedMode]?.durationMinutes ?? null,
    modeIcon: modes[selectedMode]?.modeIcon || COMMUTE_MODE_ICON.transit
  };
}

module.exports = {
  DISTANCE_MATRIX_BASE_URL,
  COMMUTE_MODE_ICON,
  COMMUTE_MODE_PRIORITY,
  normalizeTravelMode,
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
  getFastestCommuteMinutes,
  haversineKm,
  getActivityCoords,
  isWalkingDistancePair,
  WALKING_DISTANCE_KM
};
