const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'itineraries.json');
const MAX_ITEMS = 50;

function ensureStoreFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ latestId: null, items: [] }, null, 2));
  }
}

function readStore() {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      latestId: parsed.latestId || (items[0]?.id || null),
      items
    };
  } catch {
    return { latestId: null, items: [] };
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
  return {
    id: itinerary.id,
    tripName: itinerary.tripName || 'Untitled Trip',
    generatedAt: itinerary.generatedAt,
    days: days.length,
    activityCount
  };
}

function saveItinerary(payload = {}) {
  const store = readStore();
  const now = new Date().toISOString();
  const itinerary = {
    ...payload,
    id: createId(),
    generatedAt: now
  };

  const items = [itinerary, ...store.items].slice(0, MAX_ITEMS);
  const next = { latestId: itinerary.id, items };
  writeStore(next);
  return itinerary;
}

function getLatestItinerary() {
  const store = readStore();
  if (!store.items.length) return null;
  return store.items.find((item) => item.id === store.latestId) || store.items[0];
}

function getItineraryById(id) {
  if (!id) return null;
  const store = readStore();
  return store.items.find((item) => item.id === id) || null;
}

function listItineraries() {
  const store = readStore();
  return store.items.map(summarizeItinerary);
}

function deleteItinerary(id) {
  if (!id) return false;
  const store = readStore();
  const nextItems = store.items.filter((item) => item.id !== id);
  if (nextItems.length === store.items.length) return false;

  const nextLatestId = store.latestId === id ? (nextItems[0]?.id || null) : store.latestId;
  writeStore({ latestId: nextLatestId, items: nextItems });
  return true;
}

module.exports = {
  saveItinerary,
  getLatestItinerary,
  getItineraryById,
  listItineraries,
  deleteItinerary
};
