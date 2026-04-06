const cache = new Map();

const FALLBACK_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'at', 'in', 'for', 'on', 'with', 'from', 'to',
  'of', 'by', 'near', 'around', 'best', 'top'
]);

function extractFallbackKeywords(preciseQuery, city, type) {
  const cityWords = new Set(
    String(city || '')
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
  );

  const typeWords = new Set(
    String(type || '')
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
  );

  const keywords = [];
  const words = String(preciseQuery || '')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .map((word) => word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
    .filter(Boolean);

  for (const word of words) {
    const normalized = word.toLowerCase();
    if (FALLBACK_STOPWORDS.has(normalized)) continue;
    if (cityWords.has(normalized)) continue;
    if (typeWords.has(normalized)) continue;
    if (normalized.length <= 1) continue;
    if (keywords.some((keyword) => keyword.toLowerCase() === normalized)) continue;
    keywords.push(word);
    if (keywords.length >= 2) break;
  }

  return keywords;
}

async function searchUnsplash(query) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return null;

  const key = normalizedQuery.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const q = encodeURIComponent(normalizedQuery);
  const url = `https://api.unsplash.com/search/photos?query=${q}&per_page=1&orientation=landscape`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
    }
  });

  if (res.status === 403 || res.status === 429) {
    console.warn('[unsplash] Rate limit hit — returning null');
    cache.set(key, null);
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unsplash request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const imageUrl = data?.results?.[0]?.urls?.regular || null;
  cache.set(key, imageUrl);
  return imageUrl;
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
