const test = require('node:test');
const assert = require('node:assert/strict');
const { shortCity, cityImageQueries, scoreImageMatch } = require('./imageQuery');

const SHANGRI_LA = 'Shangri-La City, Diqing Tibetan Autonomous Prefecture, Yunnan, China';

test('shortCity keeps only the leading segment of a qualified place name', () => {
  assert.equal(shortCity(SHANGRI_LA), 'Shangri-La City');
  assert.equal(shortCity('Lijiang, Yunnan, China'), 'Lijiang');
  assert.equal(shortCity('Paris'), 'Paris');
  assert.equal(shortCity(''), '');
  assert.equal(shortCity(null), '');
});

test('city queries never carry the qualified name', () => {
  const queries = cityImageQueries(SHANGRI_LA);
  assert.equal(queries.length, 3);
  for (const q of queries) {
    assert.doesNotMatch(q, /Prefecture|Yunnan|China/, `leaked qualifiers into "${q}"`);
    assert.match(q, /Shangri-La City/);
  }
});

test('an unknown city produces no queries rather than a blank search', () => {
  assert.deepEqual(cityImageQueries(''), []);
});

// The bug that broke this trip: every word of the qualified city name was used as
// a stopword list, so "Tibetan" was stripped out of the activity's own name.
test('a city qualifier that also appears in the activity name is not stripped', () => {
  const activity = { name: 'Tibetan Thangka Painting Workshop', type: 'tour', city: SHANGRI_LA };
  const tibetanPhoto = scoreImageMatch(activity, 'tibetan thangka painting on silk');
  const unrelatedPhoto = scoreImageMatch(activity, 'a still lake at dawn');
  assert.ok(tibetanPhoto > unrelatedPhoto, `${tibetanPhoto} should beat ${unrelatedPhoto}`);
});

test('name overlap outranks type overlap', () => {
  const activity = { name: 'Black Dragon Pool Park', type: 'landmark', city: 'Lijiang, Yunnan, China' };
  const named = scoreImageMatch(activity, 'black dragon pool reflecting the mountains');
  const typed = scoreImageMatch(activity, 'an ornate monument and tower');
  assert.ok(named > typed, `${named} should beat ${typed}`);
});

test('type hints break ties between otherwise unrelated photos', () => {
  const activity = { name: 'Yishi Roasted Duck', type: 'meal', city: 'Lijiang, Yunnan, China' };
  const foodish = scoreImageMatch(activity, 'a restaurant dining room');
  const scenic = scoreImageMatch(activity, 'snow on a distant ridge');
  assert.ok(foodish > scenic, `${foodish} should beat ${scenic}`);
});

test('the city name itself does not inflate a photo score', () => {
  const activity = { name: 'Lijiang Old Town Walk', type: 'neighborhood', city: 'Lijiang, Yunnan, China' };
  // "Lijiang" is excluded as a city word, so only "Old"/"Town"/"Walk" can match.
  assert.equal(scoreImageMatch(activity, 'lijiang'), 0);
  assert.ok(scoreImageMatch(activity, 'lijiang old town') > 0);
});

test('an empty photo description scores zero without throwing', () => {
  const activity = { name: 'Anything', type: 'tour', city: 'Paris' };
  assert.equal(scoreImageMatch(activity, ''), 0);
  assert.equal(scoreImageMatch(activity, null), 0);
  assert.equal(scoreImageMatch(undefined, 'some photo'), 0);
});
