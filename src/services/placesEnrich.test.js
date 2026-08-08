const test = require('node:test');
const assert = require('node:assert/strict');
const { enrichWithPlaceDetails } = require('./placesEnrich');
const placesCache = require('./placesCache');

const PHOTO_URI = 'https://lh3.googleusercontent.com/places/photo-abc';

// placesCache is disk-backed with a 90-day TTL, so a fixed venue name would make
// the second run of this file a cache hit and skip the fetches under test.
const RUN = `t${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
const venue = (label) => `${label} ${RUN}`;

function searchResponse({ photos } = {}) {
  return {
    ok: true,
    json: async () => ({
      places: [{
        displayName: { text: 'Black Dragon Pool Park' },
        location: { latitude: 26.88, longitude: 100.23 },
        ...(photos ? { photos } : {})
      }]
    })
  };
}

// Records every request so assertions can inspect the field mask and photo call.
function stubFetch(handler) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return handler(String(url));
  };
  return calls;
}

const realFetch = global.fetch;
const realKey = process.env.GOOGLE_MAPS_API_KEY;

test.afterEach(() => {
  global.fetch = realFetch;
  if (realKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = realKey;
});

test('a venue photo becomes the activity image', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  const calls = stubFetch((url) => (
    url.includes(':searchText')
      ? searchResponse({ photos: [{ name: 'places/p1/photos/ph1' }] })
      : { ok: true, json: async () => ({ photoUri: PHOTO_URI }) }
  ));

  const activity = { name: venue('Photo Venue A'), type: 'landmark' };
  await enrichWithPlaceDetails([activity], 'Lijiang');

  assert.equal(activity.imageUrl, PHOTO_URI);
  assert.equal(activity.location.lat, 26.88);

  const search = calls.find((c) => c.url.includes(':searchText'));
  assert.match(search.options.headers['X-Goog-FieldMask'], /places\.photos/);

  const media = calls.find((c) => c.url.includes('/media'));
  assert.match(media.url, /skipHttpRedirect=true/);
  assert.equal(media.options.headers['X-Goog-Api-Key'], 'test-key');
});

test('the API key never travels to the client in the image URL', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'secret-key';
  stubFetch((url) => (
    url.includes(':searchText')
      ? searchResponse({ photos: [{ name: 'places/p1/photos/ph1' }] })
      : { ok: true, json: async () => ({ photoUri: PHOTO_URI }) }
  ));

  const activity = { name: venue('Photo Venue B'), type: 'landmark' };
  await enrichWithPlaceDetails([activity], 'Lijiang');

  assert.doesNotMatch(activity.imageUrl, /secret-key/);
});

test('a venue with no photos still gets coordinates', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  const calls = stubFetch(() => searchResponse());

  const activity = { name: venue('Photoless Venue C'), type: 'landmark' };
  await enrichWithPlaceDetails([activity], 'Lijiang');

  assert.equal(activity.imageUrl, undefined);
  assert.equal(activity.location.lat, 26.88);
  assert.equal(calls.filter((c) => c.url.includes('/media')).length, 0);
});

test('a failed photo lookup degrades to coordinates only', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  stubFetch((url) => (
    url.includes(':searchText')
      ? searchResponse({ photos: [{ name: 'places/p1/photos/ph1' }] })
      : { ok: false, status: 403, text: async () => 'denied' }
  ));

  const activity = { name: venue('Photo Fail Venue D'), type: 'landmark' };
  await enrichWithPlaceDetails([activity], 'Lijiang');

  assert.equal(activity.imageUrl, undefined);
  assert.equal(activity.location.lat, 26.88);
});

test('an activity that already has coordinates but no image is still enriched', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  stubFetch((url) => (
    url.includes(':searchText')
      ? searchResponse({ photos: [{ name: 'places/p1/photos/ph1' }] })
      : { ok: true, json: async () => ({ photoUri: PHOTO_URI }) }
  ));

  const activity = { name: venue('Coords Only Venue E'), type: 'landmark', location: { lat: 26.88, lng: 100.23 } };
  await enrichWithPlaceDetails([activity], 'Lijiang');

  assert.equal(activity.imageUrl, PHOTO_URI);
});

test('the venue name is what reaches Places, not the activity label', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  const calls = stubFetch(() => searchResponse());

  const activity = {
    name: 'Zhuanshan Temple Kora Circuit',
    venue_name: venue('Zhuanshan Temple'),
    type: 'landmark'
  };
  await enrichWithPlaceDetails([activity], 'Shangri-La');

  const query = JSON.parse(calls[0].options.body).textQuery;
  assert.match(query, /Zhuanshan Temple t\d/);
  assert.doesNotMatch(query, /Kora Circuit/);
});

test('concurrent activities at one venue share a single lookup', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  const calls = stubFetch(() => searchResponse());

  // Six Dukezong activities in one Shangri-La run cost six lookups apiece.
  const venueName = venue('Dukezong Ancient Town');
  const activities = ['Evening Wander', 'Rooftop Sunset', 'Bar Crawl'].map((label) => ({
    name: label, venue_name: venueName, type: 'neighborhood'
  }));
  await enrichWithPlaceDetails(activities, 'Shangri-La');

  assert.equal(calls.filter((c) => c.url.includes(':searchText')).length, 1);
  for (const activity of activities) assert.equal(activity.location.lat, 26.88);
});

test('an activity with no venue name falls back to its label', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  const calls = stubFetch(() => searchResponse());

  const label = venue('Dukezong Old Town Evening Stroll');
  await enrichWithPlaceDetails([{ name: label, venue_name: null, type: 'neighborhood' }], 'Shangri-La');

  assert.match(JSON.parse(calls[0].options.body).textQuery, /Dukezong Old Town Evening Stroll/);
});

test('a 24/7 Places result does not overwrite the model\'s opening hours', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  stubFetch(() => ({
    ok: true,
    json: async () => ({
      places: [{
        location: { latitude: 26.87, longitude: 100.23 },
        regularOpeningHours: { periods: [{ open: { day: 0, hour: 0, minute: 0 } }] }
      }]
    })
  }));

  const activity = {
    name: venue('Lijiang Old Town Night Wander'),
    type: 'neighborhood',
    opening_hours: '09:00-21:00',
    timing: { opening_hours: '09:00-21:00' }
  };
  await enrichWithPlaceDetails([activity], 'Lijiang');

  assert.equal(activity.opening_hours, '09:00-21:00');
  assert.equal(activity.timing.opening_hours, '09:00-21:00');
  assert.equal(activity.location.lat, 26.87, 'the coordinate is still applied');
});

test('a 24/7 result is still used when the model supplied no hours', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  stubFetch(() => ({
    ok: true,
    json: async () => ({
      places: [{
        location: { latitude: 26.87, longitude: 100.23 },
        regularOpeningHours: { periods: [{ open: { day: 0, hour: 0, minute: 0 } }] }
      }]
    })
  }));

  const activity = { name: venue('Round The Clock Viewpoint'), type: 'landmark' };
  await enrichWithPlaceDetails([activity], 'Lijiang');

  assert.equal(activity.opening_hours, '00:00-23:59');
});

test('a cache entry predating photo support is refetched, not served photo-less', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  const name = venue('Legacy Cached Venue F');
  placesCache.set(name, 'Lijiang', {
    priceTier: 2,
    openingHours: '09:00-17:00',
    location: { latitude: 26.88, longitude: 100.23 }
  });

  const calls = stubFetch((url) => (
    url.includes(':searchText')
      ? searchResponse({ photos: [{ name: 'places/p1/photos/ph1' }] })
      : { ok: true, json: async () => ({ photoUri: PHOTO_URI }) }
  ));

  const activity = { name, type: 'landmark' };
  await enrichWithPlaceDetails([activity], 'Lijiang');

  assert.equal(activity.imageUrl, PHOTO_URI);
  assert.ok(calls.some((c) => c.url.includes(':searchText')), 'expected a live refetch');
});

test('a cache entry written with photo support short-circuits the fetch', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  const name = venue('Fresh Cached Venue G');
  placesCache.set(name, 'Lijiang', {
    priceTier: 2,
    openingHours: '09:00-17:00',
    location: { latitude: 26.88, longitude: 100.23 },
    photoName: 'places/p1/photos/ph1',
    imageUrl: PHOTO_URI
  });

  const calls = stubFetch(() => searchResponse());

  const activity = { name, type: 'landmark' };
  await enrichWithPlaceDetails([activity], 'Lijiang');

  assert.equal(activity.imageUrl, PHOTO_URI);
  assert.equal(calls.length, 0, 'expected no network calls on a complete cache hit');
});
