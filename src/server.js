require('dotenv').config();
const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { planCity } = require('./claude');
const { fetchUnsplashImage } = require('./unsplash');
const { DEFAULT_ACTIVITY_CATEGORY_CONFIG } = require('./arrangeConfig');
const {
  recordSignal,
  recordConstraint,
  needsDistillation,
  distill: distillProfile,
  load: loadPreferences,
  getSummary: getPreferenceSummary,
  reset: resetPreferences,
  resolveUserId,
  DEFAULT_USER_ID
} = require('./preferences');
const { getSession, setTripContext, addMessage, getHistory, compactHistory, clearSession, getCachedPrompt } = require('./chat');
const {
  saveItinerary,
  getLatestItinerary,
  getItineraryById,
  listItineraries,
  deleteItinerary
} = require('./itineraryStore');

const app = express();
const PORT = Number(process.env.PORT || 3457);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function parseTimeForCalendar(raw = '') {
  const normalized = String(raw || '').trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return { hours: 9, minutes: 0 };

  let hours = Number(match[1] || 9);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3];

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  return {
    hours: Math.max(0, Math.min(23, hours)),
    minutes: Math.max(0, Math.min(59, minutes))
  };
}

function toIcsDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function escapeIcsText(value = '') {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function buildItineraryIcs(itinerary = {}) {
  const now = new Date();
  const timestamp = `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;
  const events = [];

  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  for (const day of days) {
    const baseDate = String(day?.date || '').slice(0, 10);
    if (!baseDate) continue;

    const activities = Array.isArray(day?.activities) ? day.activities : [];
    for (const activity of activities) {
      const [year, month, date] = baseDate.split('-').map((n) => Number(n));
      if (!year || !month || !date) continue;

      const start = parseTimeForCalendar(activity?.time || activity?.suggested_time || '09:00');
      const durationHours = Math.max(0.5, Number(activity?.duration_hours || 1.5));
      const durationMinutes = Math.round(durationHours * 60);

      const startDate = new Date(year, month - 1, date, start.hours, start.minutes, 0);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      const summary = activity?.name || 'Travel activity';
      const location = [activity?.start_location, activity?.end_location].filter(Boolean).join(' → ') || day?.city || '';
      const description = [
        `Type: ${activity?.type || 'activity'}`,
        activity?.why_it_fits ? `Why: ${activity.why_it_fits}` : '',
        activity?.booking_advice ? `Booking advice: ${activity.booking_advice}` : '',
        activity?.pitfall ? `Pitfall: ${activity.pitfall}` : ''
      ].filter(Boolean).join('\n');

      events.push([
        'BEGIN:VEVENT',
        `UID:${escapeIcsText(`${itinerary.id || 'trip'}-${activity?.id || summary}-${toIcsDate(startDate)}@travelplanner.local`)}`,
        `DTSTAMP:${timestamp}`,
        `DTSTART:${toIcsDate(startDate)}`,
        `DTEND:${toIcsDate(endDate)}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        location ? `LOCATION:${escapeIcsText(location)}` : '',
        description ? `DESCRIPTION:${escapeIcsText(description)}` : '',
        'END:VEVENT'
      ].filter(Boolean).join('\r\n'));
    }
  }

  const calendarName = itinerary.tripName || 'TravelPlanner Itinerary';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TravelPlanner//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');
}

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

function formatLatLng(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  return `${latitude},${longitude}`;
}

function parseMinutesFromTime(value = '09:00') {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 9 * 60;
  const hours = Math.max(0, Math.min(23, Number(match[1] || 0)));
  const minutes = Math.max(0, Math.min(59, Number(match[2] || 0)));
  return (hours * 60) + minutes;
}

function timeFromMinutes(totalMinutes = 0) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(Number(totalMinutes) || 0)));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function extractTimeFromDateTime(value = '') {
  const text = String(value || '');
  const match = text.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : '';
}

function pickFirstAccommodation(city = {}) {
  const accommodations = Array.isArray(city?.accommodations) ? city.accommodations : [];
  if (!accommodations.length) return null;
  return accommodations.slice().sort((a, b) => {
    const aDate = String(a?.checkIn || a?.checkOut || '9999-12-31');
    const bDate = String(b?.checkIn || b?.checkOut || '9999-12-31');
    return aDate.localeCompare(bDate);
  })[0] || null;
}

