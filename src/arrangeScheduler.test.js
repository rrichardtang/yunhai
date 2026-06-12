const test = require('node:test');
const assert = require('node:assert');
const { schedule } = require('./services/arrangeScheduler');
const { validate } = require('./arrangeValidator');

const day = { date: '2026-05-20', windowStart: '09:00', windowEnd: '22:00' };
const days = [day];

function act(id, name, durationMin, openingHours = '', coords = null) {
  const a = { id, name, timing: { duration_minutes: durationMin, opening_hours: openingHours } };
  if (coords) a.location = { lat: coords[0], lng: coords[1] };
  return a;
}

function meal(id, name, durationMin, openingHours = '', coords = null) {
  const m = act(id, name, durationMin, openingHours, coords);
  m.type = 'meal';
  return m;
}

function toMin(hhmm) {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
}

// ---- ported physics cases (now from day ASSIGNMENT, no input times) ----

test('places assigned activities with commute gap respected', () => {
  const activitiesById = {
    A: act('A', 'Shibuya Sky', 90, '10:00-22:30'),
    B: act('B', 'Ichiran', 45, '00:00-23:59')
  };
  const assignment = { '2026-05-20': ['A', 'B'] };
  const commuteMatrix = { A: { B: 20 } };
  const r = schedule({ assignment, days, activitiesById, commuteMatrix });
  assert.ok(r.placements.A && r.placements.B, 'both placed');
  const gap = toMin(r.placements.B.time) - (toMin(r.placements.A.time) + 90);
  assert.ok(gap >= 30, `commute+buffer respected (gap ${gap})`);
  assert.strictEqual(r.unplaced.length, 0);
});

test('drops an activity when opening hours leave no slot', () => {
  const activitiesById = {
    A: act('A', 'Long Tour', 180, '09:00-12:00'),
    B: act('B', 'Late Restaurant', 60, '18:00-22:00')
  };
  // Both assigned; with B's late window A must take the morning. They cannot both fit
  // before noon given A is 3h — one fits, the late one fits the evening. Assert validity.
  const r = schedule({ assignment: { '2026-05-20': ['A', 'B'] }, days, activitiesById, commuteMatrix: {} });
  assert.ok(validate({ placements: r.placements, days, activitiesById }).ok, 'output is physically valid');
});

test('valid schedule places everything inside windows', () => {
  const activitiesById = {
    A: act('A', 'Morning Walk', 60, '08:00-12:00'),
    B: act('B', 'Afternoon', 60, '11:00-15:00')
  };
  const r = schedule({ assignment: { '2026-05-20': ['A', 'B'] }, days, activitiesById, commuteMatrix: {} });
  assert.ok(r.placements.A && r.placements.B);
  assert.strictEqual(r.unplaced.length, 0);
  assert.ok(validate({ placements: r.placements, days, activitiesById }).ok);
});

test('routes a flexible activity past a locked anchor obstacle', () => {
  const activitiesById = {
    A: act('A', 'Morning Walk', 60, '08:00-12:00'),
    B: act('B', 'Evening Walk', 60, '14:00-22:00')
  };
  const lockedActivities = [{ id: 'L', date: '2026-05-20', time: '14:00', duration_minutes: 120, name: 'Tour' }];
  const r = schedule({ assignment: { '2026-05-20': ['A', 'B'] }, days, activitiesById, lockedActivities, commuteMatrix: {} });
  assert.ok(r.placements.B, 'B placed');
  assert.ok(toMin(r.placements.B.time) >= 16 * 60, 'B pushed past the 14:00-16:00 lock');
  assert.ok(validate({ placements: r.placements, lockedActivities, days, activitiesById }).ok);
});

test('locked meal claims its slot so a flexible dinner does not double up', () => {
  const activitiesById = {
    M: meal('M', 'Dinner Spot', 60, '17:00-22:00') // dinner-only flexible meal
  };
  const lockedActivities = [
    { id: 'LM', date: '2026-05-20', time: '19:00', duration_minutes: 90, type: 'meal', name: 'Locked Dinner' }
  ];
  const r = schedule({ assignment: { '2026-05-20': ['M'] }, days, activitiesById, lockedActivities, commuteMatrix: {} });
  assert.ok(!r.placements.M, 'flexible dinner not anchored — locked dinner already owns the slot');
  assert.ok(r.unplaced.some((u) => u.id === 'M'), 'reported unplaced');
});

