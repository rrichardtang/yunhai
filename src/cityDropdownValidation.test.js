const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDepartureAfterArrival } = require('./cityDropdownValidation');

test('accepts departure after arrival on same day', () => {
  const result = validateDepartureAfterArrival({
    arrival: { date: '2026-05-10', timeOfDay: 'morning' },
    departure: { date: '2026-05-10', timeOfDay: 'evening' }
  });
  assert.equal(result, '');
});

test('accepts equal datetime', () => {
  const result = validateDepartureAfterArrival({
    arrival: { date: '2026-05-10', timeOfDay: 'custom', customTime: '11:00' },
    departure: { date: '2026-05-10', timeOfDay: 'custom', customTime: '11:00' }
  });
  assert.equal(result, '');
});

test('rejects departure before arrival', () => {
  const result = validateDepartureAfterArrival({
    arrival: { date: '2026-05-10', timeOfDay: 'custom', customTime: '16:00' },
    departure: { date: '2026-05-10', timeOfDay: 'custom', customTime: '14:00' }
  });
  assert.equal(result, 'Departure must be at or after arrival.');
});

test('returns no error while partial values are still incomplete', () => {
  const result = validateDepartureAfterArrival({
    arrival: { date: '2026-05-10', timeOfDay: 'custom', customTime: '' },
    departure: { date: '2026-05-11', timeOfDay: 'morning' }
  });
  assert.equal(result, '');
});
