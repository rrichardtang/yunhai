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

const app = express();
const PORT = Number(process.env.PORT || 3457);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

let latestItinerary = null;

const DIRECTIONS_BASE_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const COMMUTE_MODE_ICON = {
  transit: '🚇',
  walking: '🚶',
  driving: '🚗',
  bicycling: '🚴'
};

function normalizeTravelMode(mode = '') {
  const m = String(mode || '').toLowerCase();
  if (m === 'transit' || m === 'walking' || m === 'driving' || m === 'bicycling') return m;
  return 'transit';
}

function buildDirectionsQuery(activity = {}) {
  return [activity.name, activity.city].filter(Boolean).join(', ').trim();
}

async function fetchDirectionsRoute({ origin, destination, mode }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    origin,
    destination,
    mode,
    key: apiKey
  });

  const response = await fetch(`${DIRECTIONS_BASE_URL}?${params.toString()}`);
  if (!response.ok) return null;

  const data = await response.json();
  if (data?.status !== 'OK' || !Array.isArray(data?.routes) || !data.routes.length) return null;

  const route = data.routes[0];
  const leg = Array.isArray(route.legs) && route.legs.length ? route.legs[0] : null;
  const durationSeconds = Number(leg?.duration?.value || 0);
  if (!durationSeconds) return null;

  const dominantStepMode = Array.isArray(leg?.steps) && leg.steps.length
    ? normalizeTravelMode(leg.steps[0]?.travel_mode)
    : normalizeTravelMode(mode);

  return {
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    mode: dominantStepMode,
    modeIcon: COMMUTE_MODE_ICON[dominantStepMode] || COMMUTE_MODE_ICON.transit
  };
}

async function getCommuteBetweenActivities(fromActivity, toActivity) {
  const origin = buildDirectionsQuery(fromActivity);
  const destination = buildDirectionsQuery(toActivity);
  if (!origin || !destination) return null;

  const transitRoute = await fetchDirectionsRoute({ origin, destination, mode: 'transit' });
  if (transitRoute) return transitRoute;

  const walkingRoute = await fetchDirectionsRoute({ origin, destination, mode: 'walking' });
  if (walkingRoute) return walkingRoute;

  return null;
}

function parseUserId(rawUserId) {
  return resolveUserId(rawUserId == null ? DEFAULT_USER_ID : rawUserId);
}

function buildChatSystemPrompt(tripContext = {}) {
  const cities = Array.isArray(tripContext.cities) && tripContext.cities.length
    ? tripContext.cities.map((city) => `${city.name} (${city.startDate} → ${city.endDate})`).join(', ')
    : 'None yet';
  const approved = Array.isArray(tripContext.approvedActivities) && tripContext.approvedActivities.length
    ? tripContext.approvedActivities.join(', ')
    : 'None yet';
  const declined = Array.isArray(tripContext.declinedActivities) && tripContext.declinedActivities.length
    ? tripContext.declinedActivities.join(', ')
    : 'None yet';

  return `You are a concise, opinionated travel advisor helping plan a trip. You have full context of the user's itinerary and preferences. Answer questions directly in 2-4 sentences. Be honest about downsides. Remember everything discussed in this conversation.\n\nCurrent trip context:\n- Cities: ${cities}\n- Current planning step: ${tripContext.step ?? 'Unknown'}\n- Approved activities: ${approved}\n- Declined activities: ${declined}`;
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

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    keys: {
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      unsplashConfigured: Boolean(process.env.UNSPLASH_ACCESS_KEY)
    }
  });
});

app.post('/api/plan', async (req, res) => {
  const { cities, profile, userId } = req.body || {};
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
    for (const city of cities) {
      const activities = await planCity(city, profile, resolvedUserId);
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
    const { q, city } = req.query;
    if (!q) return res.status(400).json({ error: 'q query param is required' });

    const imageUrl = await fetchUnsplashImage(q, city);
    return res.json({ imageUrl });
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
      if (!commute) continue;

      commutes.push({
        fromId: fromActivity.id,
        toId: toActivity.id,
        durationMinutes: commute.durationMinutes,
        mode: commute.mode,
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
  const generatedAt = new Date().toISOString();
  latestItinerary = { ...payload, generatedAt };
  res.json({ itinerary: latestItinerary });
});

app.get('/api/itinerary', (_req, res) => {
  res.json({ itinerary: latestItinerary });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TravelPlanner listening on http://localhost:${PORT}`);
});
