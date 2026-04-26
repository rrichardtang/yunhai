const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assignTimes, parseOpeningHours, effectiveOpeningWindows } = require('./arrangeTimeAssigner');

function mkAct(id, opts = {}) {
  return {
    id,
    name: opts.name || id,
    category: opts.category || 'sightseeing',
    timing: { duration_minutes: opts.duration || 60, opening_hours: opts.opening_hours || '' }
  };
}

const baseDay = (date = '2026-05-03') => ({
  date,
  windowStart: '09:00',
  windowEnd: '21:00'
});

test('three activities in a day get sequenced times', () => {
  const acts = [mkAct('a', { duration: 60 }), mkAct('b', { duration: 90 }), mkAct('c', { duration: 60 })];
  const out = assignTimes({
    days: [baseDay()],
    dayPlans: [{ date: '2026-05-03', ordered_ids: ['a', 'b', 'c'] }],
    activitiesById: Object.fromEntries(acts.map((a) => [a.id, a]))
  });
  assert.equal(out.placements.a.time, '09:00');
  assert.equal(out.placements.b.time, '10:20');
  assert.equal(out.placements.c.time, '12:10');
  assert.equal(out.unplaced.length, 0);
});

test('opening_hours pushes start time forward', () => {
  const acts = [mkAct('a', { duration: 60, opening_hours: '11:00-18:00' })];
  const out = assignTimes({
    days: [baseDay()],
    dayPlans: [{ date: '2026-05-03', ordered_ids: ['a'] }],
    activitiesById: { a: acts[0] }
  });
  assert.equal(out.placements.a.time, '11:00');
});

test('lunch meal band snaps lunch into 11:30-13:30 window', () => {
  const lunch = mkAct('l', { duration: 60, category: 'lunch' });
  const out = assignTimes({
    days: [baseDay()],
    dayPlans: [{ date: '2026-05-03', ordered_ids: ['l'] }],
    activitiesById: { l: lunch }
  });
  assert.equal(out.placements.l.time, '11:30');
});

test('locked activity in middle of day pushes flexible after it', () => {
  const a = mkAct('a', { duration: 60 });
  const out = assignTimes({
    days: [baseDay()],
    dayPlans: [{ date: '2026-05-03', ordered_ids: ['a'] }],
    activitiesById: { a },
    lockedActivities: [{ id: 'lock1', date: '2026-05-03', time: '09:00', duration_minutes: 120 }]
  });
  // lock occupies 09:00-11:00, +20 buffer => 11:20
  assert.equal(out.placements.a.time, '11:20');
});

test('day window overflow lands in unplaced', () => {
  const acts = [mkAct('a', { duration: 480 }), mkAct('b', { duration: 480 })];
  const out = assignTimes({
    days: [baseDay()],
    dayPlans: [{ date: '2026-05-03', ordered_ids: ['a', 'b'] }],
    activitiesById: Object.fromEntries(acts.map((a) => [a.id, a]))
  });
  assert.equal(out.placements.a.time, '09:00');
  assert.deepEqual(out.unplaced, [{ id: 'b', reason: 'no time remaining in day window' }]);
});

test('missing commute matrix entry falls back to 20 min buffer', () => {
  const acts = [mkAct('a', { duration: 60 }), mkAct('b', { duration: 60 })];
  const out = assignTimes({
    days: [baseDay()],
    dayPlans: [{ date: '2026-05-03', ordered_ids: ['a', 'b'] }],
    activitiesById: Object.fromEntries(acts.map((a) => [a.id, a])),
    commuteMatrix: {}
  });
  assert.equal(out.placements.b.time, '10:20');
});

test('commute matrix overrides default buffer', () => {
  const acts = [mkAct('a', { duration: 60 }), mkAct('b', { duration: 60 })];
  const out = assignTimes({
    days: [baseDay()],
    dayPlans: [{ date: '2026-05-03', ordered_ids: ['a', 'b'] }],
    activitiesById: Object.fromEntries(acts.map((a) => [a.id, a])),
    commuteMatrix: { a: { b: 45 } }
  });
  // 09:00 + 60 + 45 = 10:45
  assert.equal(out.placements.b.time, '10:45');
});

test('unknown activity id is reported in unplaced', () => {
  const out = assignTimes({
    days: [baseDay()],
    dayPlans: [{ date: '2026-05-03', ordered_ids: ['ghost'] }],
    activitiesById: {}
  });
  assert.deepEqual(out.unplaced, [{ id: 'ghost', reason: 'unknown activity id' }]);
});

test('parseOpeningHours handles comma-separated ranges', () => {
  assert.deepEqual(parseOpeningHours('10:00-14:00, 17:00-22:00'), [[600, 840], [1020, 1320]]);
});

test('parseOpeningHours handles am/pm', () => {
  assert.deepEqual(parseOpeningHours('9am-5pm'), [[540, 1020]]);
});

test('effectiveOpeningWindows intersects meal band with opening hours', () => {
  const breakfast = { category: 'breakfast', timing: { opening_hours: '08:00-11:00' } };
  // breakfast band 7-9, opening 8-11 => intersection 8-9
  assert.deepEqual(effectiveOpeningWindows(breakfast), [[480, 540]]);
});
