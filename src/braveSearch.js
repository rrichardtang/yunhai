const { retrieve, buildPromptFragment, shouldUseBrave, isConfigured } = require('./braveRetrieval');

async function search(query, { count = 5, freshness, task = 'general' } = {}) {
  const retrieval = await retrieve(query, { count, freshness, task });
  return (retrieval.results || []).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    description: r.snippet || ''
  }));
}

async function searchCityActivities(cityName, { count = 5 } = {}) {
  const retrieval = await retrieve(`best things to do in ${cityName} 2026`, {
    count,
    task: 'planning',
    freshness: 'year'
  });
  if (!retrieval.results?.length) return '';
  return buildPromptFragment(retrieval, { title: 'Web research', maxItems: count });
}

async function searchForChat(query, { count = 5 } = {}) {
  const retrieval = await retrieve(query, { count, task: 'chat_concierge' });
  if (!retrieval.results?.length) return '';
  return buildPromptFragment(retrieval, { title: 'Web Search Results', maxItems: count });
}

const CURRENCY_TO_USD = { '€': 1.1, '£': 1.3, '¥': 0.007, '₩': 0.00075 };

function parseFirstPrice(text = '') {
  const pattern = /(?:from\s+)?([€£¥₩\$])\s*([\d,]+)(?:\s*[-–]\s*([\d,]+))?|USD\s+([\d,]+)/i;
  const m = text.match(pattern);
  if (!m) return null;

  if (m[4]) return Math.round(Number(m[4].replace(/,/g, '')));

  const symbol = m[1];
  const low = Number(m[2].replace(/,/g, ''));
  const high = m[3] ? Number(m[3].replace(/,/g, '')) : low;
  const value = high;
  const multiplier = symbol === '$' ? 1 : (CURRENCY_TO_USD[symbol] || 1);
  return Math.round(value * multiplier);
}

async function searchActivityPrice(activityName, cityName) {
  const retrieval = await retrieve(`"${activityName}" ${cityName} price`, { count: 3, task: 'entity_enrichment' });
  for (const r of (retrieval.results || [])) {
    const price = parseFirstPrice(r.snippet) || parseFirstPrice(r.title);
    if (price !== null && price > 0) return price;
  }
  return null;
}

async function searchTopRestaurants(cityName, { count = 7 } = {}) {
  const retrieval = await retrieve(`best restaurants in ${cityName} 2026 must order dishes`, {
    count,
    task: 'planning',
    freshness: 'year'
  });
  if (!retrieval.results?.length) return '';
  return buildPromptFragment(retrieval, { title: 'Top restaurant research', maxItems: count });
}

async function searchActivityPricesBatch(activities, cityName) {
  const bookable = activities.filter((a) => a.booking_type && a.booking_type !== 'none');
  const results = await Promise.all(bookable.map((a) => searchActivityPrice(a.name, cityName)));
  const map = new Map();
  bookable.forEach((a, i) => map.set(a.name, results[i]));
  return map;
}

module.exports = {
  search,
  searchCityActivities,
  searchTopRestaurants,
  searchForChat,
  isConfigured,
  shouldUseBrave,
  searchActivityPrice,
  searchActivityPricesBatch
};
