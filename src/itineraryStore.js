const fs = require('fs');
const path = require('path');
const { isLegacyActivity, migrateActivity } = require('./activityMigration');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'itineraries.json');
const MAX_ITEMS_PER_USER = 50;

function ensureStoreFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ latestByUser: {}, items: [] }, null, 2));
  }
}

function migrateItinerary(itinerary) {
  if (!itinerary || itinerary._schemaVersion >= 2) return itinerary;
  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  return {
    ...itinerary,
    days: days.map((day) => ({
      ...day,
      activities: Array.isArray(day.activities)
        ? day.activities.map((a) => isLegacyActivity(a) ? migrateActivity(a) : a)
        : []
    }))
  };
}

function readStore() {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed.items) ? parsed.items.map(migrateItinerary) : [];
    const latestByUser = parsed.latestByUser && typeof parsed.latestByUser === 'object' ? parsed.latestByUser : {};
    return { latestByUser, items };
  } catch {
    return { latestByUser: {}, items: [] };
  }
}

function writeStore(store) {
  ensureStoreFile();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function createId() {
  return `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeItinerary(itinerary = {}) {
  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  const activityCount = days.reduce((sum, day) => sum + (Array.isArray(day.activities) ? day.activities.length : 0), 0);
  const bookingCount = Array.isArray(itinerary.bookings) ? itinerary.bookings.length : 0;
  return {
    id: itinerary.id,
    tripName: itinerary.tripName || 'Untitled Trip',
    generatedAt: itinerary.generatedAt,
    days: days.length,
    activityCount,
    bookingCount
  };
}

function saveItinerary(payload = {}, userId) {
  if (!userId) throw new Error('userId is required');

  const store = readStore();
  const now = new Date().toISOString();
  const itinerary = {
    ...payload,
    id: createId(),
    userId,
    _schemaVersion: 2,
    bookings: Array.isArray(payload.bookings) ? payload.bookings : [],
    generatedAt: now,
    updatedAt: now
  };

  const userExisting = store.items.filter((item) => item.userId === userId);
  const otherUsers = store.items.filter((item) => item.userId !== userId);
  const nextUserItems = [itinerary, ...userExisting].slice(0, MAX_ITEMS_PER_USER);

  const next = {
    latestByUser: {
      ...(store.latestByUser || {}),
      [userId]: itinerary.id
    },
    items: [...nextUserItems, ...otherUsers]
  };

  writeStore(next);
  return itinerary;
}

function updateItinerary(id, payload = {}, userId) {
  if (!id || !userId) return null;
  const store = readStore();
  const idx = store.items.findIndex((item) => item.id === id && item.userId === userId);
  if (idx === -1) return null;

  const existing = store.items[idx];
  store.items[idx] = {
    ...existing,
    ...payload,
    id: existing.id,
    userId: existing.userId,
    _schemaVersion: 2,
    bookings: Array.isArray(payload.bookings) ? payload.bookings : existing.bookings,
    generatedAt: existing.generatedAt,
    updatedAt: new Date().toISOString()
  };
  store.latestByUser[userId] = id;
  writeStore(store);
  return store.items[idx];
}

function getLatestItinerary(userId) {
  if (!userId) return null;
  const store = readStore();
  const userItems = store.items.filter((item) => item.userId === userId);
  if (!userItems.length) return null;

  const latestId = store.latestByUser?.[userId] || null;
  return userItems.find((item) => item.id === latestId) || userItems[0];
}

function getItineraryById(id, userId) {
  if (!id || !userId) return null;
  const store = readStore();
  return store.items.find((item) => item.id === id && item.userId === userId) || null;
}

function listItineraries(userId) {
  if (!userId) return [];
  const store = readStore();
  return store.items
    .filter((item) => item.userId === userId)
    .map(summarizeItinerary);
}

function deleteItinerary(id, userId) {
  if (!id || !userId) return false;
  const store = readStore();
  const nextItems = store.items.filter((item) => !(item.id === id && item.userId === userId));
  if (nextItems.length === store.items.length) return false;

  const remainingForUser = nextItems.filter((item) => item.userId === userId);
  const nextLatestByUser = { ...(store.latestByUser || {}) };
  if (nextLatestByUser[userId] === id) {
    if (remainingForUser[0]?.id) nextLatestByUser[userId] = remainingForUser[0].id;
    else delete nextLatestByUser[userId];
  }

  writeStore({ latestByUser: nextLatestByUser, items: nextItems });
  return true;
}

function addParsedBookings({ userId, itineraryId = '', bookings = [], source = {} }) {
  if (!userId || !Array.isArray(bookings) || !bookings.length) return null;

  const store = readStore();
  const itinerary = itineraryId
    ? store.items.find((item) => item.id === itineraryId && item.userId === userId)
    : (store.items.find((item) => item.id === store.latestByUser?.[userId] && item.userId === userId)
      || store.items.find((item) => item.userId === userId));

  if (!itinerary) return null;

  const existing = Array.isArray(itinerary.bookings) ? itinerary.bookings : [];
  const normalized = bookings.map((booking) => ({
    id: `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind: String(booking.kind || 'other').toLowerCase(),
    provider: String(booking.provider || '').trim(),
    title: String(booking.title || '').trim(),
    confirmationCode: String(booking.confirmationCode || '').trim(),
    startDate: String(booking.startDate || '').trim(),
    endDate: String(booking.endDate || '').trim(),
    location: String(booking.location || '').trim(),
    rawSnippet: String(booking.rawSnippet || '').slice(0, 600),
    source,
    createdAt: new Date().toISOString()
  }));

  itinerary.bookings = [...existing, ...normalized].slice(-200);
  itinerary.updatedAt = new Date().toISOString();

  writeStore(store);
  return {
    itineraryId: itinerary.id,
    added: normalized.length,
    bookings: normalized
  };
}

function updateBookingChecklist(id, userId, bookingChecklist = {}) {
  if (!id || !userId) return null;
  const store = readStore();
  const itinerary = store.items.find((item) => item.id === id && item.userId === userId);
  if (!itinerary) return null;

  itinerary.bookingChecklist = {
    ...(itinerary.bookingChecklist || {}),
    ...bookingChecklist,
    updatedAt: new Date().toISOString()
  };
  itinerary.updatedAt = new Date().toISOString();
  writeStore(store);
  return itinerary;
}

module.exports = {
  saveItinerary,
  updateItinerary,
  getLatestItinerary,
  getItineraryById,
  listItineraries,
  deleteItinerary,
  addParsedBookings,
  updateBookingChecklist
};
