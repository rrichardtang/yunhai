// Tests for public/js/cityPlanner.js.
//
// This module was extracted out of app.js months ago but stayed untestable: it attached to `window`
// and nothing else, so Node could not require it. It now carries the same guarded `module.exports`
// footer `shared/` already used, which is what makes this file possible.
const test = require('node:test');
const assert = require('node:assert');

const { normalizeCoordinate, cityMatches, normalizeCity } = require('../public/js/cityPlanner.js');

test('normalizeCoordinate keeps "not resolved yet" distinct from the equator', () => {
  // Number(null) and Number('') are both 0, which put unresolved cities at 0,0 off West Africa and
  // slipped past the Number.isFinite() gates meant to catch exactly that.
  for (const unset of [null, undefined, '']) {
    assert.strictEqual(normalizeCoordinate(unset), null, `${JSON.stringify(unset)} must not become 0`);
  }
  assert.strictEqual(normalizeCoordinate(0), 0, 'a real 0 coordinate must survive');
  assert.strictEqual(normalizeCoordinate('35.6762'), 35.6762);
  assert.strictEqual(normalizeCoordinate('not a number'), null);
});

test('normalizeCoordinate is idempotent, so a re-render does not read as a user edit', () => {
  for (const input of [null, '', 0, '35.6762', 'garbage']) {
    const once = normalizeCoordinate(input);
    assert.strictEqual(normalizeCoordinate(once), once, `unstable for ${JSON.stringify(input)}`);
  }
});

test('cityMatches ignores case, padding and accents', () => {
  assert.ok(cityMatches('Málaga', 'malaga'));
  assert.ok(cityMatches('  Tokyo ', 'tokyo'));
  assert.strictEqual(normalizeCity('Málaga'), 'malaga');
});
