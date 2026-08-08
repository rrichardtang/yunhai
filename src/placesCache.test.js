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

test('the same venue matches itself across phrasings', () => {
  for (const [a, b, city] of [
    ['Casa Lucio, Madrid', 'casa lucio', 'Madrid'],
    ['The Rooftop Bistro', 'rooftop bistro', 'Lijiang'],
    ['Café Central', 'Cafe Central', 'Vienna'],
    ['Heshu  Restaurant , Lijiang', 'Heshu Restaurant', 'Lijiang']
  ]) {
    assert.equal(cache.normalize(a, city), cache.normalize(b, city), `${a} vs ${b}`);
  }
});

test('distinct venues stay distinct', () => {
  assert.notEqual(cache.normalize('Compass Cafe', 'Shangri-La'), cache.normalize('Compass Bar', 'Shangri-La'));
  assert.notEqual(cache.normalize('Mu Family Mansion', 'Lijiang'), cache.normalize('Mu Mansion Garden', 'Lijiang'));
});

test('the same name in two cities does not collide', () => {
  assert.notEqual(cache.key('Central Market', 'Lijiang'), cache.key('Central Market', 'Shangri-La'));
});

test('a stored venue is readable under a normalised variant', () => {
  cache.set('Jiu Ge Rice Noodles, Lijiang', 'Lijiang', details(26.8));
  assert.equal(cache.get('jiu ge rice noodles', 'Lijiang')?.location?.latitude, 26.8);
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
