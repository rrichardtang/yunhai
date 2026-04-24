require('dotenv').config();
const fs = require('fs');
const express = require('express');

// Nominatim requires max 1 req/sec — serialize all geocode requests server-side
let nominatimQueue = Promise.resolve();
const nominatimFetch = (url) => {
  nominatimQueue = nominatimQueue.then(async () => {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TravelPlannerApp/1.0' } });
    await new Promise((res) => setTimeout(res, 1100));
    return r;
  });
  return nominatimQueue;
};

// Global semaphore: cap total in-flight Anthropic calls across all users
const MAX_CONCURRENT_LLM_CALLS = 10;
let activeLlmCalls = 0;
const llmQueue = [];
const acquireLlmSlot = () => new Promise((resolve) => {
  const tryAcquire = () => {
    if (activeLlmCalls < MAX_CONCURRENT_LLM_CALLS) {
      activeLlmCalls++;
      resolve();
    } else {
      llmQueue.push(tryAcquire);
    }
  };
  tryAcquire();
});
const releaseLlmSlot = () => {
  activeLlmCalls--;
  if (llmQueue.length > 0) llmQueue.shift()();
};

const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { clerkMiddleware, requireAuth } = require('@clerk/express');
const { planCity, normalizeActivity, SYSTEM_PROMPT: ACTIVITY_SYSTEM_PROMPT } = require('./claude');
const { fetchUnsplashImage } = require('./unsplash');
const { DEFAULT_ACTIVITY_CATEGORY_CONFIG } = require('./arrangeConfig');
const { showUpEarlyMins } = require('../shared/arrangeArrivalBuffers');
const { buildBookingLinks } = require('./services/bookingLinks');
const { buildItineraryIcs } = require('./services/calendarIcs');
const { buildImageSearchQuery } = require('./services/imageQuery');
const {
  recordConstraint,
  recordPreference,
  load: loadPreferences,
  save: savePreferences,
  getSummary: getPreferenceSummary,
  reset: resetPreferences,
  resolveUserId
} = require('./preferences');
const { getSession, setTripContext, addMessage, getHistory, compactHistory, clearSession, getCachedPrompt } = require('./chat');
const { search, searchForChat, isConfigured: isBraveConfigured, shouldUseBrave } = require('./braveSearch');
const {
  saveItinerary,
  updateItinerary,
  getLatestItinerary,
  getItineraryById,
  listItineraries,
  deleteItinerary,
  addParsedBookings,
  updateBookingChecklist
} = require('./itineraryStore');
const {
  getOrCreateForwardingAddress,
  resolveUserFromRecipient,
  parseBookingEmail,
  sendIngestConfirmation
} = require('./emailForwarding');
const { Resend } = require('resend');
const { computeTripHealth, normalizeChecklistItem } = require('./tripHealth');
const { getUserData, setUserData, getUserField, setUserField } = require('./userDataStore');
const multer = require('multer');
const {
  saveAttachment: saveAttachmentFile,
  getAttachmentFile,
  listAttachments: listAttachmentsForActivity,
  deleteAttachment: deleteAttachmentFile,
  isAllowedMime: isAllowedAttachmentMime,
  MAX_BYTES: ATTACHMENT_MAX_BYTES
} = require('./attachmentStore');
const {
  buildCalendarItems,
  computeFingerprint,
  getGoogleOAuthConfig,
  isGoogleConfigured,
  getUserGoogleToken,
  setUserGoogleToken,
  callGoogleCalendarApi,
  detectConflicts,
  getSyncRecord,
  setSyncRecord
} = require('./calendarSync');

const CHAT_CONCIERGE_MODEL = 'gpt-5.4-mini';
const ACTIVITY_REFINE_MODEL = 'gpt-5.4-mini';

const app = express();
const PORT = Number(process.env.PORT || 3457);

app.use(express.json({ limit: '1mb' }));
app.use(clerkMiddleware());

app.get('/planner.html', (_req, res) => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'planner.html'), 'utf8');
  const key = process.env.CLERK_PUBLISHABLE_KEY || '';
  const fapiDomain = key ? Buffer.from(key.replace(/^pk_(test|live)_/, ''), 'base64').toString().replace(/\$$/, '') : '';
  res.send(html
    .replace('data-clerk-publishable-key=""', `data-clerk-publishable-key="${key}"`)
    .replaceAll('__CLERK_FAPI_DOMAIN__', fapiDomain));
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

function requireConfiguredAuth(req, res, next) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
    return res.status(503).json({ error: 'Clerk is not configured' });
  }
  return requireAuth()(req, res, next);
}

function getAuthedUserId(req) {
  return String(req?.auth?.userId || '').trim() || null;
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
  return resolveUserId(rawUserId);
}

