const { fetchWithTimeout } = require('./services/fetchWithTimeout');
const { extractKeywords, toWordSet } = require('./services/imageQuery');
const { debugLog } = require('./services/debugLog');

const CACHE_MAX_ENTRIES = 500;
const cache = new Map();
const usedUrls = new Set();

function capSize(collection) {
  while (collection.size > CACHE_MAX_ENTRIES) {
    collection.delete(collection.keys().next().value);
  }
}

function extractFallbackKeywords(preciseQuery, city, type) {
  const excludeWords = new Set([...toWordSet(city), ...toWordSet(type)]);
  return extractKeywords(preciseQuery, { excludeWords, limit: 2 });
}

async function searchUnsplash(query) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return null;

  const key = normalizedQuery.toLowerCase();
  if (cache.has(key)) {
    const urls = cache.get(key);
    if (!Array.isArray(urls)) return urls;
    const picked = urls.find((u) => !usedUrls.has(u)) || urls[0] || null;
    if (picked) {
      usedUrls.add(picked);
      capSize(usedUrls);
    }
    return picked;
  }

  const q = encodeURIComponent(normalizedQuery);
  const url = `https://api.unsplash.com/search/photos?query=${q}&per_page=5&orientation=landscape`;

  const res = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
    }
  });

  if (res.status === 403 || res.status === 429) {
    debugLog('unsplash', 'rate limit hit — returning null');
    cache.set(key, null);
    capSize(cache);
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unsplash request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const urls = (data?.results || []).map((r) => r?.urls?.regular).filter(Boolean);
  cache.set(key, urls);
  capSize(cache);
  const picked = urls.find((u) => !usedUrls.has(u)) || urls[0] || null;
  if (picked) {
    usedUrls.add(picked);
    capSize(usedUrls);
  }
  return picked;
}

async function fetchUnsplashImage(query, city, type) {
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    const err = new Error('Unsplash API key not configured');
    err.code = 'UNSPLASH_KEY_MISSING';
    throw err;
  }

  const preciseQuery = String(query || '').trim();
  const normalizedCity = String(city || '').trim();
  const fallbackKeywords = extractFallbackKeywords(preciseQuery, normalizedCity, type);
  const fallbackQuery = [fallbackKeywords.join(' '), normalizedCity]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (preciseQuery) {
    const preciseResult = await searchUnsplash(preciseQuery);
    if (preciseResult) return preciseResult;
  }

  if (fallbackQuery && fallbackQuery.toLowerCase() !== preciseQuery.toLowerCase()) {
    return searchUnsplash(fallbackQuery);
  }

  return null;
}

module.exports = { fetchUnsplashImage };
