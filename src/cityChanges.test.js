const test = require('node:test');
const assert = require('node:assert/strict');
const { cityPlanningInputs, changedCityNames } = require('../shared/cityChanges');

const city = (id, name, startDate, endDate, extra = {}) => ({
  id, name, startDate, endDate, leaveTime: '18:00', notes: '',
  logistics: null, accommodation: null, travelEntry: null, latitude: 1, longitude: 2,
  detailsExpanded: false, ...extra
});
const snap = (cities, extra = {}) => ({ cities, travels: [], budget: null, travelers: 2, children: 0, ...extra });

const TOKYO = city('c1', 'Tokyo', '2026-06-01', '2026-06-03');
const KYOTO = city('c2', 'Kyoto', '2026-06-03', '2026-06-06');
const NARA = city('c3', 'Nara', '2026-06-06', '2026-06-08');

test('an untouched trip reports nothing', () => {
  assert.deepEqual(changedCityNames(snap([TOKYO, KYOTO]), snap([{ ...TOKYO }, { ...KYOTO }])), []);
});

test('only the edited city is reported', () => {
  const edited = { ...KYOTO, endDate: '2026-06-07' };
  assert.deepEqual(changedCityNames(snap([TOKYO, KYOTO]), snap([TOKYO, edited])), ['Kyoto']);
});

test('a newly added city is reported alone, so its neighbours keep their activities', () => {
  assert.deepEqual(changedCityNames(snap([TOKYO, KYOTO]), snap([TOKYO, KYOTO, NARA])), ['Nara']);
});

test('a trip that visits the same city twice reports nothing when untouched', () => {
  // Keying the lookup on name collapses the two legs: the first never matches and reports as
  // changed on every Continue, on a trip nobody edited.
  const tokyoAgain = city('c3', 'Tokyo', '2026-06-06', '2026-06-08');
  const planned = snap([TOKYO, KYOTO, tokyoAgain]);
  assert.deepEqual(changedCityNames(planned, snap([{ ...TOKYO }, { ...KYOTO }, { ...tokyoAgain }])), []);
});

test('editing one leg of a repeat-visit trip still reports that city', () => {
  const tokyoAgain = city('c3', 'Tokyo', '2026-06-06', '2026-06-08');
  const moved = { ...tokyoAgain, endDate: '2026-06-09' };
  assert.deepEqual(changedCityNames(snap([TOKYO, KYOTO, tokyoAgain]), snap([TOKYO, KYOTO, moved])), ['Tokyo']);
});

test('removing a city puts the whole trip in scope rather than passing silently', () => {
  // The removed city's activities are still in state and now orphaned; the user has to be told.
  assert.deepEqual(changedCityNames(snap([TOKYO, KYOTO]), snap([TOKYO])), ['Tokyo']);
});

test('trip-level inputs put every city in scope', () => {
  const before = snap([TOKYO, KYOTO]);
  assert.deepEqual(changedCityNames(before, snap([TOKYO, KYOTO], { travelers: 4 })), ['Tokyo', 'Kyoto']);
  assert.deepEqual(changedCityNames(before, snap([TOKYO, KYOTO], { budget: 5000 })), ['Tokyo', 'Kyoto']);
  assert.deepEqual(changedCityNames(before, snap([TOKYO, KYOTO], { children: 1 })), ['Tokyo', 'Kyoto']);
  assert.deepEqual(changedCityNames(before, snap([TOKYO, KYOTO], { travels: [{ mode: 'flight' }] })), ['Tokyo', 'Kyoto']);
});

test('UI-only state is never a reason to regenerate', () => {
  const expanded = { ...TOKYO, detailsExpanded: !TOKYO.detailsExpanded };
  assert.deepEqual(changedCityNames(snap([TOKYO, KYOTO]), snap([expanded, KYOTO])), []);
});

test('falls back to the whole trip when there is no snapshot or no identity to match on', () => {
  assert.deepEqual(changedCityNames(null, snap([TOKYO, KYOTO])), ['Tokyo', 'Kyoto']);
  const noId = { ...KYOTO, id: undefined };
  assert.deepEqual(changedCityNames(snap([TOKYO, noId]), snap([TOKYO, noId])), ['Tokyo', 'Kyoto']);
});

test('cityPlanningInputs carries the planner payload and nothing else', () => {
  const projected = cityPlanningInputs(TOKYO);
  assert.deepEqual(Object.keys(projected).sort(), [
    'accommodation', 'endDate', 'latitude', 'leaveTime', 'logistics',
    'longitude', 'name', 'notes', 'startDate', 'travelEntry'
  ]);
  assert.equal('id' in projected, false);
  assert.equal('detailsExpanded' in projected, false);
});
