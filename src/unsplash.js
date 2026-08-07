const { fetchWithTimeout } = require('./services/fetchWithTimeout');
const { shortCity, cityImageQueries, scoreImageMatch } = require('./services/imageQuery');
const { debugLog } = require('./services/debugLog');

const POOL_TTL_MS = 60 * 60 * 1000;
const POOL_MAX_CITIES = 50;
const PER_QUERY_RESULTS = 30;

// One pool per city, shared by every activity in that city. The entry holds the
// in-flight promise rather than the resolved photos so that the ~36 concurrent
// /api/image calls a plan kicks off collapse into a single set of searches.
const poolCache = new Map();

function prunePools() {
  const now = Date.now();
  for (const [key, entry] of poolCache.entries()) {
    if (entry.expiresAt <= now) poolCache.delete(key);
  }
  while (poolCache.size > POOL_MAX_CITIES) {
    poolCache.delete(poolCache.keys().next().value);
  }
}

async function searchPhotos(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${PER_QUERY_RESULTS}&orientation=landscape`;
  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }
  });

  if (!res.ok) {
    debugLog('unsplash', `search failed query="${query}" status=${res.status}`);
    return [];
  }

  const data = await res.json();
  return (data?.results || [])
    .filter((r) => r?.urls?.regular)
    .map((r) => ({
      url: r.urls.regular,
      text: [r.alt_description, r.description, ...(r.tags || []).map((t) => t.title)]
        .filter(Boolean)
        .join(' ')
    }));
}

async function buildPool(city) {
  const queries = cityImageQueries(city);
  const results = await Promise.all(queries.map((q) => searchPhotos(q).catch(() => [])));

  const byUrl = new Map();
  for (const photo of results.flat()) {
    if (!byUrl.has(photo.url)) byUrl.set(photo.url, photo);
  }

  const photos = [...byUrl.values()];
  debugLog('unsplash', `pool city="${shortCity(city)}" queries=${queries.length} photos=${photos.length}`);
  return photos;
}

function getCityImagePool(city) {
  const key = shortCity(city).toLowerCase();
  if (!key) return Promise.resolve({ photos: [], used: new Set() });

  const entry = poolCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.promise;

  const used = new Set();
  const promise = buildPool(city).then((photos) => {
    // An empty pool means the search failed or the city is unknown. Drop the
    // entry so a later request retries instead of caching the miss for an hour.
    if (!photos.length) poolCache.delete(key);
    return { photos, used };
  });

  poolCache.set(key, { promise, expiresAt: Date.now() + POOL_TTL_MS });
  prunePools();
  return promise;
}

async function pickImageForActivity({ name, city, type }) {
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    const err = new Error('Unsplash API key not configured');
    err.code = 'UNSPLASH_KEY_MISSING';
    throw err;
  }

  const { photos, used } = await getCityImagePool(city);
  if (!photos.length) return null;

  const activity = { name, city, type };
  let best = null;
  let bestScore = -1;
  for (const photo of photos) {
    if (used.has(photo.url)) continue;
    const score = scoreImageMatch(activity, photo.text);
    if (score > bestScore) {
      best = photo;
      bestScore = score;
    }
  }

  // Every photo already spoken for — reuse the best match rather than show nothing.
  if (!best) best = photos.reduce((a, b) => (scoreImageMatch(activity, b.text) > scoreImageMatch(activity, a.text) ? b : a));

  used.add(best.url);
  return best.url;
}

module.exports = { pickImageForActivity, getCityImagePool };
