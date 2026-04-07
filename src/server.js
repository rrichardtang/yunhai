require('dotenv').config();
const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { planCity } = require('./claude');
const { fetchUnsplashImage } = require('./unsplash');
const {
  recordSignal,
  load: loadPreferences,
  reset: resetPreferences,
  resolveUserId,
  DEFAULT_USER_ID
} = require('./preferences');
const { getSession, setTripContext, addMessage, getHistory, compactHistory, clearSession } = require('./chat');
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

function buildChatSystemPrompt(tripContext = {}) {
  const cities = Array.isArray(tripContext.cities) && tripContext.cities.length
    ? tripContext.cities.map((city) => {
      const accommodations = Array.isArray(city.accommodations) && city.accommodations.length
        ? city.accommodations.map((accommodation) => {
          const coords = (Number.isFinite(Number(accommodation.latitude)) && Number.isFinite(Number(accommodation.longitude)))
            ? ` [${Number(accommodation.latitude)}, ${Number(accommodation.longitude)}]`
            : '';
          return `${accommodation.address || 'Address missing'}${coords} (${accommodation.checkIn || '?'} → ${accommodation.checkOut || '?'})`;
        }).join('; ')
        : 'No accommodations listed';
      return `${city.name} (${city.startDate} → ${city.endDate}) | Accommodations: ${accommodations}`;
    }).join(' | ')
    : 'None yet';
  const travels = Array.isArray(tripContext.travels) && tripContext.travels.length
    ? tripContext.travels.slice(0, 1).map((travel) => `Entry point: ${travel.entryPoint || '?'} at ${travel.dateTime || '?'}`).join(' | ')
    : 'None yet';
  const approved = Array.isArray(tripContext.approvedActivities) && tripContext.approvedActivities.length
    ? tripContext.approvedActivities.join(', ')
    : 'None yet';
  const declined = Array.isArray(tripContext.declinedActivities) && tripContext.declinedActivities.length
    ? tripContext.declinedActivities.join(', ')
    : 'None yet';

  return `You are a concise, opinionated travel advisor helping plan a trip. You have full context of the user's itinerary and preferences. Answer questions directly in 2-4 sentences. Be honest about downsides. Remember everything discussed in this conversation.\n\nCurrent trip context:\n- Cities: ${cities}\n- Travel entry: ${travels}\n- Current planning step: ${tripContext.step ?? 'Unknown'}\n- Approved activities: ${approved}\n- Declined activities: ${declined}`;
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

  const lines = questionMap.map(([key, label]) => `- ${label}: ${sliderInterestLabel(answers[key])}`);
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
    for (const city of cities) {
      const activities = await planCity(city, profile, resolvedUserId, tripTravels);
      sendEvent({ type: 'city', city: city.name, activities });
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
    recordSignal({ userId: parseUserId(userId), name, type, verdict, city, why_it_fits });
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
  const { sessionId, message, tripContext } = req.body || {};
  if (!sessionId || !message || typeof message !== 'string') {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Anthropic API key not configured for chat.' });
  }

  getSession(sessionId);
  setTripContext(sessionId, tripContext || {});
  addMessage(sessionId, 'user', message);

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 220,
      system: buildChatSystemPrompt(tripContext || {}),
      messages: toAnthropicMessages(getHistory(sessionId))
    });

    const reply = (response.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
      .trim() || 'I would skip this unless it strongly matches your interests.';

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