function pickLastAccommodation(city = {}) {
  const accommodations = Array.isArray(city?.accommodations) ? city.accommodations : [];
  if (!accommodations.length) return null;
  return accommodations.slice().sort((a, b) => {
    const aDate = String(a?.checkOut || a?.checkIn || '0000-01-01');
    const bDate = String(b?.checkOut || b?.checkIn || '0000-01-01');
    return bDate.localeCompare(aDate);
  })[0] || null;
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

    const firstAccommodation = pickFirstAccommodation(city);
    const lastAccommodation = pickLastAccommodation(city);
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
      const previousLastAccommodation = pickLastAccommodation(previousCity);
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
  const preferredCoords = locationField === 'end_location'
    ? formatLatLng(activity.end_latitude, activity.end_longitude)
    : formatLatLng(activity.start_latitude, activity.start_longitude);
  if (preferredCoords) return preferredCoords;

  const location = activity?.[locationField];
  if (isUsableLocation(location)) return String(location).trim();
  return buildDistanceMatrixQuery(activity);
}

async function fetchDistanceMatrixDuration({ origin, destination, mode }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

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

  return Math.max(1, Math.round(durationSeconds / 60));
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

function parseUserId(rawUserId) {
  return resolveUserId(rawUserId == null ? DEFAULT_USER_ID : rawUserId);
}

function formatCityLine(city) {
  const accoms = Array.isArray(city.accommodations) && city.accommodations.length
    ? city.accommodations.join('; ')
    : 'none listed';
  return `${city.name} (${city.startDate} → ${city.endDate}, leaving ${city.leaveTime || '18:00'}) — staying: ${accoms}`;
}

function formatScheduleBlock(scheduledByDay) {
  if (!Array.isArray(scheduledByDay) || !scheduledByDay.length) return '';
  const lines = scheduledByDay.map((day) => {
    const acts = day.activities.map((a) => `  ${a.time || '?'} ${a.name} (${a.type}, ${a.duration || '?'})`);
    return `${day.date} ${day.city}\n${acts.join('\n')}`;
  });
  return `\n\n## Scheduled Itinerary\n${lines.join('\n')}`;
}

function buildChatSystemPrompt(tripContext = {}, prefSummary = '') {
  const cities = Array.isArray(tripContext.cities) && tripContext.cities.length
    ? tripContext.cities.map(formatCityLine).join('\n')
    : 'None yet';

  const hasSchedule = Array.isArray(tripContext.scheduledByDay) && tripContext.scheduledByDay.length > 0;
  let activityLines = '';
  if (!hasSchedule) {
    const approved = Array.isArray(tripContext.approvedActivities) && tripContext.approvedActivities.length
      ? tripContext.approvedActivities.join(', ') : '';
    if (approved) activityLines = `\n- Approved: ${approved}`;
  }

  const base = `You are a concise, opinionated travel advisor. You know this trip's dates, accommodations, scheduled activities, and the traveler's preferences. Answer in 2-4 sentences. Be honest about downsides. Tailor suggestions to the dates, location, and tastes.

Respond ONLY with valid JSON: {"reply":"your response","signals":[]}
The "signals" array captures any travel preferences or constraints the user reveals. Each signal is one of:
- Activity preference: {"type":"walk","verdict":"approved"} or {"type":"museum","verdict":"declined"}
- Constraint: {"constraint":"no activities before 9am"}
Only include signals when the user clearly states a preference. Omit the array or leave it empty otherwise. Do NOT extract signals from your own suggestions.`;
  const profileBlock = prefSummary ? `\n\n## Traveler\n${prefSummary}` : '';
  const tripBlock = `\n\n## Trip: ${tripContext.tripName || 'Untitled'} (${tripContext.step || 'unknown'})\n${cities}${activityLines}`;
  const scheduleBlock = formatScheduleBlock(tripContext.scheduledByDay);

  return base + profileBlock + tripBlock + scheduleBlock;
}

function parseChatResponse(raw) {
  const fallback = { reply: raw || 'Sorry, I couldn\'t process that.', signals: [] };
  try {
    const stripped = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(stripped);
    if (typeof parsed.reply !== 'string') return fallback;
    return { reply: parsed.reply, signals: Array.isArray(parsed.signals) ? parsed.signals : [] };
  } catch {
    return fallback;
  }
}

function processChatSignals(signals, userId) {
  if (!signals.length) return;
  for (const sig of signals) {
    if (sig.constraint) {
      recordConstraint(userId, sig.constraint);
    } else if (sig.type && sig.verdict) {
      recordSignal({ userId, name: '', type: sig.type, verdict: sig.verdict, city: '', why_it_fits: '' });
    }
  }
  if (needsDistillation(userId)) {
    distillProfile(userId).catch((err) => console.error('[chat] distillation failed:', err.message));
  }
}

function toAnthropicMessages(history = []) {
  return history.map((msg) => {
    if (msg.role === 'system') {
      return { role: 'user', content: msg.content };
    }
    return {
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    };
  });
}

function sliderInterestLabel(value) {
  const rating = Math.max(1, Math.min(5, Math.round(Number(value) || 3)));
  if (rating === 1) return 'Not interested';
  if (rating === 2) return 'Slightly interested';
  if (rating === 3) return 'Neutral';
  if (rating === 4) return 'Very interested';
  return 'Loves this';
}

function extractText(content = []) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c?.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

function formatProfileForEnrichment(profile = {}) {
  const answers = profile?.answers && typeof profile.answers === 'object' ? profile.answers : {};
  const questionMap = [
    ['museumPerson', 'Museum person'],
    ['foodTravel', 'Travels for food'],
    ['livePerformances', 'Live performances'],
    ['outdoorNature', 'Outdoor / nature activities'],
    ['nightlifeBars', 'Nightlife and bars'],
    ['structuredTours', 'Structured tours']
  ];
  const paceLabels = { 1: 'Very relaxed', 2: 'Easy-going', 3: 'Moderate', 4: 'Active', 5: 'Non-stop' };

  const lines = questionMap.map(([key, label]) => `- ${label}: ${sliderInterestLabel(answers[key])}`);
  const paceValue = Math.max(1, Math.min(5, Math.round(Number(answers.pace) || 3)));
  lines.push(`- Trip pace: ${paceLabels[paceValue]}`);
  const aboutMe = String(profile?.aboutMe || '').trim() || '(none provided)';
  return `${lines.join('\n')}\n- About me: ${aboutMe}`;
}

const IMAGE_QUERY_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'at', 'in', 'for', 'on', 'with', 'from', 'to'
]);

