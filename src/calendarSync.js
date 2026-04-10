const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TOKENS_PATH = path.join(DATA_DIR, 'google-calendar-tokens.json');
const SYNC_STATE_PATH = path.join(DATA_DIR, 'calendar-sync-state.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(filePath, fallback) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function parseTime(raw = '') {
  const normalized = String(raw || '').trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return { hours: 9, minutes: 0 };

  let hours = Number(match[1] || 9);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3];

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  return { hours: Math.max(0, Math.min(23, hours)), minutes: Math.max(0, Math.min(59, minutes)) };
}

function buildCalendarItems(itinerary = {}, { metadataMode = 'compact' } = {}) {
  const items = [];
  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  for (const day of days) {
    const date = String(day?.date || '').slice(0, 10);
    if (!date) continue;
    const [y, m, d] = date.split('-').map(Number);
    if (!y || !m || !d) continue;

    const activities = Array.isArray(day?.activities) ? day.activities : [];
    for (const activity of activities) {
      const startTime = parseTime(activity?.time || activity?.suggested_time || '09:00');
      const durationMinutes = Math.max(30, Math.round(Math.max(0.5, Number(activity?.duration_hours || 1.5)) * 60));
      const start = new Date(y, m - 1, d, startTime.hours, startTime.minutes, 0);
      const end = new Date(start.getTime() + (durationMinutes * 60 * 1000));

      const title = String(activity?.name || 'Travel activity').trim();
      const location = [activity?.start_location, activity?.end_location].filter(Boolean).join(' → ') || day?.city || '';
      const compactDescription = '';
      const fullDescription = [
        `Type: ${activity?.type || 'activity'}`,
        activity?.why_it_fits ? `Why it fits: ${activity.why_it_fits}` : '',
        activity?.booking_advice ? `Booking advice: ${activity.booking_advice}` : '',
        activity?.pitfall ? `Pitfall: ${activity.pitfall}` : '',
        activity?.confirmationCode ? `Confirmation: ${activity.confirmationCode}` : '',
        activity?.bookingRef ? `Booking ref: ${activity.bookingRef}` : ''
      ].filter(Boolean).join('\n');

      items.push({
        itineraryId: itinerary.id,
        dayDate: date,
        dayCity: day?.city || '',
        activityId: String(activity?.id || ''),
        title,
        location,
        start,
        end,
        description: metadataMode === 'full' ? fullDescription : compactDescription,
        metadataMode
      });
    }
  }
  return items;
}

function computeFingerprint(item) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({
      itineraryId: item.itineraryId,
      dayDate: item.dayDate,
      dayCity: item.dayCity,
      activityId: item.activityId,
      title: item.title,
      location: item.location,
      start: item.start.toISOString(),
      end: item.end.toISOString(),
      description: item.description,
      metadataMode: item.metadataMode
    }))
    .digest('hex');
}

function getGoogleOAuthConfig() {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3457/api/calendar/google/oauth/callback').trim();
  return { clientId, clientSecret, redirectUri };
}

function isGoogleConfigured() {
  const cfg = getGoogleOAuthConfig();
  return Boolean(cfg.clientId && cfg.clientSecret);
}

function getTokenStore() {
  return readJson(TOKENS_PATH, { byUser: {} });
}

function getUserGoogleToken(userId) {
  const store = getTokenStore();
  return store.byUser?.[userId] || null;
}

function setUserGoogleToken(userId, token) {
  const store = getTokenStore();
  store.byUser = store.byUser || {};
  store.byUser[userId] = token;
  writeJson(TOKENS_PATH, store);
}

function readSyncState() {
  return readJson(SYNC_STATE_PATH, { byUser: {} });
}

function getSyncRecord(userId, itineraryId, itemFingerprint) {
  const state = readSyncState();
  return state.byUser?.[userId]?.[itineraryId]?.[itemFingerprint] || null;
}

function setSyncRecord(userId, itineraryId, itemFingerprint, eventId) {
  const state = readSyncState();
  state.byUser = state.byUser || {};
  state.byUser[userId] = state.byUser[userId] || {};
  state.byUser[userId][itineraryId] = state.byUser[userId][itineraryId] || {};
  state.byUser[userId][itineraryId][itemFingerprint] = { eventId, updatedAt: new Date().toISOString() };
  writeJson(SYNC_STATE_PATH, state);
}

async function callGoogleCalendarApi({ accessToken, method = 'GET', path, body }) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })() : {};

  if (!response.ok) {
    const msg = data?.error?.message || data?.raw || `Google Calendar API ${response.status}`;
    const error = new Error(msg);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

async function detectConflicts({ accessToken, calendarId = 'primary', items = [] }) {
  if (!items.length) return [];

  const minStart = new Date(Math.min(...items.map((i) => i.start.getTime()))).toISOString();
  const maxEnd = new Date(Math.max(...items.map((i) => i.end.getTime()))).toISOString();

  const existing = await callGoogleCalendarApi({
    accessToken,
    path: `/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(minStart)}&timeMax=${encodeURIComponent(maxEnd)}&maxResults=2500`
  });

  const existingEvents = Array.isArray(existing?.items) ? existing.items : [];
  const conflicts = [];

  for (const item of items) {
    const itemStart = item.start.getTime();
    const itemEnd = item.end.getTime();
    for (const event of existingEvents) {
      const existingStart = new Date(event?.start?.dateTime || `${event?.start?.date}T00:00:00`).getTime();
      const existingEnd = new Date(event?.end?.dateTime || `${event?.end?.date}T23:59:59`).getTime();
      if (!Number.isFinite(existingStart) || !Number.isFinite(existingEnd)) continue;
      if (itemStart < existingEnd && existingStart < itemEnd) {
        conflicts.push({
          itemTitle: item.title,
          itemStart: item.start.toISOString(),
          itemEnd: item.end.toISOString(),
          existingTitle: event.summary || 'Untitled event',
          existingStart: event?.start?.dateTime || event?.start?.date || '',
          existingEnd: event?.end?.dateTime || event?.end?.date || ''
        });
      }
    }
  }

  return conflicts;
}

module.exports = {
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
};
