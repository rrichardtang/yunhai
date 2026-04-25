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

require('./routes/image').register(app);

require('./routes/commute').register(app);

require('./routes/preferences').register(app);

require('./routes/chat').register(app);

require('./routes/itinerary').register(app);

require('./routes/calendar').register(app);


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
