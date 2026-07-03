const path = require('path');
const { jsonFileCache } = require('./jsonFileCache');

const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'places-cache.json');
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

const store = jsonFileCache(CACHE_PATH);

function key(name, city) {
  return `${String(name || '').trim().toLowerCase()}|${String(city || '').trim().toLowerCase()}`;
}

function get(name, city) {
  const entry = store.load()[key(name, city)];
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) return null;
  return entry;
}

function set(name, city, value) {
  store.load()[key(name, city)] = { ...value, ts: Date.now() };
  store.scheduleFlush();
}

module.exports = { get, set };
