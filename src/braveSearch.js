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

  try {
    const res = await fetch(`${BRAVE_API_URL}?${params}`, {
      headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': key }
    });
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
async function searchForChat(query, { count = 3 } = {}) {
  const results = await search(query, { count });
  if (!results.length) return '';
  return results.map(r => `- ${r.title} (${r.url}): ${r.description}`).join('\n');
}

module.exports = { search, searchCityActivities, searchForChat, isConfigured };