async function sendTripHealthSummaryEmail({ toEmail, tripName, tripHealth }) {
  if (!toEmail || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return false;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const unresolved = (tripHealth?.issues || []).slice(0, 5).map((issue) => `- ${issue.message}`).join('\n');
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: [toEmail],
    subject: `TravelPlanner trip health summary: ${tripName || 'Your trip'}`,
    text: `${tripHealth.status} (${tripHealth.issueCount} issues)\n\nTop issue: ${tripHealth.topIssue}\nChecklist: ${tripHealth.checklistProgress.verified}/${tripHealth.checklistProgress.total} verified\n\nUnresolved:\n${unresolved || '- None'}`
  });
  return true;
}

function formatCityLine(city) {
  const accomLabel = city.accommodation?.address || 'none listed';
  return `${city.name} (${city.startDate} → ${city.endDate}, leaving ${city.leaveTime || '18:00'}) — staying: ${accomLabel}`;
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

  const base = `You are a concise, accurate, confident travel concierge. You know this trip's dates, accommodations, scheduled activities, and the traveler's preferences. Answer in 2-3 sentences MAX — no exceptions. Be decisive and specific: give the best option first, then one sharp reason. Never hedge with "there's no single best" or "rankings shift." If search results are present, ground recommendations in them and name concrete places/operators with markdown links.

Respond ONLY with valid JSON: {"reply":"your response","signals":[]}
CRITICAL: Inside the "reply" value, NEVER paste raw URLs. Always use markdown links: [label](url). Example: "Try [Sushi Dai](https://tabelog.com/...)." Raw URLs waste space and are unreadable.
The "signals" array captures any travel preferences or constraints the user explicitly states. Each signal is one of:
- Preference: {"preference":"Gets seasick easily — avoid boat-based activities"} — specific, actionable details the AI should remember.
- Constraint: {"constraint":"no activities before 9am"} — hard limits.
Only include signals when the user clearly states something personal. Omit if empty. Do NOT extract signals from your own suggestions.`;
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
    if (sig.preference) recordPreference(userId, sig.preference);
    else if (sig.constraint) recordConstraint(userId, sig.constraint);
  }
}

