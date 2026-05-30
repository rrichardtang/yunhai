const test = require('node:test');
const assert = require('node:assert/strict');

const { shouldUseBrave, buildPromptFragment, retrieve } = require('./braveRetrieval');

test('shouldUseBrave routes live concierge queries and skips rewrite queries', () => {
  assert.equal(shouldUseBrave('chat_concierge', { userMessage: 'Best sushi restaurants in Tokyo open now?' }), true);
  assert.equal(shouldUseBrave('chat_concierge', { userMessage: 'Recommend some shops in Tokyo' }), true);
  assert.equal(shouldUseBrave('chat_concierge', { userMessage: 'Rewrite this paragraph in a friendlier tone' }), false);
  assert.equal(shouldUseBrave('summarization', { userMessage: 'summarize this' }), false);
  assert.equal(shouldUseBrave('planning', {}), true);
  assert.equal(shouldUseBrave('entity_enrichment', {}), true);
});

test('buildPromptFragment includes links and sparse fallback language', () => {
  const fragment = buildPromptFragment({
    results: [
      { title: 'A', url: 'https://example.com/a', snippet: 'Alpha recommendation' },
      { title: 'B', url: 'https://example.com/b', snippet: 'Beta recommendation' }
    ],
    meta: { weak: false }
  }, { title: 'Web Search Results', maxItems: 2 });

  assert.match(fragment, /Web Search Results/);
  assert.match(fragment, /https:\/\/example.com\/a/);

  const empty = buildPromptFragment({ results: [] });
  assert.match(empty, /no strong live results/i);
});

test('retrieve returns standardized schema when Brave key is missing', async () => {
  const oldKey = process.env.BRAVE_API_KEY;
  delete process.env.BRAVE_API_KEY;

  const result = await retrieve('tokyo best ramen', { task: 'chat_concierge' });
  assert.equal(result.ok, false);
  assert.equal(result.provider, 'brave');
  assert.equal(result.task, 'chat_concierge');
  assert.ok(Array.isArray(result.results));
  assert.equal(result.meta.error.code, 'BRAVE_KEY_MISSING');

  if (oldKey) process.env.BRAVE_API_KEY = oldKey;
});
