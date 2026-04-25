const Anthropic = require('@anthropic-ai/sdk');
const { getAuthedUserId, parseUserId } = require('../middleware/auth');
const {
  load: loadPreferences,
  save: savePreferences,
  reset: resetPreferences
} = require('../preferences');
const { getUserData, setUserData, getUserField, setUserField } = require('../userDataStore');
const { formatProfileForEnrichment } = require('../services/profilePrompt');

function extractText(content = []) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c?.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

function register(app) {
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
}

module.exports = { register };
