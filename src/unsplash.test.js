const test = require('node:test');
const assert = require('node:assert/strict');
const { pickImageForActivity } = require('./unsplash');

const realFetch = global.fetch;
const realKey = process.env.UNSPLASH_ACCESS_KEY;

// The pool cache is module-level and keyed by city, so each test uses its own
// city name to stay independent of the others.
let cityCounter = 0;
const freshCity = (label) => `${label}${cityCounter++}, Some Province, Somewhere`;

function stubSearch(resultsByQuery) {
  const queries = [];
  global.fetch = async (url) => {
    const query = new URL(url).searchParams.get('query');
    queries.push(query);
    const results = (resultsByQuery[query] || resultsByQuery.default || []).map((text, i) => ({
      urls: { regular: `https://images.example/${query}/${i}` },
      alt_description: text,
      tags: []
    }));
    return { ok: true, json: async () => ({ results }) };
  };
  return queries;
}

test.afterEach(() => {
  global.fetch = realFetch;
  if (realKey === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
  else process.env.UNSPLASH_ACCESS_KEY = realKey;
});

test('a whole city of activities collapses into one set of searches', async () => {
  process.env.UNSPLASH_ACCESS_KEY = 'test-key';
  const city = freshCity('Lijiang');
  const queries = stubSearch({ default: ['old town roofs', 'a mountain', 'a noodle shop'] });

  // The plan step fires one /api/image per activity, all at once.
  const picks = await Promise.all(
    Array.from({ length: 36 }, (_, i) =>
      pickImageForActivity({ name: `Activity ${i}`, city, type: 'landmark' })
    )
  );

  assert.equal(queries.length, 3, `expected 3 searches, got ${queries.length}`);
  assert.equal(picks.filter(Boolean).length, 36);
});

test('a repeat plan for the same city hits the cache with no further searches', async () => {
  process.env.UNSPLASH_ACCESS_KEY = 'test-key';
  const city = freshCity('Kyoto');
  const queries = stubSearch({ default: ['a temple', 'a garden'] });

  await pickImageForActivity({ name: 'First', city, type: 'landmark' });
  const afterFirst = queries.length;
  await pickImageForActivity({ name: 'Second', city, type: 'landmark' });

  assert.equal(queries.length, afterFirst, 'second activity should not re-search');
});

test('distinct activities get distinct photos while the pool lasts', async () => {
  process.env.UNSPLASH_ACCESS_KEY = 'test-key';
  const city = freshCity('Porto');
  stubSearch({ default: ['a bridge', 'a tiled facade', 'a river'] });

  const a = await pickImageForActivity({ name: 'Bridge Walk', city, type: 'landmark' });
  const b = await pickImageForActivity({ name: 'Tile Museum', city, type: 'museum' });

  assert.notEqual(a, b);
});

test('the best-matching photo wins over pool order', async () => {
  process.env.UNSPLASH_ACCESS_KEY = 'test-key';
  const city = freshCity('Shangri-La City');
  stubSearch({ default: ['a still lake', 'tibetan thangka painting on silk', 'a yak'] });

  const pick = await pickImageForActivity({
    name: 'Tibetan Thangka Painting Workshop', city, type: 'tour'
  });

  assert.match(pick, /\/1$/, 'expected the thangka photo (index 1), not the first result');
});

test('a city with no results yields null rather than a broken image', async () => {
  process.env.UNSPLASH_ACCESS_KEY = 'test-key';
  const city = freshCity('Nowhere');
  stubSearch({ default: [] });

  assert.equal(await pickImageForActivity({ name: 'Anything', city, type: 'tour' }), null);
});

test('an empty pool is not cached, so a later request retries', async () => {
  process.env.UNSPLASH_ACCESS_KEY = 'test-key';
  const city = freshCity('Flaky');

  const failing = stubSearch({ default: [] });
  await pickImageForActivity({ name: 'First', city, type: 'tour' });
  assert.equal(failing.length, 3);

  const recovered = stubSearch({ default: ['a plaza'] });
  const pick = await pickImageForActivity({ name: 'Second', city, type: 'tour' });
  assert.equal(recovered.length, 3, 'expected a retry after the empty result');
  assert.ok(pick);
});

test('a missing API key surfaces a typed error for the 503 path', async () => {
  delete process.env.UNSPLASH_ACCESS_KEY;
  await assert.rejects(
    () => pickImageForActivity({ name: 'Anything', city: freshCity('Keyless'), type: 'tour' }),
    (err) => err.code === 'UNSPLASH_KEY_MISSING'
  );
});