function toOpenAiMessages(history = []) {
  return history.map((msg) => {
    if (msg.role === 'system') {
      return { role: 'system', content: msg.content };
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

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    keys: {
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      unsplashConfigured: Boolean(process.env.UNSPLASH_ACCESS_KEY),
      googleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      clerkConfigured: Boolean(process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY),
      resendConfigured: Boolean(process.env.RESEND_API_KEY)
    },
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
});

app.get('/api/auth/session', requireConfiguredAuth, (req, res) => {
  const userId = getAuthedUserId(req);
  const userEmail = String(req?.auth?.sessionClaims?.email || req?.auth?.sessionClaims?.email_address || '').trim();
  const forwardingAddress = getOrCreateForwardingAddress(userId, userEmail);

  return res.json({
    userId,
    forwardingAddress,
    forwardingEnabled: Boolean(forwardingAddress)
  });
});

app.post('/api/email/inbound', async (req, res) => {
  const expectedSecret = String(process.env.EMAIL_WEBHOOK_SECRET || '').trim();
  const providedSecret = String(req.headers['x-travelplanner-email-secret'] || '').trim();
  if (expectedSecret && providedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  const payload = req.body || {};
  const recipients = [payload.to, payload.recipient, payload.envelope?.to].flat().filter(Boolean);
  const routing = recipients
    .map((value) => resolveUserFromRecipient(value))
    .find(Boolean);

  if (!routing?.userId) {
    return res.status(400).json({ error: 'No matching forwarding address found' });
  }

  const parsedBookings = parseBookingEmail({
    subject: payload.subject || '',
    text: payload.text || payload.textBody || '',
    html: payload.html || payload.htmlBody || ''
  });

  if (!parsedBookings.length) {
    return res.json({ ok: true, parsed: 0, message: 'No booking details detected' });
  }

  const source = {
    from: String(payload.from || payload.sender || '').slice(0, 200),
    subject: String(payload.subject || '').slice(0, 200),
    receivedAt: new Date().toISOString()
  };

  const attached = addParsedBookings({
    userId: routing.userId,
    itineraryId: String(payload.itineraryId || '').trim(),
    bookings: parsedBookings,
    source
  });

  if (!attached) {
    return res.status(404).json({ error: 'No itinerary found for user to attach booking' });
  }

  try {
    await sendIngestConfirmation({
      toEmail: routing.userEmail,
      parsedCount: attached.added,
      forwardingAddress: `${routing.alias}@${process.env.FORWARDING_EMAIL_DOMAIN}`
    });
  } catch (error) {
    console.error('[email] confirmation send failed:', error.message);
  }

  return res.json({ ok: true, parsed: attached.added, itineraryId: attached.itineraryId });
});

app.get('/api/geocode', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
    const r = await nominatimFetch(url);
    if (!r.ok) return res.status(r.status).json({ error: `Nominatim error ${r.status}` });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api', requireConfiguredAuth);

const placesCache = new Map();
const PLACES_CACHE_MAX = 500;

function placesCacheGet(key) {
  if (!placesCache.has(key)) return null;
  const value = placesCache.get(key);
  placesCache.delete(key);
  placesCache.set(key, value);
  return value;
}

function placesCacheSet(key, value) {
  if (placesCache.has(key)) placesCache.delete(key);
  placesCache.set(key, value);
  if (placesCache.size > PLACES_CACHE_MAX) {
    const oldestKey = placesCache.keys().next().value;
    placesCache.delete(oldestKey);
  }
}

app.get('/api/places/resolve', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const city = String(req.query.city || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.json({ error: 'maps_disabled' });

  const cacheKey = `${q.toLowerCase()}|${city.toLowerCase()}`;
  const cached = placesCacheGet(cacheKey);
  if (cached) return res.json(cached);

  const input = city ? `${q}, ${city}` : q;
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(input)}&inputtype=textquery&fields=place_id,geometry,name,price_level,rating,user_ratings_total,formatted_address&key=${apiKey}`;

  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.warn(`[places] lookup failed ${r.status} for "${input}"`);
      return res.json({ error: 'lookup_failed' });
    }
    const data = await r.json();
    const candidate = Array.isArray(data.candidates) ? data.candidates[0] : null;
    if (!candidate) {
      const response = { placeId: null };
      placesCacheSet(cacheKey, response);
      return res.json(response);
    }
    const response = {
      placeId: candidate.place_id || null,
      lat: candidate.geometry?.location?.lat ?? null,
      lng: candidate.geometry?.location?.lng ?? null,
      name: candidate.name || null,
      formattedAddress: candidate.formatted_address || null,
      priceLevel: typeof candidate.price_level === 'number' ? candidate.price_level : null,
      rating: typeof candidate.rating === 'number' ? candidate.rating : null,
      userRatingsTotal: typeof candidate.user_ratings_total === 'number' ? candidate.user_ratings_total : null
    };
    placesCacheSet(cacheKey, response);
    return res.json(response);
  } catch (err) {
    console.warn(`[places] exception for "${input}": ${err.message}`);
    return res.json({ error: 'lookup_failed' });
  }
});

app.post('/api/activity/refine', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }

  const { activity, note, budget_target } = req.body || {};
  if (!activity?.name || !note) {
    return res.status(400).json({ error: 'activity and note are required' });
  }

  try {
    const braveResults = isBraveConfigured()
      ? await search(`${activity.name} ${activity.city} ${note}`, { task: 'entity_enrichment', count: 3 })
      : [];
    const braveBlock = braveResults.length
      ? `\nWeb research (use to anchor the refined activity in a real venue — do not invent place names):\n${braveResults.map(r => `- ${r.title}: ${r.description}`).join('\n')}`
      : '';
    const budgetClause = budget_target != null
      ? `\nThe refined activity's estimated_cost_usd must be at or below ${budget_target}. Downscale the venue or choose a cheaper equivalent within the same activity type and city.`
      : '';

    const userContent = `You are refining an existing travel activity. The traveler wants a tweak, not a replacement.

Current activity: ${JSON.stringify(activity)}
Traveler's note: "${note}"${braveBlock}${budgetClause}

Return ONLY a JSON object containing the fields that should change. Preserve all field names from the current activity. If the traveler names a specific place, the "name" field must include it verbatim.`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: ACTIVITY_REFINE_MODEL,
      max_completion_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: userContent }]
    });

    const updates = JSON.parse(response.choices?.[0]?.message?.content?.trim() || '{}');

    // Re-enrich cost and booking links
    const updatedName = updates.name || activity.name;
    const updatedCity = updates.city || activity.city;
    const isNewShape = activity.booking !== undefined;
    const existingBookingType = isNewShape ? activity.booking?.type : activity.booking_type;
    const updatedBookingType = updates.booking_type || existingBookingType || 'none';

    if (updatedBookingType !== 'none') {
      const searchName = updates.venue_name || activity.venue_name || updatedName;
      const newLinks = buildBookingLinks({
        bookingType: updatedBookingType,
        name: searchName,
        city: updatedCity,
        date: activity.scheduled_date || ''
      });

      if (isNewShape) {
        updates.booking = { ...(activity.booking || {}), type: updatedBookingType, links: newLinks };
        delete updates.booking_type;
        delete updates.booking_links;
      } else {
        updates.booking_links = newLinks;
      }
    } else if (isNewShape) {
      updates.booking = { ...(activity.booking || {}), type: 'none', links: [] };
      delete updates.booking_type;
      delete updates.booking_links;
    } else {
      updates.booking_links = [];
    }

    return res.json({ updates });
  } catch (error) {
    console.error('[/api/activity/refine]', error);
    return res.status(500).json({ error: error.message || 'Failed to refine activity' });
  }
});

