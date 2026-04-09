const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDepartureAfterArrival } = require('./cityDropdownValidation');

test('accepts departure after arrival on same day', () => {
  const result = validateDepartureAfterArrival({
    arrival: { date: '2026-05-10', time: '09:00' },
    departure: { date: '2026-05-10', time: '19:00' }
  });
  assert.equal(result, '');
});

test('accepts equal datetime', () => {
  const result = validateDepartureAfterArrival({
    arrival: { date: '2026-05-10', time: '11:00' },
    departure: { date: '2026-05-10', time: '11:00' }
  });
  assert.equal(result, '');
});

test('rejects departure before arrival', () => {
  const result = validateDepartureAfterArrival({
    arrival: { date: '2026-05-10', time: '16:00' },
    departure: { date: '2026-05-10', time: '14:00' }
  });
  assert.equal(result, 'Departure must be at or after arrival.');
});

test('returns no error while partial values are still incomplete', () => {
  const result = validateDepartureAfterArrival({
    arrival: { date: '2026-05-10', time: '' },
    departure: { date: '2026-05-11', time: '09:00' }
  });
  assert.equal(result, '');
});
