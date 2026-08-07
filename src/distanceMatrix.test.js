const test = require('node:test');
const assert = require('node:assert/strict');
const { getFastestCommuteWithSource } = require('./services/distanceMatrix');
const { haversineKm } = require('./services/geo');

function mkAct(name, lat, lng) {
  return { name, city: 'Testville', location: { lat, lng } };
}

function elementResponse(status, minutes = 0) {
  return {
    ok: true,
    json: async () => ({
      status: 'OK',
      rows: [{ elements: [status === 'OK' ? { status: 'OK', duration: { value: minutes * 60 } } : { status }] }]
    })
  };
}

function stubFetchByMode(byMode) {
  global.fetch = async (url) => {
    const mode = new URL(url).searchParams.get('mode');
    return byMode[mode];
  };
}

const realFetch = global.fetch;
const realKey = process.env.GOOGLE_MAPS_API_KEY;

test.afterEach(() => {
  global.fetch = realFetch;
  if (realKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = realKey;
});

test('transit ZERO_RESULTS falls back to driving', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  stubFetchByMode({
    transit: elementResponse('ZERO_RESULTS'),
    driving: elementResponse('OK', 25)
  });
  const r = await getFastestCommuteWithSource(mkAct('A', 10.0, 10.0), mkAct('B', 10.1, 10.0));
  assert.equal(r.minutes, 25);
  // File-backed commute cache may serve a prior run: cache-neg/cache-hit equal live-fail/live-ok.
  assert.equal(r.sources.length, 2, 'transit failed, driving answered');
  assert.ok(['live-ok', 'cache-hit'].includes(r.sources[1]));
});

test('transit and driving both fail falls back to walking', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  stubFetchByMode({
    transit: elementResponse('ZERO_RESULTS'),
    driving: elementResponse('ZERO_RESULTS'),
    walking: elementResponse('OK', 40)
  });
  const r = await getFastestCommuteWithSource(mkAct('C', 20.0, 20.0), mkAct('D', 20.1, 20.0));
  assert.equal(r.minutes, 40);
  assert.equal(r.sources.length, 3, 'transit and driving failed, walking answered');
  assert.ok(['live-ok', 'cache-hit'].includes(r.sources[2]));
});

test('all modes failing yields a haversine walking estimate for coord pairs', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  stubFetchByMode({
    transit: elementResponse('ZERO_RESULTS'),
    driving: elementResponse('ZERO_RESULTS'),
    walking: elementResponse('ZERO_RESULTS')
  });
  const from = mkAct('E', 30.0, 30.0);
  const to = mkAct('F', 30.09, 30.0);
  const r = await getFastestCommuteWithSource(from, to);
  const expected = Math.max(1, Math.round(haversineKm(30.0, 30.0, 30.09, 30.0) * 12));
  assert.equal(r.minutes, expected);
});

test('no key and no coords resolves to null, never a fabricated value', async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  const r = await getFastestCommuteWithSource({ name: 'G', city: 'Testville' }, { name: 'H', city: 'Testville' });
  assert.equal(r.minutes, null);
});

// --- Inter-city transfer timing ---

const { buildCityTravelTiming } = require('./services/distanceMatrix');

function legOfMinutes(minutes) {
  return {
    ok: true,
    json: async () => ({
      status: 'OK',
      rows: [{ elements: [{ status: 'OK', duration: { value: minutes * 60 } }] }]
    })
  };
}

function yunnanTrip({ address = '' } = {}) {
  return [
    { name: 'Lijiang, Yunnan, China', startDate: '2026-10-08', endDate: '2026-10-13', leaveTime: '18:00', latitude: 26.87, longitude: 100.22, accommodation: { address } },
    { name: 'Shangri-La City, Diqing, Yunnan, China', startDate: '2026-10-13', endDate: '2026-10-17', leaveTime: '18:00', latitude: 27.82, longitude: 99.70, accommodation: { address } }
  ];
}

test('an inter-city transfer is estimated even with no accommodation address', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  global.fetch = async () => legOfMinutes(240);
  const timing = await buildCityTravelTiming(yunnanTrip());
  assert.equal(timing['Shangri-La City, Diqing, Yunnan, China'].interCityTravelMinutes, 240);
});

test('the arriving city cannot start before the departing city actually leaves', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  global.fetch = async () => legOfMinutes(240);
  const timing = await buildCityTravelTiming(yunnanTrip());
  // Departs 18:00 + 4h transit. A hardcoded 09:00 departure gave 13:00 here and
  // let both cities book the transfer day.
  assert.equal(timing['Shangri-La City, Diqing, Yunnan, China'].arrivalAvailableTime, '22:00');
});

test('the departing city is told the transfer day ends at its leave time', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  global.fetch = async () => legOfMinutes(240);
  const timing = await buildCityTravelTiming(yunnanTrip());
  const summary = timing['Lijiang, Yunnan, China'].departureSummary;
  assert.match(summary, /after 18:00/);
  assert.match(summary, /2026-10-13/);
});

test('an accommodation address is preferred over the city centre as the anchor', async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  const origins = [];
  global.fetch = async (url) => {
    origins.push(new URL(url).searchParams.get('origins'));
    return legOfMinutes(240);
  };
  await buildCityTravelTiming(yunnanTrip({ address: '123 Old Town Road, Lijiang' }));
  assert.ok(origins.some((o) => o.includes('Old Town Road')), `expected the hotel address in ${JSON.stringify(origins)}`);
});