app.post('/api/activity/replace', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Anthropic API key not configured' });
  }

  const { activity, reason, notes, userId } = req.body || {};
  if (!activity?.name || !activity?.city) {
    return res.status(400).json({ error: 'activity.name and activity.city are required' });
  }

  const resolvedUserId = parseUserId(userId);
  const prefSummary = getPreferenceSummary(resolvedUserId);
  const systemPrompt = prefSummary ? `${ACTIVITY_SYSTEM_PROMPT}\n\n${prefSummary}` : ACTIVITY_SYSTEM_PROMPT;

  const useBraveForEnrichment = isBraveConfigured() && shouldUseBrave('entity_enrichment', {
    query: `${activity.name} ${activity.city}`,
    needsLiveGrounding: true
  });
  const braveResults = useBraveForEnrichment ? await search(`${activity.name} ${activity.city}`, { task: 'entity_enrichment' }) : [];
  const braveBlock = braveResults.length
    ? `\nWeb research (use to ground the activity in a real venue or operator — find the closest real match to what the traveler described):\n${braveResults.map(r => `- ${r.title}: ${r.description}`).join('\n')}`
    : '';

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const contextClause = reason ? `\nTraveler's note: "${reason}"` : '';
    const notesClause = notes ? `\nSaved notes: "${notes}"` : '';
    const mealReminderClause = ['food', 'breakfast', 'lunch', 'dinner'].includes(String(activity.type || '').toLowerCase())
      ? '\nThis is a meal activity — name a specific restaurant and include 1–2 must-order dishes in why_it_fits.'
      : '';
    const userContent = `The traveler wants "${activity.name}" in ${activity.city}.${contextClause}${notesClause}${mealReminderClause}${braveBlock}

Find the best real-world match — use the web research to ground it in an actual venue or operator, and fill in pricing, booking info, duration, and other details. If the traveler's note asks for something different, find that instead.

Also extract any learnable preferences or constraints from the traveler's note. Omit if one-off or situational (e.g. "already did this", "too expensive this trip"). Preferences are specific, reusable details (e.g. "gets seasick easily"). Constraints are hard limits (e.g. "no early mornings").

Return ONLY valid JSON (no markdown fences):
{
  "activity": { ...single activity object matching the standard activity schema... },
  "preferences": [],
  "constraints": []
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    });

    const raw = extractText(response.content).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(raw);

    if (!parsed.activity || typeof parsed.activity !== 'object') {
      return res.status(500).json({ error: 'LLM returned unexpected shape' });
    }

    const normalized = normalizeActivity(parsed.activity, activity.city);

    for (const p of (Array.isArray(parsed.preferences) ? parsed.preferences : [])) recordPreference(resolvedUserId, p);
    for (const c of (Array.isArray(parsed.constraints) ? parsed.constraints : [])) recordConstraint(resolvedUserId, c);

    return res.json({ activity: normalized });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to replace activity' });
  }
});

app.get('/api/arrange-config', (_req, res) => {
  res.json({ categoryDefaults: DEFAULT_ACTIVITY_CATEGORY_CONFIG });
});

function activityForPrompt(a) {
  const isNew = a.timing !== undefined;
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    durationHours: isNew ? a.timing.duration_minutes / 60 : (Number(a.duration_hours) || 1),
    opening_hours: isNew ? a.timing.opening_hours : (a.opening_hours || ''),
    preferred_time: isNew ? a.timing.preferred_time : null,
    location: isNew ? a.location.address : (a.start_location || ''),
    estimated_cost_usd: isNew ? a.cost.estimated_usd : a.estimated_cost_usd,
    cost_type: isNew ? a.cost.type : (a.cost_type || 'per_person'),
    booking_type: isNew ? (a.booking?.type || 'none') : (a.booking_type || 'none'),
    user_notes: String(a.user_notes || '').trim()
  };
}

app.post('/api/arrange', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Anthropic API key not configured' });
  }

  const { days, activities, lockedActivities, profile, budget, numTravelers, numChildren, approvedCostTotal } = req.body || {};
  if (!Array.isArray(days) || !Array.isArray(activities)) {
    return res.status(400).json({ error: 'days and activities are required arrays' });
  }
  const resolvedLocked = Array.isArray(lockedActivities) ? lockedActivities : [];
  const userId = parseUserId(getAuthedUserId(req));
  const prefSummary = getPreferenceSummary(userId);

  const lockedByDate = {};
  for (const lock of resolvedLocked) {
    if (!lock.date) continue;
    if (!lockedByDate[lock.date]) lockedByDate[lock.date] = [];
    lockedByDate[lock.date].push(lock);
  }

  const daysText = days.map((d) => {
    let line = `- ${d.date} (${d.label}): available ${d.windowStart} – ${d.windowEnd}`;
    if (d.fixedStart) line += `\n  FIXED FIRST: "${d.fixedStart.label}" at ${d.fixedStart.time} — schedule NO activities before this`;
    if (d.fixedEnd) line += `\n  FIXED LAST: "${d.fixedEnd.label}" at ${d.fixedEnd.time} — schedule NO activities after this`;
    const locks = lockedByDate[d.date] || [];
    for (const lock of locks) {
      const durMins = Number(lock.duration_minutes) || 60;
      const [lh, lm] = String(lock.time || '00:00').split(':').map(Number);
      const endMins = (lh * 60 + (lm || 0)) + durMins;
      const endH = Math.floor(endMins / 60);
      const endM = endMins % 60;
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      line += `\n  ALREADY OCCUPIED (do not overlap): ${lock.time}–${endTime} "${lock.name}"`;
    }
    return line;
  }).join('\n');

  const activitiesText = activities.map((a) => {
    const p = activityForPrompt(a);
    const parts = [`id:${p.id}`, `"${p.name}"`, p.category, `${p.durationHours}h`];
    if (p.opening_hours) parts.push(`hours:${p.opening_hours}`);
    if (p.preferred_time) parts.push(`preferred:${p.preferred_time}`);
    if (p.location) parts.push(`at:${p.location}`);
    if (p.estimated_cost_usd !== null && p.estimated_cost_usd !== undefined) parts.push(`cost:$${p.estimated_cost_usd}${p.cost_type === 'per_group' ? '/group' : '/person'}`);
    const earlyMins = showUpEarlyMins(p.booking_type);
    if (earlyMins > 0) parts.push(`arrive:${earlyMins}min early (ticketed)`);
    let line = `- ${parts.join(' | ')}`;
    if (p.user_notes) line += `\n  USER NOTE: "${p.user_notes}"`;
    return line;
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
2a. ALREADY OCCUPIED intervals are booked — do not place any activity that overlaps them (including a 20-minute travel buffer on each side).
3. FIXED FIRST/LAST bookends are immovable.
4. Respect opening hours.
5. Meals at realistic times: breakfast 7–9am, lunch 11:30am–1:30pm, dinner 6–8:30pm.
6. No overlaps — account for duration + 20min travel buffer between activities.
7. Group nearby locations on the same day when possible.
8. Honor preferred time hints when they fit.
9. Respect the traveler's ${paceDesc} pace preference — ${paceValue <= 2 ? 'leave generous gaps between activities and favor fewer, longer experiences' : paceValue >= 4 ? 'pack days tightly with minimal downtime between activities' : 'balance activity with reasonable breaks'}.
10. Tours and attractions marked "arrive:N min early (ticketed)" require arrival N minutes before the ticket start time — block that arrival time plus the full duration as occupied.
11. Honor USER NOTE instructions when scheduling (e.g., "arrive 30 min early", "must be before sunset").
12. If an activity cannot fit, include it in unplaced with a reason.
${budget && approvedCostTotal !== undefined ? `13. Budget note: The traveler's total budget is $${budget} for ${numTravelers || 1} adult(s)${numChildren ? ` and ${numChildren} child(ren)` : ''}. Total estimated cost of approved activities is $${approvedCostTotal}. If over budget, note it in a top-level "budget_warning" string field.` : ''}

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
    // Belt-and-suspenders: drop any locked IDs the LLM emitted (client merge already overrides)
    const lockedIdSet = new Set(resolvedLocked.map((l) => String(l.id)));
    for (const id of lockedIdSet) {
      if (result.placements && result.placements[id]) delete result.placements[id];
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to arrange activities' });
  }
});

