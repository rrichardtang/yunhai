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

test('does not enforce meal caps (judgment, not physics)', () => {
  const l1 = mkAct('l1', { duration: 60, category: 'lunch' });
  const l2 = mkAct('l2', { duration: 60, category: 'lunch' });
  const v = validate({
    placements: { l1: { date: '2026-05-03', time: '12:00' }, l2: { date: '2026-05-03', time: '14:00' } },
    lockedActivities: [],
    days,
    activitiesById: { l1, l2 }
  });
  assert.equal(v.ok, true);
});
