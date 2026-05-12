const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isLegacyActivity, parseTimeString, parseDurationToMinutes } = require('../shared/activityMigration');

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

test('isLegacyActivity detects activities without timing field', () => {
  assert.equal(isLegacyActivity({ id: 'a', name: 'x' }), true);
  assert.equal(isLegacyActivity({ id: 'a', name: 'x', timing: {} }), false);
});