app.post('/api/plan', async (req, res) => {
  const { cities, travels, profile, budget, numTravelers, numChildren, lockedActivities } = req.body || {};
  const resolvedBudget = Number.isFinite(Number(budget)) && Number(budget) > 0 ? Number(budget) : null;
  const resolvedTravelers = Math.max(1, Math.round(Number(numTravelers) || 1));
  const resolvedChildren = Math.max(0, Math.round(Number(numChildren) || 0));
  const resolvedLockedActivities = lockedActivities && typeof lockedActivities === 'object' && !Array.isArray(lockedActivities)
    ? lockedActivities
    : {};
  if (!Array.isArray(cities) || cities.length === 0) {
    return res.status(400).json({ error: 'cities must be a non-empty array' });
  }

  let resolvedUserId;
  try {
    resolvedUserId = parseUserId(getAuthedUserId(req));
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

    const planAndEnrich = async (city) => {
      const timing = cityTravelTiming[String(city?.name || '').trim()] || null;
      const cityLocked = Array.isArray(resolvedLockedActivities[city.name])
        ? resolvedLockedActivities[city.name]
        : [];
      await acquireLlmSlot();
      try {
        const activities = await planCity(city, profile, resolvedUserId, tripTravels, timing, resolvedBudget, cities.length, resolvedTravelers, resolvedChildren, cityLocked);

        // Enrich with booking links
        const cityStartDate = city.startDate || '';
        for (const a of activities) {
          const bookingType = a.booking?.type ?? a.booking_type;
          const links = buildBookingLinks({
            bookingType,
            name: a.venue_name || a.name,
            city: city.name,
            date: cityStartDate,
            travelers: resolvedTravelers,
            children: resolvedChildren
          });
          if (links.length && a.booking) a.booking.links = links;
        }

        sendEvent({ type: 'city', city: city.name, activities, travelTiming: timing });
      } finally {
        releaseLlmSlot();
      }
    };

    const CONCURRENCY = 3;
    for (let i = 0; i < cities.length; i += CONCURRENCY) {
      await Promise.all(cities.slice(i, i + CONCURRENCY).map(planAndEnrich));
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


app.get('/api/preferences', (req, res) => {
  try {
    const userId = parseUserId(getAuthedUserId(req));
    return res.json({ preferences: loadPreferences(userId) });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Invalid userId' });
  }
});

app.put('/api/preferences', (req, res) => {
  try {
    const userId = parseUserId(getAuthedUserId(req));
    const prefs = loadPreferences(userId);
    const { constraints, preferences, profileInstruction } = req.body || {};
    if (Array.isArray(constraints)) prefs.constraints = constraints;
    if (Array.isArray(preferences)) prefs.preferences = preferences;
    if (typeof profileInstruction === 'string') prefs.profileInstruction = profileInstruction;
    savePreferences(prefs, userId);
    return res.json({ ok: true, preferences: prefs });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Failed to update preferences' });
  }
});

app.post('/api/preferences/reset', (req, res) => {
  try {
    const userId = parseUserId(getAuthedUserId(req));
    const preferences = resetPreferences(userId);
    return res.json({ ok: true, preferences });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Invalid userId' });
  }
});

app.get('/api/userdata', (req, res) => {
  try {
    const userId = parseUserId(getAuthedUserId(req));
    return res.json({ data: getUserData(userId) });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Invalid userId' });
  }
});

app.put('/api/userdata', (req, res) => {
  try {
    const userId = parseUserId(getAuthedUserId(req));
    const data = setUserData(userId, req.body || {});
    return res.json({ data });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Invalid userId' });
  }
});

app.get('/api/userdata/:field', (req, res) => {
  try {
    const userId = parseUserId(getAuthedUserId(req));
    return res.json({ value: getUserField(userId, req.params.field) });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Invalid userId' });
  }
});

app.put('/api/userdata/:field', (req, res) => {
  try {
    const userId = parseUserId(getAuthedUserId(req));
    const value = setUserField(userId, req.params.field, req.body?.value);
    return res.json({ value });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Invalid userId' });
  }
});

app.post('/api/profile/enrich', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Anthropic API key not configured' });
  }

  try {
    const userId = parseUserId(getAuthedUserId(req));
    const profile = req.body || {};
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are writing a high-level traveler profile for a travel planning AI agent. Based on this traveler's self-reported preferences, write a concise 2-4 sentence paragraph in third person ("This traveler...") capturing their general style, interests, and things to avoid. Focus on broad strokes only — pace, cultural interests, food style, activity types. Do NOT include specific constraints or situational details (those are tracked separately). Output ONLY the paragraph.\n\nTraveler profile:\n${formatProfileForEnrichment(profile)}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 220,
      messages: [{ role: 'user', content: prompt }]
    });

    const instruction = extractText(response.content);
    if (!instruction) {
      return res.status(500).json({ error: 'Failed to generate profile instruction' });
    }

    const prefs = loadPreferences(userId);
    prefs.profileInstruction = instruction;
    savePreferences(prefs, userId);

    return res.json({ instruction, profileInstruction: instruction });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to enrich profile' });
  }
});

