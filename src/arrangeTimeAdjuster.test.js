const test = require('node:test');
const assert = require('node:assert');
const { adjust } = require('./services/arrangeTimeAdjuster');

const day = { date: '2026-05-20', windowStart: '09:00', windowEnd: '22:00' };
const days = [day];

function act(id, name, durationMin, openingHours = '') {
  return {
    id,
    name,
    timing: { duration_minutes: durationMin, opening_hours: openingHours }
  };
}

function meal(id, name, durationMin, openingHours = '') {
  return {
    id,
    name,
    type: 'meal',
    timing: { duration_minutes: durationMin, opening_hours: openingHours }
  };
}

test('adjuster nudges overlapping placements apart using commute matrix', () => {
  const activitiesById = {
    A: act('A', 'Shibuya Sky', 90, '10:00-22:30'),
    B: act('B', 'Ichiran', 45, '00:00-23:59')
  };
  const placements = {
    A: { date: '2026-05-20', time: '10:00' },
    B: { date: '2026-05-20', time: '11:00' }
  };
  const commuteMatrix = { A: { B: 20 } };
  const result = adjust({ placements, days, activitiesById, commuteMatrix });
  assert.strictEqual(result.placements.A.time, '10:00');
  assert.strictEqual(result.placements.B.time, '12:00');
  assert.strictEqual(result.drops.length, 0);
  assert.strictEqual(result.moved, 1);
});

test('adjuster respects opening hours by dropping when no slot fits', () => {
  const activitiesById = {
    A: act('A', 'Long Tour', 180, '09:00-12:00'),
    B: act('B', 'Late Restaurant', 60, '18:00-22:00')
  };
  const placements = {
    A: { date: '2026-05-20', time: '11:30' },
    B: { date: '2026-05-20', time: '12:00' }
  };
  const result = adjust({ placements, days, activitiesById, commuteMatrix: {} });
  assert.strictEqual(result.drops.length, 1);
  assert.strictEqual(result.drops[0].id, 'A');
  assert.strictEqual(result.drops[0].reason, 'no_time_slot_after_adjustment');
  assert.ok(result.placements.B);
});

test('adjuster passes valid schedule through unchanged', () => {
  const activitiesById = {
    A: act('A', 'Morning Walk', 60, '08:00-12:00'),
    B: act('B', 'Lunch', 60, '11:00-15:00')
  };
  const placements = {
    A: { date: '2026-05-20', time: '09:00' },
    B: { date: '2026-05-20', time: '12:00' }
  };
  const result = adjust({ placements, days, activitiesById, commuteMatrix: {} });
  assert.strictEqual(result.placements.A.time, '09:00');
  assert.strictEqual(result.placements.B.time, '12:00');
  assert.strictEqual(result.moved, 0);
  assert.strictEqual(result.drops.length, 0);
});

test('adjuster pushes flexible activity past locked anchor obstacle', () => {
  const activitiesById = {
    A: act('A', 'Morning Walk', 60, '08:00-12:00'),
    B: act('B', 'Evening Walk', 60, '14:00-22:00')
  };
  const placements = {
    A: { date: '2026-05-20', time: '09:00' },
    B: { date: '2026-05-20', time: '14:00' }
  };
  const lockedActivities = [
    { id: 'L', date: '2026-05-20', time: '14:00', duration_minutes: 120, name: 'Tour' }
  ];
  const result = adjust({ placements, days, activitiesById, lockedActivities, commuteMatrix: {} });
  assert.strictEqual(result.placements.A.time, '09:00');
  assert.strictEqual(result.placements.B.time, '16:00');
  assert.strictEqual(result.drops.length, 0);
});

test('adjuster drops activity when day window cannot fit it after adjustment', () => {
  const tightDay = { date: '2026-05-20', windowStart: '09:00', windowEnd: '11:00' };
  const activitiesById = {
    A: act('A', 'First', 60),
    B: act('B', 'Second', 60)
  };
  const placements = {
    A: { date: '2026-05-20', time: '09:00' },
    B: { date: '2026-05-20', time: '10:00' }
  };
  const commuteMatrix = { A: { B: 30 } };
  const result = adjust({ placements, days: [tightDay], activitiesById, commuteMatrix });
  assert.strictEqual(result.placements.A.time, '09:00');
  assert.ok(!result.placements.B);
  assert.strictEqual(result.drops.length, 1);
  assert.strictEqual(result.drops[0].id, 'B');
});

