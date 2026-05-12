const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CACHE_PATH = path.join(DATA_DIR, 'places-cache.json');
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
const FLUSH_DEBOUNCE_MS = 2000;

let cache = null;
let flushTimer = null;
let dirty = false;

function load() {
  if (cache) return cache;
  try {
    cache = fs.existsSync(CACHE_PATH) ? (JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) || {}) : {};
  } catch {
    cache = {};
  }
  return cache;
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
      // best-effort cache
    }
  }, FLUSH_DEBOUNCE_MS);
}

function key(name, city) {
  return `${String(name || '').trim().toLowerCase()}|${String(city || '').trim().toLowerCase()}`;
}

function get(name, city) {
  const store = load();
  const entry = store[key(name, city)];
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) return null;
  return entry;
}

function set(name, city, value) {
  const store = load();
  store[key(name, city)] = { ...value, ts: Date.now() };
  scheduleFlush();
}

module.exports = { get, set };