app.post('/api/chat/message', async (req, res) => {
  const { sessionId, message, tripContext } = req.body || {};
  if (!sessionId || !message || typeof message !== 'string') {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI API key not configured for chat.' });
  }

  try {
    const userId = parseUserId(getAuthedUserId(req));
    const prefSummary = getPreferenceSummary(userId);

    getSession(sessionId);
    setTripContext(sessionId, tripContext || {});
    addMessage(sessionId, 'user', message);
    const systemPrompt = getCachedPrompt(sessionId, tripContext || {}, () => buildChatSystemPrompt(tripContext || {}, prefSummary));

    let searchContext = '';
    if (isBraveConfigured() && shouldUseBrave('chat_concierge', { userMessage: message })) {
      try {
        const searchResults = await searchForChat(message, { count: 5 });
        if (searchResults) {
          searchContext = `\n\n## Web Search Results\nThese are real-time search results for the user's question. When answering factual questions (recommendations, rankings, ratings, hours, prices), you MUST ground your answer in these results — name specific places, cite the source, and include actionable links. Be concise and confident. If results are sparse or conflicting, say so plainly and provide the best fallback recommendation.\n${searchResults}`;
        }
      } catch (e) {
        console.error('[chat] brave search failed, continuing without:', e.message);
      }
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: CHAT_CONCIERGE_MODEL,
      max_completion_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt + searchContext },
        ...toOpenAiMessages(getHistory(sessionId))
      ]
    });

    const rawText = response.choices?.[0]?.message?.content?.trim() || '';

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
  const userId = parseUserId(getAuthedUserId(req));
  const payload = req.body || {};
  const itinerary = saveItinerary(payload, userId);
  res.json({ itinerary });
});

