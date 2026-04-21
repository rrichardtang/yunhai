const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findLockedOverlaps } = require('./findLockedOverlaps.js');

function entry(id, date, time, duration_minutes = 60) {
  return { id, name: id, date, time, duration_minutes };
}

test('no conflicts when empty', () => {
  assert.deepEqual(findLockedOverlaps([]), []);
});

test('no conflicts — different days, same time', () => {
  const result = findLockedOverlaps([
    entry('a', '2026-05-01', '10:00'),
    entry('b', '2026-05-02', '10:00')
  ]);
  assert.equal(result.length, 0);
});

test('no conflicts — same day, sequential with gap', () => {
  const result = findLockedOverlaps([
    entry('a', '2026-05-01', '09:00', 60),  // 09:00–10:00
    entry('b', '2026-05-01', '10:00', 60)   // 10:00–11:00 — touching boundary, not overlapping
  ]);
  assert.equal(result.length, 0);
});

test('conflict — same day, fully overlapping', () => {
  const result = findLockedOverlaps([
    entry('a', '2026-05-01', '10:00', 120), // 10:00–12:00
    entry('b', '2026-05-01', '11:00', 60)   // 11:00–12:00
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0][0].id, 'a');
  assert.equal(result[0][1].id, 'b');
});

test('conflict — same day, partial overlap', () => {
  const result = findLockedOverlaps([
    entry('a', '2026-05-01', '14:00', 90), // 14:00–15:30
    entry('b', '2026-05-01', '15:00', 60)  // 15:00–16:00
  ]);
  assert.equal(result.length, 1);
});

test('multiple conflicts returned', () => {
  const result = findLockedOverlaps([
    entry('a', '2026-05-01', '10:00', 120), // 10:00–12:00
    entry('b', '2026-05-01', '10:30', 60),  // 10:30–11:30 — overlaps a
    entry('c', '2026-05-01', '11:00', 90)   // 11:00–12:30 — overlaps a and b
  ]);
  assert.equal(result.length, 3);
});

test('no conflict when single entry', () => {
  assert.equal(findLockedOverlaps([entry('a', '2026-05-01', '10:00')]).length, 0);
});
