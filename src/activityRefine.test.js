const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildRefinedActivity,
  buildVenueRosterBlock,
  applyBookingLinks
} = require('./routes/activities');
const { normalizeActivity, dedupeActivities } = require('./claude');

// The venue being swapped out, as it exists in the traveler's itinerary: fully
// normalized, with a description, a schedule and a real booking against it.
const replacedActivity = () => normalizeActivity({
  id: 'a1',
  name: 'Casa Lucio',
  venue_name: 'Casa Lucio',
  city: 'Madrid',
  type: 'meal',
  why_it_fits: 'The roast suckling pig is the must-order',
  pitfall: 'Book weeks ahead',
  booking_advice: 'Reserve by phone',
  insider_tips: 'Ask for the ground-floor room',
  smarter_alternative: 'Botin does the same dish for less',
  duration_hours: 3,
  suggested_time: '8:00pm',
  opening_hours: '13:00-16:00,20:00-23:30',
  estimated_cost_usd: 120
}, 'Madrid');

// The route's own per-suggestion step, not a copy of it: if a merge with the
// replaced activity were ever reintroduced there, these assertions must fail.
const refineFrom = (suggestion, replaced = replacedActivity(), city = 'Madrid') =>
  buildRefinedActivity(replaced, { id: 'a1', ...suggestion }, city);

test('nothing describing the replaced venue survives the swap', () => {
  const replaced = replacedActivity();
  replaced.place_id = 'ChIJ_casa_lucio';
  replaced.imageUrl = 'https://example.com/casa-lucio.jpg';
  replaced.price_level = 4;
  replaced.booking.reference = 'ABC123';

  // A minimal suggestion — the model answers only some fields. Under the old
  // partial-diff contract every field it omitted fell through to the replaced
  // venue; here the suggestion IS the activity, so nothing can.
  const refined = refineFrom({ name: 'Bar Nou', venue_name: 'Bar Nou', type: 'meal', estimated_cost_usd: 35 });

  // id is the itinerary slot being filled and city/type are what the swap holds
  // fixed; everything else is a venue attribute and must not survive.
  const KEPT_BY_DESIGN = new Set(['id', 'city', 'type']);
  const carried = Object.entries(replaced).filter(([key, value]) =>
    !KEPT_BY_DESIGN.has(key) && typeof value === 'string' && value && refined[key] === value);
  assert.deepEqual(carried, [], 'no field may keep the replaced venue\'s value');

  assert.equal(refined.name, 'Bar Nou');
  assert.equal(refined.why_it_fits, '');
  assert.equal(refined.pitfall, '');
  assert.equal(refined.booking_advice, '');
  assert.equal(refined.insider_tips, null);
  assert.equal(refined.smarter_alternative, null);
  assert.equal(refined.booking.reference, null);
  assert.equal(refined.place_id, null);
  assert.equal(refined.imageUrl, null);
  assert.equal(refined.price_level, null);
  // normalizeActivity falls back address -> venue_name, so this is the NEW venue's
  // label rather than empty; what matters is that it is not the replaced venue's.
  assert.equal(refined.location.address, 'Bar Nou');
  assert.notEqual(refined.location.address, replaced.location.address);
  assert.equal(refined.cost.estimated_usd, 35);
});

test('the new venue gets its own duration and preferred time, not the replaced one\'s', () => {
  const replaced = replacedActivity();
  assert.equal(replaced.timing.duration_minutes, 180);
  assert.equal(replaced.timing.preferred_time, '20:00');

  const refined = refineFrom({
    name: 'Bar Nou', venue_name: 'Bar Nou', type: 'meal', duration_hours: 0.75, suggested_time: '1:00pm'
  });
  assert.equal(refined.timing.duration_minutes, 45);
  assert.equal(refined.timing.preferred_time, '13:00');
});

test('a null duration falls back to the category default, never a 15-minute block', () => {
  const refined = refineFrom({ name: 'Prado', venue_name: 'Museo del Prado', type: 'museum', duration_hours: null });
  assert.ok(refined.timing.duration_minutes >= 30, `got ${refined.timing.duration_minutes}`);
});