function extractImageKeywords(name = '', city = '') {
  const cityWords = new Set(
    String(city || '')
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
  );

  const words = String(name || '')
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
    .filter(Boolean);

  const keywords = [];
  for (const word of words) {
    const normalized = word.toLowerCase();
    if (IMAGE_QUERY_STOPWORDS.has(normalized)) continue;
    if (cityWords.has(normalized)) continue;
    if (normalized.length <= 1) continue;
    if (keywords.some((k) => k.toLowerCase() === normalized)) continue;
    keywords.push(word);
  }

  return keywords;
}

function buildImageSearchQuery({ name = '', type = '', city = '' } = {}) {
  const normalizedType = String(type || '').trim().toLowerCase();
  const normalizedCity = String(city || '').trim();
  const keywords = extractImageKeywords(name, normalizedCity);
  const typeWords = new Set(
    normalizedType
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
  );

  const filteredKeywords = keywords.filter((word) => !typeWords.has(word.toLowerCase()));
  const preciseQuery = [filteredKeywords.join(' '), normalizedType, normalizedCity]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (preciseQuery) return preciseQuery;
  if (normalizedType && normalizedCity) return `${normalizedType} ${normalizedCity}`.trim();
  return String(name || '').trim() || normalizedCity;
}

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    keys: {
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      unsplashConfigured: Boolean(process.env.UNSPLASH_ACCESS_KEY),
      googleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY)
    },
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
});

app.get('/api/arrange-config', (_req, res) => {
  res.json({ categoryDefaults: DEFAULT_ACTIVITY_CATEGORY_CONFIG });
});