app.get('/api/itinerary', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  res.json({ itinerary: getLatestItinerary(userId) });
});

app.get('/api/itineraries', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  res.json({ itineraries: listItineraries(userId) });
});

app.get('/api/itinerary/:id', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  const itinerary = getItineraryById(req.params.id, userId);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
  return res.json({ itinerary });
});

app.put('/api/itinerary/:id', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  const itinerary = updateItinerary(req.params.id, req.body || {}, userId);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
  return res.json({ itinerary });
});

app.delete('/api/itinerary/:id', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  const deleted = deleteItinerary(req.params.id, userId);
  if (!deleted) return res.status(404).json({ error: 'Itinerary not found' });
  return res.json({ ok: true });
});

app.get('/api/itinerary/:id/trip-health', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  const itinerary = getItineraryById(req.params.id, userId);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
  const tripHealth = computeTripHealth(itinerary);
  return res.json({ tripHealth });
});

app.put('/api/itinerary/:id/trip-health', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  const itinerary = getItineraryById(req.params.id, userId);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

  const checklist = Array.isArray(req.body?.checklist)
    ? req.body.checklist.map(normalizeChecklistItem)
    : (itinerary?.bookingChecklist?.checklist || []);
  const notificationPrefs = {
    emailSummary: Boolean(req.body?.notificationPrefs?.emailSummary),
    reminderBeforeDeparture: Boolean(req.body?.notificationPrefs?.reminderBeforeDeparture)
  };
  const issueMeta = req.body?.issueMeta && typeof req.body.issueMeta === 'object'
    ? req.body.issueMeta
    : (itinerary?.bookingChecklist?.issueMeta || {});

  const updated = updateBookingChecklist(req.params.id, userId, { checklist, notificationPrefs, issueMeta });
  const tripHealth = computeTripHealth(updated || itinerary);
  return res.json({ ok: true, tripHealth });
});

app.post('/api/itinerary/:id/trip-health/email-summary', async (req, res) => {
  try {
    const userId = parseUserId(getAuthedUserId(req));
    const itinerary = getItineraryById(req.params.id, userId);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

    const session = req.auth?.sessionClaims || {};
    const toEmail = String(session?.email || session?.email_address || '').trim();
    if (!toEmail) return res.status(400).json({ error: 'No authenticated email found for this account' });

    const tripHealth = computeTripHealth(itinerary);
    await sendTripHealthSummaryEmail({ toEmail, tripName: itinerary.tripName, tripHealth });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to send trip health summary email' });
  }
});

app.get('/api/calendar/google/auth-url', (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(503).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
  }

  const userId = parseUserId(getAuthedUserId(req));
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    state
  });
  return res.json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

app.get('/api/calendar/google/status', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  const token = getUserGoogleToken(userId);
  return res.json({ connected: Boolean(token?.accessToken) });
});

app.get('/api/calendar/google/oauth/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    const stateRaw = String(req.query.state || '').trim();
    if (!code || !stateRaw) return res.status(400).send('Missing code/state');
    if (!isGoogleConfigured()) return res.status(503).send('Google OAuth not configured');

    const parsedState = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
    const userId = String(parsedState?.userId || '').trim();
    if (!userId) return res.status(400).send('Invalid OAuth state');

    const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) return res.status(500).send(`OAuth exchange failed: ${tokenJson?.error || 'unknown error'}`);

    setUserGoogleToken(userId, {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || '',
      tokenType: tokenJson.token_type || 'Bearer',
      expiryDate: Date.now() + (Number(tokenJson.expires_in || 0) * 1000)
    });

    return res.send('Google Calendar connected. You can close this tab and return to TravelPlanner.');
  } catch (error) {
    return res.status(500).send(`OAuth callback failed: ${error.message || 'unknown error'}`);
  }
});

app.post('/api/itinerary/:id/calendar/google/precheck', async (req, res) => {
  try {
    const userId = parseUserId(getAuthedUserId(req));
    const itinerary = getItineraryById(req.params.id, userId);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

    const token = getUserGoogleToken(userId);
    if (!token?.accessToken) return res.status(401).json({ error: 'Google Calendar not connected' });

    const metadataMode = String(req.body?.metadataMode || 'compact').toLowerCase() === 'full' ? 'full' : 'compact';
    const items = buildCalendarItems(itinerary, { metadataMode });
    const conflicts = await detectConflicts({ accessToken: token.accessToken, calendarId: 'primary', items });
    return res.json({ ok: true, conflictCount: conflicts.length, conflicts });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Conflict check failed' });
  }
});

