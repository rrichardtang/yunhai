require('dotenv').config();
const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { planCity } = require('./claude');
const { fetchUnsplashImage } = require('./unsplash');
const { recordSignal, load: loadPreferences, reset: resetPreferences } = require('./preferences');
const { getSession, setTripContext, addMessage, getHistory, compactHistory, clearSession } = require('./chat');

const app = express();
const PORT = Number(process.env.PORT || 3457);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

let latestItinerary = null;

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
  const { cities, profile } = req.body || {};
  if (!Array.isArray(cities) || cities.length === 0) {
    return res.status(400).json({ error: 'cities must be a non-empty array' });
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
      const activities = await planCity(city, profile);
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

app.post('/api/preferences/signal', (req, res) => {
  const { name, type, verdict, city, why_it_fits } = req.body || {};
  recordSignal({ name, type, verdict, city, why_it_fits });
  return res.json({ ok: true });
});

app.get('/api/preferences', (_req, res) => {
  return res.json({ preferences: loadPreferences() });
});

app.post('/api/preferences/reset', (_req, res) => {
  const preferences = resetPreferences();
  return res.json({ ok: true, preferences });
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