app.post('/api/arrange', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Anthropic API key not configured' });
  }

  const { days, activities, userId: rawUserId, profile } = req.body || {};
  if (!Array.isArray(days) || !Array.isArray(activities)) {
    return res.status(400).json({ error: 'days and activities are required arrays' });
  }
  const userId = parseUserId(rawUserId);
  const prefs = loadPreferences(userId);
  const prefParts = [];
  if (prefs.distilledProfile) prefParts.push(prefs.distilledProfile);
  if (prefs.constraints.length) prefParts.push(`Constraints: ${prefs.constraints.map((c) => c.text).join('; ')}`);
  const prefSummary = prefParts.join('\n');

  const daysText = days.map((d) => {
    let line = `- ${d.date} (${d.label}): available ${d.windowStart} – ${d.windowEnd}`;
    if (d.fixedStart) line += `\n  FIXED FIRST: "${d.fixedStart.label}" at ${d.fixedStart.time} — schedule NO activities before this`;
    if (d.fixedEnd) line += `\n  FIXED LAST: "${d.fixedEnd.label}" at ${d.fixedEnd.time} — schedule NO activities after this`;
    return line;
  }).join('\n');

  const activitiesText = activities.map((a) => {
    const parts = [`id:${a.id}`, `"${a.name}"`, a.category, `${a.duration_hours}h`];
    if (a.opening_hours) parts.push(`hours:${a.opening_hours}`);
    const suggested = String(a.suggested_time || '').trim();
    if (suggested && suggested !== '10:00am') parts.push(`preferred:${suggested}`);
    if (a.location) parts.push(`at:${a.location}`);
    return `- ${parts.join(' | ')}`;
  }).join('\n');
  const perDay = Math.ceil(activities.length / days.length);

  const paceValue = Math.max(1, Math.min(5, Math.round(Number(profile?.answers?.pace) || 3)));
  const paceLabels = { 1: 'very relaxed', 2: 'easy-going', 3: 'moderate', 4: 'active', 5: 'non-stop' };
  const paceDesc = paceLabels[paceValue];
  const travelerBlock = prefSummary ? `\nTRAVELER PROFILE:\n${prefSummary}\nPace preference: ${paceDesc}\n` : `\nPace preference: ${paceDesc}\n`;

  const prompt = `Schedule ${activities.length} activities across ${days.length} days. Target ~${perDay} activities per day — distribute evenly.

DAYS:
${daysText}

ACTIVITIES:
${activitiesText}
${travelerBlock}
RULES (priority order):
1. Distribute ~${perDay} activities per day.
2. Stay within each day's available window (windowStart–windowEnd).
3. FIXED FIRST/LAST bookends are immovable.
4. Respect opening hours.
5. Meals at realistic times: breakfast 7–9am, lunch 11:30am–1:30pm, dinner 6–8:30pm.
6. No overlaps — account for duration + 20min travel buffer between activities.
7. Group nearby locations on the same day when possible.
8. Honor preferred time hints when they fit.
9. Respect the traveler's ${paceDesc} pace preference — ${paceValue <= 2 ? 'leave generous gaps between activities and favor fewer, longer experiences' : paceValue >= 4 ? 'pack days tightly with minimal downtime between activities' : 'balance activity with reasonable breaks'}.
10. If an activity cannot fit, include it in unplaced with a reason.

Respond ONLY with JSON:
{"placements":{"<id>":{"date":"YYYY-MM-DD","time":"HH:MM"}},"unplaced":[{"id":"<id>","reason":"..."}]}`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    });

    const raw = extractText(response.content);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse arrangement' });

    const result = JSON.parse(jsonMatch[0]);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to arrange activities' });
  }
});

app.post('/api/plan', async (req, res) => {
  const { cities, travels, profile, userId } = req.body || {};
  if (!Array.isArray(cities) || cities.length === 0) {
    return res.status(400).json({ error: 'cities must be a non-empty array' });
  }

  let resolvedUserId;
  try {
    resolvedUserId = parseUserId(userId);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Invalid userId' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const sendEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const tripTravels = Array.isArray(travels) ? travels.slice(0, 1) : [];
    const cityTravelTiming = await buildCityTravelTiming(cities);
    for (const city of cities) {
      const timing = cityTravelTiming[String(city?.name || '').trim()] || null;
      const activities = await planCity(city, profile, resolvedUserId, tripTravels, timing);
      sendEvent({ type: 'city', city: city.name, activities, travelTiming: timing });
    }
    sendEvent({ type: 'done' });
    res.end();
  } catch (error) {
    if (error.code === 'ANTHROPIC_KEY_MISSING') {
      sendEvent({
        type: 'error',
        error: 'Anthropic API key not configured',
        code: error.code
      });
    } else {
      sendEvent({ type: 'error', error: error.message || 'Failed to generate plan' });
    }
    res.end();
  }
});

app.get('/api/image', async (req, res) => {
  try {
    const { q, city, type } = req.query;
    if (!q) return res.status(400).json({ error: 'q query param is required' });

    const searchQuery = buildImageSearchQuery({ name: q, type, city });
    const imageUrl = await fetchUnsplashImage(searchQuery, city, type);
    return res.json({ imageUrl, searchQuery });
  } catch (error) {
    if (error.code === 'UNSPLASH_KEY_MISSING') {
      return res.status(503).json({
        error: 'Unsplash API key not configured',
        code: error.code
      });
    }
    return res.status(500).json({ error: error.message || 'Failed to fetch image' });
  }
});

app.post('/api/commute', async (req, res) => {
  try {
    const activities = Array.isArray(req.body?.activities) ? req.body.activities : [];
    if (activities.length < 2) return res.json({ commutes: [] });

    const commutes = [];
    for (let i = 0; i < activities.length - 1; i += 1) {
      const fromActivity = activities[i];
      const toActivity = activities[i + 1];
      const commute = await getCommuteBetweenActivities(fromActivity, toActivity);

      commutes.push({
        fromId: fromActivity.id,
        toId: toActivity.id,
        modes: commute.modes,
        selectedMode: commute.selectedMode,
        durationMinutes: commute.durationMinutes,
        modeIcon: commute.modeIcon
      });
    }

    return res.json({ commutes });
  } catch {
    return res.json({ commutes: [] });
  }
});