app.post('/api/itinerary/:id/calendar/google/sync', async (req, res) => {
  try {
    const userId = parseUserId(getAuthedUserId(req));
    const itinerary = getItineraryById(req.params.id, userId);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

    const token = getUserGoogleToken(userId);
    if (!token?.accessToken) return res.status(401).json({ error: 'Google Calendar not connected' });

    const metadataMode = String(req.body?.metadataMode || 'compact').toLowerCase() === 'full' ? 'full' : 'compact';
    const items = buildCalendarItems(itinerary, { metadataMode });

    let created = 0;
    let updated = 0;
    for (const item of items) {
      const fingerprint = computeFingerprint(item);
      const syncRecord = getSyncRecord(userId, itinerary.id, fingerprint);
      const payload = {
        summary: item.title,
        location: item.location || undefined,
        description: item.description || undefined,
        start: { dateTime: item.start.toISOString() },
        end: { dateTime: item.end.toISOString() }
      };

      if (syncRecord?.eventId) {
        await callGoogleCalendarApi({
          accessToken: token.accessToken,
          method: 'PATCH',
          path: `/calendars/primary/events/${encodeURIComponent(syncRecord.eventId)}`,
          body: payload
        });
        updated += 1;
      } else {
        const createdEvent = await callGoogleCalendarApi({
          accessToken: token.accessToken,
          method: 'POST',
          path: '/calendars/primary/events',
          body: payload
        });
        if (createdEvent?.id) setSyncRecord(userId, itinerary.id, fingerprint, createdEvent.id);
        created += 1;
      }
    }

    return res.json({ ok: true, total: items.length, created, updated, metadataMode });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || 'Google Calendar sync failed' });
  }
});

app.get('/api/itinerary/:id/calendar.ics', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  const itinerary = getItineraryById(req.params.id, userId);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

  const metadataMode = String(req.query.metadata || 'compact').toLowerCase() === 'full' ? 'full' : 'compact';
  const ics = buildItineraryIcs(itinerary, { metadataMode });
  const safeName = String(itinerary.tripName || 'itinerary').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').toLowerCase();
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName || 'itinerary'}.ics"`);
  return res.send(ics);
});

// ── Activity attachments ──────────────────────────────────────────────
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAttachmentMime(file.mimetype)) return cb(null, true);
    const err = new Error('Unsupported file type');
    err.code = 'UNSUPPORTED_TYPE';
    cb(err);
  }
});

function handleAttachmentError(err, res) {
  if (err?.code === 'LIMIT_FILE_SIZE' || err?.code === 'TOO_LARGE') {
    return res.status(413).json({ error: 'File exceeds 10 MB limit' });
  }
  if (err?.code === 'UNSUPPORTED_TYPE') {
    return res.status(415).json({ error: 'Unsupported file type' });
  }
  if (err?.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Too many files in one upload' });
  }
  return res.status(500).json({ error: 'Upload failed' });
}

app.post(
  '/api/itinerary/:itineraryId/activity/:activityId/attachments',
  (req, res, next) => {
    attachmentUpload.array('files', 5)(req, res, (err) => {
      if (err) return handleAttachmentError(err, res);
      next();
    });
  },
  (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const itinerary = getItineraryById(req.params.itineraryId, userId);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ error: 'No files provided' });

    const saved = [];
    for (const file of files) {
      try {
        const entry = saveAttachmentFile({
          userId,
          itineraryId: itinerary.id,
          activityId: req.params.activityId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer
        });
        saved.push(entry);
      } catch (err) {
        return handleAttachmentError(err, res);
      }
    }
    return res.json({ attachments: saved });
  }
);

app.get('/api/itinerary/:itineraryId/activity/:activityId/attachments', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const itinerary = getItineraryById(req.params.itineraryId, userId);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
  const attachments = listAttachmentsForActivity({ userId, activityId: req.params.activityId });
  return res.json({ attachments });
});

app.get('/api/itinerary/:itineraryId/attachments', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const itinerary = getItineraryById(req.params.itineraryId, userId);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
  const attachments = listAttachmentsForActivity({ userId, itineraryId: req.params.itineraryId });
  return res.json({ attachments });
});

app.get('/api/attachments/:attachmentId', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const file = getAttachmentFile({ userId, attachmentId: req.params.attachmentId });
  if (!file) return res.status(404).json({ error: 'Attachment not found' });
  res.setHeader('Content-Type', file.mimeType);
  const safeName = String(file.filename || 'attachment').replace(/[^a-zA-Z0-9._-]+/g, '_');
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
  res.setHeader('Content-Length', String(file.size));
  fs.createReadStream(file.path).pipe(res);
});

app.delete('/api/attachments/:attachmentId', (req, res) => {
  const userId = parseUserId(getAuthedUserId(req));
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const ok = deleteAttachmentFile({ userId, attachmentId: req.params.attachmentId });
  if (!ok) return res.status(404).json({ error: 'Attachment not found' });
  return res.json({ ok: true });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TravelPlanner listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
