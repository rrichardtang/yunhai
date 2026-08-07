const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
const { planCity, dedupeByVenue } = require('./claude');

const CITY = { name: 'Testville', startDate: '2026-10-08', endDate: '2026-10-13' }; // 6 days

function activity(name, extra = {}) {
  return {
    name,
    type: 'landmark',
    city: 'Testville',
    suggested_time: '10:00am',
    duration_hours: 2,
    estimated_cost_usd: 0,
    ...extra
  };
}

// Records every prompt it is asked to generate, so a test can assert on how the
// stay was partitioned without needing an API key.
function stubGenerator(activitiesFor) {
  const prompts = [];
  const generate = async ({ prompt }) => {
    prompts.push(prompt);
    const [, start, end] = prompt.match(/\((\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\)/);
    return {
      text: JSON.stringify(activitiesFor(start, end)),
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 20 }
    };
  };
  generate.prompts = prompts;
  generate.modelId = 'stub';
  return generate;
}

const plan = (generate, options = {}) =>
  planCity(CITY, null, 'user', [], null, null, 1, 1, 0, [], null, { generate, ...options });

test('without splitDays the stay is one call, as before', async () => {
  const generate = stubGenerator((start) => [activity(`Only ${start}`)]);
  const out = await plan(generate);
  assert.equal(generate.prompts.length, 1);
  assert.equal(out.length, 1);
  assert.match(generate.prompts[0], /\(2026-10-08 to 2026-10-13\)/);
});

test('splitDays partitions the stay into contiguous non-overlapping windows', async () => {
  const generate = stubGenerator((start) => [activity(`Venue ${start}`)]);
  await plan(generate, { splitDays: 2 });

  const ranges = generate.prompts.map((p) => p.match(/\((\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\)/).slice(1, 3));
  assert.deepEqual(ranges, [
    ['2026-10-08', '2026-10-09'],
    ['2026-10-10', '2026-10-11'],
    ['2026-10-12', '2026-10-13']
  ]);
});

test('a trailing partial window keeps the remaining days rather than overshooting', async () => {
  const generate = stubGenerator((start) => [activity(`Venue ${start}`)]);
  await plan(generate, { splitDays: 4 });

  const ranges = generate.prompts.map((p) => p.match(/\((\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\)/).slice(1, 3));
  assert.deepEqual(ranges, [['2026-10-08', '2026-10-11'], ['2026-10-12', '2026-10-13']]);
});

test('splitDays at or above the stay length stays a single call', async () => {
  const generate = stubGenerator((start) => [activity(`Venue ${start}`)]);
  await plan(generate, { splitDays: 6 });
  assert.equal(generate.prompts.length, 1);
});

test('each window asks for its own share of the activity budget', async () => {
  const generate = stubGenerator((start) => [activity(`Venue ${start}`)]);
  await plan(generate, { splitDays: 3 });
  // Default pace 3 => 4 non-meal/day. A 3-day window: 12 non-meal + 6 meals.
  for (const prompt of generate.prompts) {
    assert.match(prompt, /Generate 18 activities/);
    assert.match(prompt, /12 non-meal \(4\/day\)/);
    assert.match(prompt, /AT MOST 6 meal-type/);
  }
});

test('windows are told they cover part of a longer stay', async () => {
  const generate = stubGenerator((start) => [activity(`Venue ${start}`)]);
  await plan(generate, { splitDays: 2 });
  for (const prompt of generate.prompts) {
    assert.match(prompt, /part of a longer stay|of a longer stay/);
    assert.match(prompt, /Plan ONLY these days/);
  }
});

// Coordinates only ever arrive from Google Places (normalizeActivity leaves
// location.lat/lng null), so the venue-collapse rule is exercised directly.
const at = (name, lat, lng) => ({ name, location: { lat, lng } });

test('activities that ground to the same venue collapse to one', () => {
  // The real case: Pudacuo National Park returned three times under three names.
  const out = dedupeByVenue([
    at('Potatso Park — Alpine Meadow Boardwalk', 27.8006835, 99.9071603),
    at('Pudacuo National Park — Shudu & Bita Lake Loop', 27.8006835, 99.9071603),
    at('Potatso National Park — Bita Lake Morning Walk', 27.8006835, 99.9071603),
    at('Ganden Sumtseling Monastery', 27.816877, 99.705421)
  ], 'Shangri-La');

  assert.deepEqual(out.map((a) => a.name), [
    'Potatso Park — Alpine Meadow Boardwalk',
    'Ganden Sumtseling Monastery'
  ]);
});

test('distinct venues a few hundred metres apart are both kept', () => {
  const out = dedupeByVenue([
    at('Riwuqie Tibetan Restaurant', 27.81173, 99.70505),
    at('Dukezong Old Town Nightlife Bar Strip', 27.81171, 99.705503)
  ], 'Shangri-La');
  assert.equal(out.length, 2);
});

test('unresolved activities are not collapsed into each other', () => {
  // 0,0 is the unset sentinel; treating it as a location would drop all but one.
  const out = dedupeByVenue([
    at('No coords A', 0, 0),
    at('No coords B', 0, 0),
    at('No coords C', null, null)
  ], 'Shangri-La');
  assert.equal(out.length, 3);
});

test('the same unresolved name arriving from two windows collapses', () => {
  const out = dedupeByVenue([at('Yak Hot Pot Dinner', 0, 0), at('Yak Hot Pot Dinner', 0, 0)], 'Shangri-La');
  assert.equal(out.length, 1);
});

test('windows do not multiply coordinate-less activities', async () => {
  const generate = stubGenerator((start) => [activity(`A ${start}`), activity(`B ${start}`)]);
  const out = await plan(generate, { splitDays: 2 });
  assert.equal(out.length, 6, 'six distinctly-named coordinate-less activities');
});

test('the meal cap still applies across the whole stay, not per window', async () => {
  const meal = (name) => activity(name, { type: 'meal', opening_hours: '11:00-22:00' });
  const generate = stubGenerator((start) => [
    meal(`Lunch ${start}`), meal(`Dinner ${start}`), meal(`Extra ${start}`),
    activity(`Sight ${start}`, { start_latitude: 26.1 + Number(start.slice(-2)) / 1000, start_longitude: 100.1 })
  ]);
  const out = await plan(generate, { splitDays: 1 });
  // 6 windows x 3 meals = 18 generated; the city-wide cap is 2/day = 12.
  const meals = out.filter((a) => a.type === 'meal');
  assert.ok(meals.length <= 12, `expected <= 12 meals city-wide, got ${meals.length}`);
});

test('a window that never returns valid JSON fails the city', async () => {
  const generate = async () => ({ text: 'sorry, no JSON here', stop_reason: 'end_turn', usage: {} });
  generate.modelId = 'stub';
  await assert.rejects(() => plan(generate, { splitDays: 2 }), /invalid JSON/);
});
