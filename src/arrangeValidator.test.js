const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('./arrangeValidator');

function mkAct(id, opts = {}) {
  return {
    id,
    name: opts.name || id,
    category: opts.category || 'sightseeing',
    timing: { duration_minutes: opts.duration || 60 }
  };
}

const days = [{ date: '2026-05-03', windowStart: '09:00', windowEnd: '21:00' }];

test('empty placements is ok', () => {
  const v = validate({ placements: {}, lockedActivities: [], days, activitiesById: {} });
  assert.equal(v.ok, true);
});

test('detects pairwise overlap', () => {
  const a = mkAct('a', { duration: 90 });
  const b = mkAct('b', { duration: 60 });
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '09:00' }, b: { date: '2026-05-03', time: '10:00' } },
    lockedActivities: [],
    days,
    activitiesById: { a, b }
  });
  assert.equal(v.ok, false);
  assert.equal(v.issues[0].type, 'overlap');
});

test('detects lock overlap', () => {
  const a = mkAct('a', { duration: 60 });
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '10:00' } },
    lockedActivities: [{ id: 'lock', date: '2026-05-03', time: '09:30', duration_minutes: 60 }],
    days,
    activitiesById: { a }
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.type === 'lock_overlap'));
});

test('detects lock-vs-lock overlap on a day with no flexible placements', () => {
  const v = validate({
    placements: {},
    lockedActivities: [
      { id: 'arrival', date: '2026-05-03', time: '09:00', duration_minutes: 163 },
      { id: 'checkin', date: '2026-05-03', time: '09:28', duration_minutes: 30 }
    ],
    days,
    activitiesById: {}
  });
  assert.equal(v.ok, false);
  const issue = v.issues.find((i) => i.type === 'lock_lock_overlap');
  assert.ok(issue, 'expected a lock_lock_overlap issue');
  assert.deepEqual(issue.ids.sort(), ['arrival', 'checkin']);
});

test('detects window violation', () => {
  const a = mkAct('a', { duration: 60 });
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '07:00' } },
    lockedActivities: [],
    days,
    activitiesById: { a }
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.type === 'window'));
});

test('flags opening_hours when activity starts before venue opens', () => {
  const a = { id: 'a', name: 'a', timing: { duration_minutes: 60, opening_hours: '14:00-18:00' } };
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '10:00' } },
    lockedActivities: [],
    days,
    activitiesById: { a }
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.type === 'opening_hours'));
});

test('opening_hours allows activity that extends past listed close (start-within-window)', () => {
  // Restaurant lists 11:00-15:00. Lunch at 14:30 for 1h ends at 15:30 — fine, kitchens often serve seated diners past close.
  const a = { id: 'a', name: 'a', timing: { duration_minutes: 60, opening_hours: '11:00-15:00' } };
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '14:30' } },
    lockedActivities: [],
    days,
    activitiesById: { a }
  });
  assert.equal(v.ok, true);
});

test('back-to-back activities at different venues pass (LLM owns transit budgeting)', () => {
  const a = { id: 'a', name: 'A', timing: { duration_minutes: 60 }, venue_name: 'Cafe Alpha' };
  const b = { id: 'b', name: 'B', timing: { duration_minutes: 60 }, venue_name: 'Cafe Beta' };
  // a ends at 13:00, b starts at 13:00 — zero gap. Validator no longer enforces a buffer.
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '12:00' }, b: { date: '2026-05-03', time: '13:00' } },
    lockedActivities: [],
    days,
    activitiesById: { a, b }
  });
  assert.equal(v.ok, true);
});

test('actual time overlap (no buffer added) is still flagged', () => {
  const a = { id: 'a', name: 'A', timing: { duration_minutes: 90 }, venue_name: 'Cafe Alpha' };
  const b = { id: 'b', name: 'B', timing: { duration_minutes: 60 }, venue_name: 'Cafe Beta' };
  // a runs 12:00-13:30, b runs 13:00-14:00 — real overlap.
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '12:00' }, b: { date: '2026-05-03', time: '13:00' } },
    lockedActivities: [],
    days,
    activitiesById: { a, b }
  });
  assert.equal(v.ok, false);
  assert.equal(v.issues[0].type, 'overlap');
});

test('flags duplicate_meal_slot when two meals land in the same lunch window', () => {
  const l1 = { id: 'l1', name: 'Ramen Spot', type: 'meal', timing: { duration_minutes: 60 } };
  const l2 = { id: 'l2', name: 'Sushi Counter', type: 'meal', timing: { duration_minutes: 60 } };
  const v = validate({
    placements: { l1: { date: '2026-05-03', time: '12:00' }, l2: { date: '2026-05-03', time: '13:00' } },
    lockedActivities: [],
    days,
    activitiesById: { l1, l2 }
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.type === 'duplicate_meal_slot'));
});

