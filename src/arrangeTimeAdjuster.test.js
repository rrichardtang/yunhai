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
