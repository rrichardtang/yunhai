const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';

function getApiKey() {
  return process.env.BRAVE_API_KEY || '';
}

function isConfigured() {
  return Boolean(getApiKey());
}

/**
 * Search Brave Web Search API.
 * Returns an array of {title, url, description} objects (max `count`).
 * Gracefully returns [] when API key is missing or request fails.
 */
async function search(query, { count = 5, freshness } = {}) {
  const key = getApiKey();
  if (!key) return [];

  const params = new URLSearchParams({ q: query, count: String(count) });
  if (freshness) params.set('freshness', freshness);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`${BRAVE_API_URL}?${params}`, {
      headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': key },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error(`[brave] search failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    const results = data.web?.results || [];
    return results.slice(0, count).map(r => ({
      title: r.title || '',
      url: r.url || '',
      description: r.description || ''
    }));
  } catch (err) {
    clearTimeout(timer);
    console.error('[brave] search error:', err.message);
    return [];
  }
}

/**
 * Search for travel/activity info about a city.
 * Returns a compact text block suitable for LLM context injection.
 */
async function searchCityActivities(cityName, { count = 5 } = {}) {
  const results = await search(`best things to do in ${cityName} 2026`, { count });
  if (!results.length) return '';
  return results.map(r => `- ${r.title}: ${r.description}`).join('\n');
}

/**
 * General-purpose search for the chat concierge.
 * Returns compact text block from search results.
 */
async function searchForChat(query, { count = 5 } = {}) {
  const results = await search(query, { count });
  if (!results.length) return '';
  return results.map(r => `- ${r.title} (${r.url}): ${r.description}`).join('\n');
}

const CURRENCY_TO_USD = { '€': 1.1, '£': 1.3, '¥': 0.007, '₩': 0.00075 };

function parseFirstPrice(text = '') {
  // Matches: $45, €30, £25, ¥5,000, from $50, $40-60, USD 45
  const pattern = /(?:from\s+)?([€£¥₩\$])\s*([\d,]+)(?:\s*[-–]\s*([\d,]+))?|USD\s+([\d,]+)/i;
  const m = text.match(pattern);
  if (!m) return null;

  if (m[4]) return Math.round(Number(m[4].replace(/,/g, '')));

  const symbol = m[1];
  const low = Number(m[2].replace(/,/g, ''));
  const high = m[3] ? Number(m[3].replace(/,/g, '')) : low;
  const value = high; // take higher end of range (conservative)
  const multiplier = symbol === '$' ? 1 : (CURRENCY_TO_USD[symbol] || 1);
  return Math.round(value * multiplier);
}

async function searchActivityPrice(activityName, cityName) {
  const results = await search(`"${activityName}" ${cityName} price`, { count: 3 });
  for (const r of results) {
    const price = parseFirstPrice(r.description) || parseFirstPrice(r.title);
    if (price !== null && price > 0) return price;
  }
  return null;
}

async function searchActivityPricesBatch(activities, cityName) {
  const bookable = activities.filter((a) => a.booking_type && a.booking_type !== 'none');
  const results = await Promise.all(
    bookable.map((a) => searchActivityPrice(a.name, cityName))
  );
  const map = new Map();
  bookable.forEach((a, i) => map.set(a.name, results[i]));
  return map;
}

module.exports = { search, searchCityActivities, searchForChat, isConfigured, searchActivityPrice, searchActivityPricesBatch };
