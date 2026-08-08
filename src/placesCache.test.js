const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '..', 'data', 'places-cache.json');
const aside = `${CACHE_PATH}.testaside`;
// A real cache is expensive to rebuild — every miss is a billed lookup — so move
// it out of the way rather than writing over it.
if (fs.existsSync(CACHE_PATH)) fs.renameSync(CACHE_PATH, aside);
test.after(() => {
  fs.rmSync(CACHE_PATH, { force: true });
  if (fs.existsSync(aside)) fs.renameSync(aside, CACHE_PATH);
});

const cache = require('./services/placesCache');
const details = (lat) => ({ location: { latitude: lat, longitude: 100 }, photoName: null, openingHours: '09:00-17:00' });

test('a venue matches itself across case and spacing', () => {
  // Deliberately shallow. Aggressive normalisation was built, then measured
  // against the 222 saved venue names: one extra hit, on one pair, in exchange
  // for re-keying every existing entry. scripts/cacheHitRate.js keeps the
  // comparison runnable if the corpus grows.
  assert.equal(cache.key('Casa Lucio', 'Madrid'), cache.key('  casa lucio  ', 'MADRID'));
  assert.notEqual(cache.key('Casa Lucio, Madrid', 'Madrid'), cache.key('Casa Lucio', 'Madrid'));
});

test('distinct venues stay distinct', () => {
  assert.notEqual(cache.key('Compass Cafe', 'Shangri-La'), cache.key('Compass Bar', 'Shangri-La'));
});

test('the same name in two cities does not collide', () => {
  assert.notEqual(cache.key('Central Market', 'Lijiang'), cache.key('Central Market', 'Shangri-La'));
});

test('a stored venue is readable back', () => {
  cache.set('Jiu Ge Rice Noodles', 'Lijiang', details(26.8));
  assert.equal(cache.get('  JIU GE RICE NOODLES ', 'Lijiang')?.location?.latitude, 26.8);
});

test('an alias resolves to the same entry', () => {
  // Google returned the canonical name; the phrasing the model used must hit it,
  // and so must any future run that uses the canonical one.
  cache.set('Songzanlin Monastery', 'Shangri-La', details(27.8), ['Ganden Sumtseling Monastery']);
  assert.equal(cache.get('Songzanlin Monastery', 'Shangri-La')?.location?.latitude, 27.8);
  assert.equal(cache.get('Ganden Sumtseling Monastery', 'Shangri-La')?.location?.latitude, 27.8);
});

test('a miss is remembered so the same ghost is not re-queried every run', () => {
  cache.setMiss('Invented Teahouse', 'Lijiang');
  assert.equal(cache.get('Invented Teahouse', 'Lijiang')?.miss, true);
});

test('a miss expires sooner than a hit', () => {
  // Seeded on disk rather than through set(), whose flush is debounced. A venue
  // Google has not heard of today may exist next month, and a cached miss that
  // outlives a transient outage costs more than the lookup it saves.
  const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
  fs.writeFileSync(CACHE_PATH, JSON.stringify({
    [cache.key('Ghost Venue', 'Lijiang')]: { miss: true, ts: eightDaysAgo },
    [cache.key('Real Venue', 'Lijiang')]: { ...details(26.9), ts: eightDaysAgo }
  }));
  delete require.cache[require.resolve('./services/jsonFileCache')];
  delete require.cache[require.resolve('./services/placesCache')];
  const reloaded = require('./services/placesCache');

  assert.equal(reloaded.get('Ghost Venue', 'Lijiang'), null, 'an 8-day-old miss has expired');
  assert.ok(reloaded.get('Real Venue', 'Lijiang'), 'an 8-day-old hit has not');
});
