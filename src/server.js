require('dotenv').config();
const fs = require('fs');
const express = require('express');

const { nominatimFetch } = require('./middleware/nominatim');

const { acquire: acquireLlmSlot, release: releaseLlmSlot } = require('./middleware/llmSemaphore');

const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { clerkMiddleware } = require('@clerk/express');
const { planCity, normalizeActivity, SYSTEM_PROMPT: ACTIVITY_SYSTEM_PROMPT } = require('./claude');
const { fetchUnsplashImage } = require('./unsplash');
const { DEFAULT_ACTIVITY_CATEGORY_CONFIG } = require('./arrangeConfig');
const { buildBookingLinks } = require('./services/bookingLinks');
const { buildArrangePrompt } = require('./services/arrangePrompt');
const { buildItineraryIcs } = require('./services/calendarIcs');
const { buildImageSearchQuery } = require('./services/imageQuery');
const { formatProfileForEnrichment } = require('./services/profilePrompt');
const {
  buildChatSystemPrompt,
  parseChatResponse,
  processChatSignals,
  toOpenAiMessages
} = require('./services/chatPrompt');
const {
  normalizeTravelMode,
  parseMinutesFromTime,
  timeFromMinutes,
  extractTimeFromDateTime,
  pickAccommodation,
  buildCityTravelTiming,
  getCommuteBetweenActivities
} = require('./services/distanceMatrix');
const {
  recordConstraint,
  recordPreference,
  load: loadPreferences,
  save: savePreferences,
  getSummary: getPreferenceSummary,
  reset: resetPreferences
} = require('./preferences');
const { getSession, setTripContext, addMessage, getHistory, compactHistory, clearSession, getCachedPrompt } = require('./chat');
const { search, searchForChat, isConfigured: isBraveConfigured, shouldUseBrave } = require('./braveSearch');
const {
  getItineraryById,
  addParsedBookings
} = require('./itineraryStore');
const {
  getOrCreateForwardingAddress,
  resolveUserFromRecipient,
  parseBookingEmail,
  sendIngestConfirmation
} = require('./emailForwarding');
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

const { requireConfiguredAuth, getAuthedUserId, parseUserId } = require('./middleware/auth');

function extractText(content = []) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c?.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

require('./routes/status').register(app);

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

require('./routes/geocode').register(app);

app.use('/api', requireConfiguredAuth);

require('./routes/activities').register(app);

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

require('./routes/chat').register(app);

require('./routes/itinerary').register(app);

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