test('adjuster skips commute padding when matrix value is below walking threshold', () => {
  const activitiesById = {
    A: act('A', 'A', 30, '09:00-22:00'),
    B: act('B', 'B', 30, '09:00-22:00')
  };
  const placements = {
    A: { date: '2026-05-20', time: '09:00' },
    B: { date: '2026-05-20', time: '09:30' }
  };
  const commuteMatrix = { A: { B: 5 } };
  const result = adjust({ placements, days, activitiesById, commuteMatrix });
  assert.strictEqual(result.placements.A.time, '09:00');
  assert.strictEqual(result.placements.B.time, '09:50');
  assert.strictEqual(result.drops.length, 0);
});

test('adjuster anchors a lunch meal in its window instead of cascading it out', () => {
  // Mirrors the Asuka case: a long morning activity + big commute would push the
  // lunch meal past its closing time. Meal-first anchoring must protect it.
  const activitiesById = {
    A: act('A', 'Long Morning Tour', 180, '09:00-17:00'),
    M: meal('M', 'Lunch-only Restaurant', 60, '11:00-15:00')
  };
  const placements = {
    A: { date: '2026-05-20', time: '09:00' },
    M: { date: '2026-05-20', time: '12:00' }
  };
  const commuteMatrix = { A: { M: 90 } };
  const result = adjust({ placements, days, activitiesById, commuteMatrix });
  // Meal stays inside the lunch window (11:00-14:30) and its opening hours, not dropped.
  assert.ok(result.placements.M, 'meal should be placed');
  const mealStart = Number(result.placements.M.time.slice(0, 2)) * 60 + Number(result.placements.M.time.slice(3));
  assert.ok(mealStart >= 11 * 60 && mealStart < 14 * 60 + 30, `meal start ${result.placements.M.time} in lunch window`);
  assert.ok(!result.drops.find((d) => d.id === 'M'), 'meal not dropped');
});

test('adjuster drops a meal with no feasible slot on the day', () => {
  // Dinner-only venue on a day that closes before it can fit (the Wagyu case).
  const tightDay = { date: '2026-05-20', windowStart: '09:00', windowEnd: '18:00' };
  const activitiesById = {
    M: meal('M', 'Dinner-only Teppanyaki', 90, '17:00-23:00')
  };
  const placements = { M: { date: '2026-05-20', time: '17:00' } };
  const result = adjust({ placements, days: [tightDay], activitiesById, commuteMatrix: {} });
  assert.ok(!result.placements.M, 'meal cannot fit, should be dropped');
  assert.strictEqual(result.drops[0].id, 'M');
});

test('adjuster respects a locked-only day (no flexible placements, no crash)', () => {
  const arrivalDay = { date: '2026-05-19', windowStart: '11:43', windowEnd: '22:00', arrivalAvailableTime: '11:43' };
  const fullDay = { date: '2026-05-20', windowStart: '09:00', windowEnd: '22:00' };
  const activitiesById = {
    A: act('A', 'Activity on day 2', 60, '09:00-22:00')
  };
  const placements = {
    A: { date: '2026-05-20', time: '09:00' }
  };
  const lockedActivities = [
    { id: 'arrival', date: '2026-05-19', time: '09:00', duration_minutes: 163, name: 'Arrive: Haneda' },
    { id: 'checkin', date: '2026-05-19', time: '11:43', duration_minutes: 30, name: 'Hotel check-in' }
  ];
  const result = adjust({ placements, days: [arrivalDay, fullDay], activitiesById, lockedActivities, commuteMatrix: {} });
  assert.strictEqual(result.placements.A.time, '09:00');
  assert.strictEqual(result.drops.length, 0);
});
