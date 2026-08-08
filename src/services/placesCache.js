const path = require('path');
const { jsonFileCache } = require('./jsonFileCache');

const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'places-cache.json');
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
// A venue Google has not heard of today may exist next month, and a cached miss
// that outlives the outage which caused it costs more than the lookup it saves.
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const store = jsonFileCache(CACHE_PATH);

function strip(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// The key used to be the model's raw prose, so a hit needed two runs to invent an
// identical string. Collapsing case, punctuation, a leading "The" and the trailing
// city qualifier the prompt asks for on meals ("Casa Lucio, Madrid") lets the same
// venue match itself across runs, models and prompt revisions.
function normalize(name, city) {
  const cityWords = new Set(strip(city).split(' ').filter(Boolean));
  const words = strip(name).replace(/^the /, '').split(' ').filter(Boolean);
  while (words.length > 1 && cityWords.has(words[words.length - 1])) words.pop();
  return words.join(' ');
}

function key(name, city) {
  return `${normalize(name, city)}|${strip(city)}`;
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
    if (normalize(alias, city)) data[key(alias, city)] = entry;
  }
  store.scheduleFlush();
}

function setMiss(name, city) {
  store.load()[key(name, city)] = { miss: true, ts: Date.now() };
  store.scheduleFlush();
}

module.exports = { get, set, setMiss, normalize, key };