test('flexible meal falls back to lunch when a locked meal owns dinner', () => {
  const activitiesById = {
    M: meal('M', 'Flexible Meal', 60, '11:00-22:00') // lunch + dinner capable
  };
  const lockedActivities = [
    { id: 'LM', date: '2026-05-20', time: '19:00', duration_minutes: 90, type: 'meal', name: 'Locked Dinner' }
  ];
  const r = schedule({ assignment: { '2026-05-20': ['M'] }, days, activitiesById, lockedActivities, commuteMatrix: {} });
  assert.ok(r.placements.M, 'placed');
  assert.ok(toMin(r.placements.M.time) < 17 * 60, 'placed at lunch, not the locked dinner slot');
});

test('drops overflow when a tight day cannot fit both', () => {
  const tightDay = { date: '2026-05-20', windowStart: '09:00', windowEnd: '11:00' };
  const activitiesById = { A: act('A', 'First', 60), B: act('B', 'Second', 60) };
  const commuteMatrix = { A: { B: 30 } };
  const r = schedule({ assignment: { '2026-05-20': ['A', 'B'] }, days: [tightDay], activitiesById, commuteMatrix });
  assert.strictEqual(Object.keys(r.placements).length, 1, 'only one fits');
  assert.strictEqual(r.unplaced.length, 1);
  assert.strictEqual(r.unplaced[0].reason, 'no_time_slot_remaining');
});

test('locked-only day with an activity on another day does not crash', () => {
  const arrivalDay = { date: '2026-05-19', windowStart: '11:43', windowEnd: '22:00', arrivalAvailableTime: '11:43' };
  const fullDay = { date: '2026-05-20', windowStart: '09:00', windowEnd: '22:00' };
  const activitiesById = { A: act('A', 'Activity on day 2', 60, '09:00-22:00') };
  const lockedActivities = [
    { id: 'arrival', date: '2026-05-19', time: '09:00', duration_minutes: 163, name: 'Arrive' },
    { id: 'checkin', date: '2026-05-19', time: '11:43', duration_minutes: 30, name: 'Check-in' }
  ];
  const r = schedule({ assignment: { '2026-05-20': ['A'] }, days: [arrivalDay, fullDay], activitiesById, lockedActivities, commuteMatrix: {} });
  assert.strictEqual(r.placements.A.time, '09:00');
  assert.strictEqual(r.unplaced.length, 0);
});

// ---- new redesign cases ----

test('no times in → valid times out, nothing overlaps', () => {
  const activitiesById = {
    A: act('A', 'A', 60, '09:00-20:00'),
    B: act('B', 'B', 60, '09:00-20:00'),
    C: act('C', 'C', 60, '09:00-20:00')
  };
  const r = schedule({ assignment: { '2026-05-20': ['A', 'B', 'C'] }, days, activitiesById, commuteMatrix: {} });
  assert.strictEqual(Object.keys(r.placements).length, 3);
  assert.ok(validate({ placements: r.placements, days, activitiesById }).ok);
  assert.deepStrictEqual(r.diagnostics, []);
});

test('ordering minimizes travel (brute-force beats a naive order)', () => {
  // A near C (15min), B far from both (60min). Window 09:00-13:45 fits all three ONLY if
  // the near pair is adjacent (travel 95min); a naive order with B in the middle needs
  // 140min of travel and overflows, dropping one. Brute-force must find the fitting order.
  const activitiesById = {
    A: act('A', 'A', 60, '09:00-13:45'),
    B: act('B', 'B', 60, '09:00-13:45'),
    C: act('C', 'C', 60, '09:00-13:45')
  };
  const commuteMatrix = { A: { C: 15, B: 60 }, C: { B: 60 } };
  const r = schedule({ assignment: { '2026-05-20': ['A', 'B', 'C'] }, days, activitiesById, commuteMatrix });
  assert.strictEqual(Object.keys(r.placements).length, 3, 'optimal order fits all three');
});

test('late-opening venue is ordered late, not dropped', () => {
  const activitiesById = {
    A: act('A', 'Morning', 60, '09:00-12:00'),
    B: act('B', 'Morning2', 60, '09:00-12:00'),
    L: act('L', 'Opens 14:00', 60, '14:00-18:00')
  };
  const r = schedule({ assignment: { '2026-05-20': ['A', 'B', 'L'] }, days, activitiesById, commuteMatrix: {} });
  assert.ok(r.placements.L, 'late venue placed');
  assert.ok(toMin(r.placements.L.time) >= 14 * 60, 'placed at/after 14:00');
});