test('flags meal_outside_windows for meal scheduled at 15:30', () => {
  const m = { id: 'm', name: 'Cafe', type: 'meal', timing: { duration_minutes: 60 } };
  const v = validate({
    placements: { m: { date: '2026-05-03', time: '15:30' } },
    lockedActivities: [],
    days,
    activitiesById: { m }
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.type === 'meal_outside_windows'));
});

test('flags opening_hours for dinner-only restaurant scheduled at lunch', () => {
  const m = { id: 'm', name: 'Omakase', type: 'meal', timing: { duration_minutes: 60, opening_hours: '17:00-22:00' } };
  const v = validate({
    placements: { m: { date: '2026-05-03', time: '12:30' } },
    lockedActivities: [],
    days,
    activitiesById: { m }
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.type === 'opening_hours'));
});

test('allows one meal in lunch window and one in dinner window on same day', () => {
  const l = { id: 'l', name: 'Lunch Spot', type: 'meal', timing: { duration_minutes: 60 } };
  const d = { id: 'd', name: 'Dinner Spot', type: 'meal', timing: { duration_minutes: 60 } };
  const v = validate({
    placements: { l: { date: '2026-05-03', time: '12:30' }, d: { date: '2026-05-03', time: '19:00' } },
    lockedActivities: [],
    days,
    activitiesById: { l, d }
  });
  assert.equal(v.ok, true);
});

test('flags commute_gap_violation when same-day pair too close', () => {
  const a = mkAct('a', { duration: 60 });
  const b = mkAct('b', { duration: 60 });
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '09:00' }, b: { date: '2026-05-03', time: '10:15' } },
    lockedActivities: [],
    days,
    activitiesById: { a, b },
    commuteMatrix: { a: { b: 30 } }
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.type === 'commute_gap_violation'));
});

test('passes commute_gap when start times respect duration + commute + buffer', () => {
  const a = mkAct('a', { duration: 60 });
  const b = mkAct('b', { duration: 60 });
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '09:00' }, b: { date: '2026-05-03', time: '10:40' } },
    lockedActivities: [],
    days,
    activitiesById: { a, b },
    commuteMatrix: { a: { b: 30 } }
  });
  assert.equal(v.ok, true);
});

test('flags empty_dinner_with_available_meal when unplaced meal fits dinner window', () => {
  const m = { id: 'm', name: 'Dinner Spot', type: 'meal', timing: { duration_minutes: 60, opening_hours: '17:00-22:00' } };
  const other = mkAct('a', { duration: 60 });
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '10:00' } },
    lockedActivities: [],
    days,
    activitiesById: { m, a: other },
    unplacedIds: ['m']
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.type === 'empty_dinner_with_available_meal'));
});

test('flags commute_gap_violation for a short real commute pair', () => {
  const a = mkAct('a', { duration: 60 });
  const b = mkAct('b', { duration: 60 });
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '09:00' }, b: { date: '2026-05-03', time: '10:04' } },
    lockedActivities: [],
    days,
    activitiesById: { a, b },
    commuteMatrix: { a: { b: 5 } }
  });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => i.type === 'commute_gap_violation'), '4-min gap on a 5-min commute flagged');
});

test('passes commute_gap for a short real commute pair with commute+buffer respected', () => {
  const a = mkAct('a', { duration: 60 });
  const b = mkAct('b', { duration: 60 });
  const v = validate({
    placements: { a: { date: '2026-05-03', time: '09:00' }, b: { date: '2026-05-03', time: '10:15' } },
    lockedActivities: [],
    days,
    activitiesById: { a, b },
    commuteMatrix: { a: { b: 5 } }
  });
  assert.equal(v.ok, true, '15-min gap satisfies 5 + 10');
});

test('empty_dinner not flagged when a locked meal occupies the dinner slot', () => {
  const m = { ...mkAct('m', { duration: 60 }), type: 'meal', timing: { duration_minutes: 60, opening_hours: '17:00-22:00' } };
  const v = validate({
    placements: {},
    lockedActivities: [{ id: 'lm', date: '2026-05-03', time: '19:00', duration_minutes: 90, type: 'meal', name: 'Locked Dinner' }],
    days,
    activitiesById: { m },
    unplacedIds: ['m']
  });
  assert.equal(v.ok, true, 'locked dinner counts as the dinner slot being used');
});

test('empty_dinner not flagged when the day window ends before dinner', () => {
  const morningDays = [{ date: '2026-05-03', windowStart: '09:00', windowEnd: '11:00' }];
  const m = { ...mkAct('m', { duration: 60 }), type: 'meal', timing: { duration_minutes: 60, opening_hours: '17:00-22:00' } };
  const v = validate({
    placements: {},
    lockedActivities: [],
    days: morningDays,
    activitiesById: { m },
    unplacedIds: ['m']
  });
  assert.equal(v.ok, true, 'day never reaches the dinner window');
});