test('opening hours come from the suggestion, never from the replaced venue', () => {
  const refined = refineFrom({ name: 'Ruzafa Night Market', type: 'market', opening_hours: '19:00-23:59' });
  assert.equal(refined.timing.opening_hours, '19:00-23:59');
  assert.notEqual(refined.timing.opening_hours, replacedActivity().timing.opening_hours);
});

test('a meal-prefixed label cannot smuggle a roster venue past the dedupe', () => {
  // normalizeActivity strips "Dinner at", so keying the dedupe on the model's raw
  // label let this through and then shipped it as exactly the venue it replaced.
  const roster = [replacedActivity()];
  const refined = refineFrom({ name: 'Dinner at Casa Lucio', type: 'meal' });
  assert.equal(refined.name, 'Casa Lucio');
  const kept = new Set(dedupeActivities([...roster, refined], 'Madrid'));
  assert.equal(kept.has(refined), false, 'the suggestion must lose to the roster');
  assert.equal(kept.has(roster[0]), true);
});

test('a suggestion that lands back on a trip venue is the one dropped', () => {
  const roster = [replacedActivity()];
  const refined = refineFrom({ name: 'Casa Lucio', venue_name: 'Casa Lucio', type: 'meal' });
  const kept = new Set(dedupeActivities([...roster, refined], 'Madrid'));
  assert.equal(kept.has(refined), false);
  assert.equal(kept.has(roster[0]), true);
});

test('buildRefinedActivity rejects a suggestion with no name', () => {
  assert.equal(buildRefinedActivity(replacedActivity(), { id: 'a1', estimated_cost_usd: 20 }, 'Madrid'), null);
  assert.equal(buildRefinedActivity(replacedActivity(), null, 'Madrid'), null);
});

test('a suggestion carrying a timing object is still normalized', () => {
  // isLegacyActivity is `timing === undefined`, so an unstripped timing key would
  // pass the suggestion through raw, leaving no booking for applyBookingLinks.
  const refined = refineFrom({ name: 'Bar Nou', venue_name: 'Bar Nou', type: 'meal', timing: { duration_minutes: 999 } });
  assert.ok(refined.booking, 'must be normalized, not passed through');
  assert.notEqual(refined.timing.duration_minutes, 999);
});

test('the replacement keeps the itinerary slot it is filling', () => {
  const refined = refineFrom({ name: 'Bar Nou', venue_name: 'Bar Nou', type: 'meal' });
  assert.equal(refined.id, 'a1');
});

test('buildVenueRosterBlock lists every named venue and is empty for an empty roster', () => {
  const block = buildVenueRosterBlock([
    { name: 'Casa Lucio', venue_name: 'Casa Lucio', type: 'meal' },
    { name: 'Prado walk', type: 'museum' },
    { name: '  ' }
  ]);
  assert.match(block, /Casa Lucio \| type: meal/);
  assert.match(block, /"Prado walk" \| type: museum/);
  assert.equal(block.split('\n').filter((l) => l.startsWith('- ')).length, 2);
  assert.equal(buildVenueRosterBlock([]), '');
});

test('booking links are rebuilt for the new venue and cleared when nothing is booked', () => {
  const bookable = refineFrom({ name: 'Bar Nou', venue_name: 'Bar Nou', type: 'meal', estimated_cost_usd: 35 });
  bookable.booking.type = 'restaurant';
  bookable.booking.links = ['stale-link'];
  applyBookingLinks(bookable, 'Madrid', '2026-09-01');
  assert.ok(bookable.booking.links.length);
  assert.ok(!JSON.stringify(bookable.booking.links).includes('stale-link'));

  const free = refineFrom({ name: 'Ruzafa walk', type: 'landmark' });
  free.booking.type = 'none';
  free.booking.links = ['stale-link'];
  applyBookingLinks(free, 'Madrid');
  assert.deepEqual(free.booking.links, []);
});