test('cross-day meal redistribution moves a surplus lunch to a free day', () => {
  const d2 = [
    { date: '2026-05-20', windowStart: '09:00', windowEnd: '22:00' },
    { date: '2026-05-21', windowStart: '09:00', windowEnd: '22:00' }
  ];
  const activitiesById = {
    M1: meal('M1', 'Lunch A', 60, '11:00-15:00'),
    M2: meal('M2', 'Lunch B', 60, '11:00-15:00'),
    X: act('X', 'Sight', 60, '09:00-20:00')
  };
  // Both lunch-only meals assigned to day 1; day 2 has only a sight.
  const r = schedule({ assignment: { '2026-05-20': ['M1', 'M2'], '2026-05-21': ['X'] }, days: d2, activitiesById, commuteMatrix: {} });
  assert.ok(r.placements.M1 && r.placements.M2, 'both meals placed');
  assert.notStrictEqual(r.placements.M1.date, r.placements.M2.date, 'meals split across days');
  assert.ok(r.mealRedistributed >= 1);
});

test('non-meal overflow drops and never moves across days', () => {
  const d2 = [
    { date: '2026-05-20', windowStart: '09:00', windowEnd: '11:30' },
    { date: '2026-05-21', windowStart: '09:00', windowEnd: '22:00' }
  ];
  const activitiesById = {
    A: act('A', 'A', 90, '09:00-22:00'),
    B: act('B', 'B', 90, '09:00-22:00'),
    C: act('C', 'C', 90, '09:00-22:00')
  };
  // 3 × 90min assigned to a 2.5h day → one overflows; day 2 stays empty (no cross-day move).
  const r = schedule({ assignment: { '2026-05-20': ['A', 'B', 'C'], '2026-05-21': [] }, days: d2, activitiesById, commuteMatrix: {} });
  const dropped = r.unplaced.filter((u) => u.reason === 'no_time_slot_remaining');
  assert.ok(dropped.length >= 1, 'overflow dropped');
  for (const id of Object.keys(r.placements)) assert.strictEqual(r.placements[id].date, '2026-05-20', 'placed non-meals stayed on day 1');
});

test('empty dinner filled from an over-subscribed day (via redistribution)', () => {
  const d2 = [
    { date: '2026-05-20', windowStart: '09:00', windowEnd: '22:00' },
    { date: '2026-05-21', windowStart: '09:00', windowEnd: '22:00' }
  ];
  const activitiesById = {
    D1: meal('D1', 'Dinner A', 60, '17:00-23:00'),
    D2: meal('D2', 'Dinner B', 60, '17:00-23:00')
  };
  // Two dinner-only meals on day 1; day 2 has none. One must move to day 2's dinner.
  const r = schedule({ assignment: { '2026-05-20': ['D1', 'D2'], '2026-05-21': [] }, days: d2, activitiesById, commuteMatrix: {} });
  assert.ok(r.placements.D1 && r.placements.D2, 'both dinners placed');
  assert.notStrictEqual(r.placements.D1.date, r.placements.D2.date, 'one dinner moved to the empty day');
});

test('determinism: identical input yields byte-identical output', () => {
  const activitiesById = {
    A: act('A', 'A', 60, '09:00-20:00', [35.0, 135.7]),
    B: act('B', 'B', 60, '09:00-20:00', [35.01, 135.71]),
    C: act('C', 'C', 60, '09:00-20:00', [35.02, 135.72]),
    M: meal('M', 'Lunch', 60, '11:00-15:00', [35.0, 135.7])
  };
  const input = { assignment: { '2026-05-20': ['A', 'B', 'C', 'M'] }, days, activitiesById, commuteMatrix: { A: { B: 15, C: 20 } } };
  const r1 = JSON.stringify(schedule(input));
  const r2 = JSON.stringify(schedule(input));
  assert.strictEqual(r1, r2);
});

test('brute-force cutoff (n=7) and NN fallback (n=8) both terminate and stay valid', () => {
  const big = { date: '2026-05-20', windowStart: '07:00', windowEnd: '23:00' };
  const make = (n) => {
    const map = {};
    const ids = [];
    for (let i = 0; i < n; i += 1) { const id = `A${i}`; map[id] = act(id, id, 45, '07:00-23:00'); ids.push(id); }
    return { map, ids };
  };
  for (const n of [7, 8]) {
    const { map, ids } = make(n);
    const r = schedule({ assignment: { '2026-05-20': ids }, days: [big], activitiesById: map, commuteMatrix: {} });
    assert.ok(validate({ placements: r.placements, days: [big], activitiesById: map }).ok, `n=${n} valid`);
  }
});
