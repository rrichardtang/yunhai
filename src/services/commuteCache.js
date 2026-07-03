const path = require('path');
const { jsonFileCache } = require('./jsonFileCache');

const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'commute-cache.json');
const TTL_MS = 365 * 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NEGATIVE_SENTINEL = -1;

const store = jsonFileCache(CACHE_PATH);

function key(origin, destination, mode) {
  return `${origin}|${destination}|${mode}`;
}

function get(origin, destination, mode) {
  if (!origin || !destination || !mode) return undefined;
  const entry = store.load()[key(origin, destination, mode)];
  if (!entry) return undefined;
  const age = Date.now() - entry.ts;
  if (entry.minutes === NEGATIVE_SENTINEL) {
    if (age > NEGATIVE_TTL_MS) return undefined;
    return null;
  }
  if (age > TTL_MS) return undefined;
  return Number.isFinite(entry.minutes) ? entry.minutes : undefined;
}

function set(origin, destination, mode, minutes) {
  if (!origin || !destination || !mode) return;
  if (!Number.isFinite(minutes)) return;
  store.load()[key(origin, destination, mode)] = { minutes, ts: Date.now() };
  store.scheduleFlush();
}

function setNegative(origin, destination, mode) {
  if (!origin || !destination || !mode) return;
  store.load()[key(origin, destination, mode)] = { minutes: NEGATIVE_SENTINEL, ts: Date.now() };
  store.scheduleFlush();
}

// Admin: drop cached entries so the next lookups re-fetch live.
function clear() {
  const total = Object.keys(store.load()).length;
  store.reset();
  return { removed: total, kind: 'all' };
}

function clearNegatives() {
  const entries = store.load();
  let removed = 0;
  for (const k of Object.keys(entries)) {
    if (entries[k]?.minutes === NEGATIVE_SENTINEL) { delete entries[k]; removed += 1; }
  }
  store.flushNow();
  return { removed, kind: 'negatives' };
}

module.exports = { get, set, setNegative, clear, clearNegatives };
