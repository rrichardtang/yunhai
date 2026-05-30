const { search } = require('../braveSearch');

const MAX_SEARCH_CALLS = 2;

const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the live web for current travel facts: restaurant/activity/nightlife recommendations, opening hours, prices, weather, safety, events, "is X worth it", what to book ahead. Write a complete, self-contained query — include the city, and when the user says "my hotel"/"near me"/"where we are staying", put the actual accommodation address from the trip context into the query. Do NOT call this for questions about how the app/website works.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A complete web search query, e.g. "best izakaya dinner near Park Hotel Tokyo, Shiodome".' }
      },
      required: ['query'],
      additionalProperties: false
    }
  }
};

function formatSearchResultsForModel(results) {
  if (!Array.isArray(results) || !results.length) {
    return 'No strong live results found. Say that plainly, then offer the best fallback from the known trip context.';
  }
  return results
    .map((r, i) => `${i + 1}. ${r.title}${r.url ? ` — ${r.url}` : ''}${r.description ? `\n   ${r.description}` : ''}`)
    .join('\n');
}

async function runWebSearch(query) {
  const results = await search(query, { count: 5, task: 'chat_concierge' });
  return formatSearchResultsForModel(results);
}

module.exports = { WEB_SEARCH_TOOL, MAX_SEARCH_CALLS, formatSearchResultsForModel, runWebSearch };
