const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CACHE_PATH = path.join(DATA_DIR, 'commute-cache.json');
const TTL_MS = 365 * 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NEGATIVE_SENTINEL = -1;
const FLUSH_DEBOUNCE_MS = 2000;

let cache = null;
let flushTimer = null;
let dirty = false;

function load() {
  if (cache) return cache;
  try {
    if (fs.existsSync(CACHE_PATH)) {
      cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) || {};
    } else {
      cache = {};
    }
  } catch {
    cache = {};
  }
  return cache;
}

function flushNow() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  dirty = false;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
  } catch {
    // best-effort cache; swallow
  }
}

function scheduleFlush() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (!dirty) return;
    dirty = false;
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
    } catch {
      // best-effort cache; swallow
    }
  }, FLUSH_DEBOUNCE_MS);
}

function key(origin, destination, mode) {
  return `${origin}|${destination}|${mode}`;
}

function get(origin, destination, mode) {
  if (!origin || !destination || !mode) return undefined;
  const store = load();
  const entry = store[key(origin, destination, mode)];
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
  const store = load();
  store[key(origin, destination, mode)] = { minutes, ts: Date.now() };
  scheduleFlush();
}

function setNegative(origin, destination, mode) {
  if (!origin || !destination || !mode) return;
  const store = load();
  store[key(origin, destination, mode)] = { minutes: NEGATIVE_SENTINEL, ts: Date.now() };
  scheduleFlush();
}

// Admin: drop cached entries so the next lookups re-fetch live. Clears the
// in-memory store (the source of truth for the running process) and the file.
function clear() {
  const store = load();
  const total = Object.keys(store).length;
  cache = {};
  flushNow();
  return { removed: total, kind: 'all' };
}

function clearNegatives() {
  const store = load();
  let removed = 0;
  for (const k of Object.keys(store)) {
    if (store[k]?.minutes === NEGATIVE_SENTINEL) { delete store[k]; removed += 1; }
  }
  flushNow();
  return { removed, kind: 'negatives' };
}

module.exports = { get, set, setNegative, clear, clearNegatives };
