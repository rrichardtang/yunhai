const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isLegacyActivity, migrateActivity, parseTimeString, parseDurationToMinutes, inferMealType } = require('./activityMigration');

const baseLegacy = {
  id: 'abc',
  name: 'Test Activity',
  city: 'Paris',
  type: 'tour',
  venue_name: null,
  start_location: '123 Rue Test',
  end_location: '',
  duration_hours: 2.5,
  suggested_time: '10:00am',
  opening_hours: '09:00-17:00',
  category: 'tour',
  estimated_cost_usd: 50,
  cost_type: 'per_person',
  booking_type: 'tour',
  booking_links: [],
  verdict: 'Recommend',
  dedicated_time_block: false,
  why_it_fits: 'Great option',
  pitfall: 'Can be crowded',
  booking_advice: 'Book early',
  smarter_alternative: null
};

test('duration_hours 2.5 → timing.duration_minutes 150', () => {
  const result = migrateActivity({ ...baseLegacy, duration_hours: 2.5 });
  assert.equal(result.timing.duration_minutes, 150);
});

test('suggested_time "10:00am" → preferred_time null (sentinel)', () => {
  const result = migrateActivity({ ...baseLegacy, suggested_time: '10:00am' });
  assert.equal(result.timing.preferred_time, null);
});

test('suggested_time "2:30pm" → preferred_time "14:30"', () => {
  const result = migrateActivity({ ...baseLegacy, suggested_time: '2:30pm' });
  assert.equal(result.timing.preferred_time, '14:30');
});

test('type "lunch" → category "food", meal_type "lunch"', () => {
  const result = migrateActivity({ ...baseLegacy, type: 'lunch', category: 'lunch' });
  assert.equal(result.category, 'food');
  assert.equal(result.meal_type, 'lunch');
});

test('type "museum" → category "cultural", tags ["museum"]', () => {
  const result = migrateActivity({ ...baseLegacy, type: 'museum', category: 'museum' });
  assert.equal(result.category, 'cultural');
  assert.deepEqual(result.tags, ['museum']);
});

test('idempotency: migrateActivity(migrateActivity(x)) deep equals migrateActivity(x)', () => {
  const once = migrateActivity({ ...baseLegacy });
  const twice = migrateActivity(once);
  assert.deepEqual(once, twice);
});

test('parseTimeString handles 12h am/pm formats', () => {
  assert.equal(parseTimeString('10:00am'), '10:00');
  assert.equal(parseTimeString('2:30pm'), '14:30');
  assert.equal(parseTimeString('12:00pm'), '12:00');
  assert.equal(parseTimeString('12:00am'), '00:00');
  assert.equal(parseTimeString('9am'), '09:00');
});

test('parseTimeString handles 24h format', () => {
  assert.equal(parseTimeString('14:30'), '14:30');
  assert.equal(parseTimeString('09:00'), '09:00');
});

test('parseTimeString returns null for invalid input', () => {
  assert.equal(parseTimeString(''), null);
  assert.equal(parseTimeString(null), null);
  assert.equal(parseTimeString('not a time'), null);
});

test('parseDurationToMinutes: 2.5 → 150, enforces min 15', () => {
  assert.equal(parseDurationToMinutes(2.5), 150);
  assert.equal(parseDurationToMinutes(0.1), 15);
  assert.equal(parseDurationToMinutes(1), 60);
});

test('isLegacyActivity detects correctly', () => {
  assert.equal(isLegacyActivity(baseLegacy), true);
  assert.equal(isLegacyActivity({ ...migrateActivity(baseLegacy) }), false);
});
