const path = require('path');
const { jsonFileCache } = require('./jsonFileCache');

const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'places-cache.json');
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
// A venue Google has not heard of today may exist next month, and a cached miss
// that outlives the outage which caused it costs more than the lookup it saves.
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const store = jsonFileCache(CACHE_PATH);

// Case and whitespace only. Aggressive normalisation — diacritics, punctuation, a
// leading "The", the trailing city qualifier — was built and then measured against
// the 222 venue names in data/bakeoff: it gained ONE hit, on a single pair, while
// re-keying every existing entry. scripts/cacheHitRate.js reproduces that.
function key(name, city) {
  return `${String(name || '').trim().toLowerCase()}|${String(city || '').trim().toLowerCase()}`;
}

function get(name, city) {
  const entry = store.load()[key(name, city)];
  if (!entry) return null;
  return Date.now() - entry.ts > (entry.miss ? MISS_TTL_MS : TTL_MS) ? null : entry;
}

// `aliases` carries the names Google itself uses for the same place, so the cache
// accumulates its synonyms instead of us guessing at them: resolve "Songzanlin
// Monastery" once and "Ganden Sumtseling Monastery" hits thereafter.
function set(name, city, value, aliases = []) {
  const data = store.load();
  const entry = { ...value, ts: Date.now() };
  for (const alias of [name, ...aliases]) {
    if (String(alias || "").trim()) data[key(alias, city)] = entry;
  }
  store.scheduleFlush();
}

function setMiss(name, city) {
  store.load()[key(name, city)] = { miss: true, ts: Date.now() };
  store.scheduleFlush();
}

module.exports = { get, set, setMiss, key };