app.post('/api/preferences/signal', (req, res) => {
  try {
    const { userId, name, type, verdict, city, why_it_fits } = req.body || {};
    const resolvedUserId = parseUserId(userId);
    recordSignal({ userId: resolvedUserId, name, type, verdict, city, why_it_fits });
    if (needsDistillation(resolvedUserId)) {
      distillProfile(resolvedUserId).catch((err) => console.error('[preferences] distillation failed:', err.message));
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Invalid preferences signal payload' });
  }
});

app.get('/api/preferences', (req, res) => {
  try {
    const userId = parseUserId(req.query?.userId);
    return res.json({ preferences: loadPreferences(userId) });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Invalid userId' });
  }
});

app.post('/api/preferences/reset', (req, res) => {
  try {
    const userId = parseUserId(req.body?.userId);
    const preferences = resetPreferences(userId);
    return res.json({ ok: true, preferences });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Invalid userId' });
  }
});

app.post('/api/profile/enrich', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Anthropic API key not configured' });
  }

  try {
    const profile = req.body || {};
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are writing traveler instructions for a travel planning AI agent. Based on this traveler's self-reported preferences below, write a concise 2-4 sentence instruction paragraph in second person (e.g. "This traveler...") that tells the agent how to tailor recommendations specifically for them. Be specific and direct — this is an instruction, not a summary. Focus on what they love, what to avoid, and any quirks. Output ONLY the instruction paragraph, nothing else.\n\nTraveler profile:\n${formatProfileForEnrichment(profile)}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 220,
      messages: [{ role: 'user', content: prompt }]
    });

    const instruction = extractText(response.content);
    if (!instruction) {
      return res.status(500).json({ error: 'Failed to generate profile instruction' });
    }

    return res.json({
      instruction,
      profileInstruction: instruction
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to enrich profile' });
  }
});

app.post('/api/chat/message', async (req, res) => {
  const { sessionId, message, tripContext, userId: rawUserId } = req.body || {};
  if (!sessionId || !message || typeof message !== 'string') {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Anthropic API key not configured for chat.' });
  }

  const userId = parseUserId(rawUserId);
  const prefSummary = getPreferenceSummary(tripContext?.profile || null, userId);

  getSession(sessionId);
  setTripContext(sessionId, tripContext || {});
  addMessage(sessionId, 'user', message);

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: getCachedPrompt(sessionId, tripContext || {}, () => buildChatSystemPrompt(tripContext || {}, prefSummary)),
      messages: toAnthropicMessages(getHistory(sessionId))
    });

    const rawText = (response.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
      .trim();

    const { reply, signals } = parseChatResponse(rawText);
    processChatSignals(signals, userId);

    addMessage(sessionId, 'assistant', reply);
    await compactHistory(sessionId);

    return res.json({ reply, sessionId });
  } catch (error) {
    const history = getHistory(sessionId);
    if (history[history.length - 1]?.role === 'user') {
      history.pop();
    }
    return res.status(500).json({ error: error.message || 'Chat request failed' });
  }
});

app.get('/api/chat/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const session = getSession(sessionId);
  return res.json({ sessionId, history: session?.history || [] });
});

app.delete('/api/chat/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  clearSession(sessionId);
  return res.json({ ok: true });
});

app.post('/api/itinerary', (req, res) => {
  const payload = req.body || {};
  const itinerary = saveItinerary(payload);
  res.json({ itinerary });
});

app.get('/api/itinerary', (_req, res) => {
  res.json({ itinerary: getLatestItinerary() });
});

app.get('/api/itineraries', (_req, res) => {
  res.json({ itineraries: listItineraries() });
});

app.get('/api/itinerary/:id', (req, res) => {
  const itinerary = getItineraryById(req.params.id);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
  return res.json({ itinerary });
});

app.delete('/api/itinerary/:id', (req, res) => {
  const deleted = deleteItinerary(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Itinerary not found' });
  return res.json({ ok: true });
});

app.get('/api/itinerary/:id/calendar.ics', (req, res) => {
  const itinerary = getItineraryById(req.params.id);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

  const ics = buildItineraryIcs(itinerary);
  const safeName = String(itinerary.tripName || 'itinerary').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').toLowerCase();
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName || 'itinerary'}.ics"`);
  return res.send(ics);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TravelPlanner listening on http://localhost:${PORT}`);
});
