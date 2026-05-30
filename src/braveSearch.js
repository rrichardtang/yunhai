const { retrieve, buildPromptFragment, shouldUseBrave, isConfigured } = require('./braveRetrieval');

async function search(query, { count = 5, freshness, task = 'general' } = {}) {
  const retrieval = await retrieve(query, { count, freshness, task });
  return (retrieval.results || []).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    description: r.snippet || ''
  }));
}

async function searchCityActivities(cityName, { count = 5, year } = {}) {
  const y = Number.isInteger(year) ? year : new Date().getFullYear();
  const retrieval = await retrieve(`best things to do in ${cityName} ${y}`, {
    count,
    task: 'planning',
    freshness: 'year'
  });
  if (!retrieval.results?.length) return '';
  return buildPromptFragment(retrieval, { title: 'Web research', maxItems: count });
}

async function searchTopRestaurants(cityName, { count = 7, year } = {}) {
  const y = Number.isInteger(year) ? year : new Date().getFullYear();
  const retrieval = await retrieve(`best restaurants in ${cityName} ${y} must order dishes`, {
    count,
    task: 'planning',
    freshness: 'year'
  });
  if (!retrieval.results?.length) return '';
  return buildPromptFragment(retrieval, { title: 'Top restaurant research', maxItems: count });
}

async function searchInsiderTips(cityName, { count = 5, year } = {}) {
  const y = Number.isInteger(year) ? year : new Date().getFullYear();
  const retrieval = await retrieve(`${cityName} travel tips locals only mistakes avoid ${y}`, {
    count,
    task: 'planning',
    freshness: 'year'
  });
  if (!retrieval.results?.length) return '';
  return buildPromptFragment(retrieval, { title: 'Local knowledge', maxItems: count });
}

async function searchShoppingDistricts(cityName, interests = '', { count = 5, year } = {}) {
  const y = Number.isInteger(year) ? year : new Date().getFullYear();
  const interestText = String(interests || '').trim();
  const query = interestText
    ? `best places to buy ${interestText} in ${cityName} ${y}`
    : `best shopping districts neighborhoods stores ${cityName} ${y}`;
  const retrieval = await retrieve(query, {
    count,
    task: 'planning',
    freshness: 'year'
  });
  if (!retrieval.results?.length) return '';
  return buildPromptFragment(retrieval, { title: 'Shopping research', maxItems: count });
}

module.exports = {
  search,
  searchCityActivities,
  searchTopRestaurants,
  searchInsiderTips,
  searchShoppingDistricts,
  isConfigured,
  shouldUseBrave
};
