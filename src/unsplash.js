const cache = new Map();

async function fetchUnsplashImage(query, city) {
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    const err = new Error('Unsplash API key not configured');
    err.code = 'UNSPLASH_KEY_MISSING';
    throw err;
  }

  const key = `${query}__${city || ''}`.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const q = encodeURIComponent(`${query} ${city || ''}`.trim());
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

module.exports = { fetchUnsplashImage };
