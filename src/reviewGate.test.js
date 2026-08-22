const test = require('node:test');
const assert = require('node:assert/strict');
const { activityVerdict, reviewGateState } = require('../shared/reviewGate');

const activities = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const allVisible = new Set(['a', 'b', 'c']);
const gate = (reviewed, visible = allVisible) => reviewGateState(activities, reviewed, visible);

test('an undecided activity has no verdict, and false is a real one', () => {
  assert.equal(activityVerdict({}, 'a'), null);
  assert.equal(activityVerdict({ a: {} }, 'a'), null);
  assert.equal(activityVerdict({ a: { approved: null } }, 'a'), null);
  assert.equal(activityVerdict({ a: { notes: 'hi' } }, 'a'), null);
  assert.equal(activityVerdict({ a: { approved: true } }, 'a'), true);
  assert.equal(activityVerdict({ a: { approved: false } }, 'a'), false);
});

test('approving some but not all does not open the step', () => {
  // The reported bug: approving activities individually left Continue disabled with
  // no explanation, and only Approve All got past it.
  const g = gate({ a: { approved: true }, b: { approved: true } });
  assert.equal(g.canContinue, false);
  assert.equal(g.undecidedCount, 1);
  assert.match(g.reason, /remaining 1 activity/);
});

test('a decision on every activity opens the step, however it was reached', () => {
  const individually = gate({ a: { approved: true }, b: { approved: false }, c: { approved: true } });
  assert.equal(individually.canContinue, true);
  assert.equal(individually.reason, '');

  const allAtOnce = gate({ a: { approved: true }, b: { approved: true }, c: { approved: true } });
  assert.equal(allAtOnce.canContinue, true);
});

test('declining everything does not open the step — there is nothing to arrange', () => {
  const g = gate({ a: { approved: false }, b: { approved: false }, c: { approved: false } });
  assert.equal(g.canContinue, false);
  assert.equal(g.undecidedCount, 0);
  assert.match(g.reason, /Approve at least one/);
});

test('an undecided activity hidden by a filter says so', () => {
  // Approve All only covers visible cards, so without this the traveler is stuck
  // with a disabled button and nothing on screen to act on.
  const reviewed = { a: { approved: true }, b: { approved: true } };
  const g = gate(reviewed, new Set(['a', 'b']));
  assert.equal(g.canContinue, false);
  assert.equal(g.hiddenCount, 1);
  assert.match(g.reason, /1 hidden by your current filters/);

  assert.equal(gate(reviewed, allVisible).hiddenCount, 0);
  assert.doesNotMatch(gate(reviewed, allVisible).reason, /hidden/);
});

test('filters never change whether the step is complete, only the message', () => {
  const decided = { a: { approved: true }, b: { approved: false }, c: { approved: true } };
  assert.equal(gate(decided, new Set()).canContinue, true);
  assert.equal(gate(decided, new Set(['a'])).canContinue, true);
});

test('a trip with no activities cannot continue', () => {
  const g = reviewGateState([], {}, new Set());
  assert.equal(g.canContinue, false);
  assert.match(g.reason, /Plan some activities/);
});

test('the remaining-count message is singular or plural as it should be', () => {
  assert.match(gate({ a: { approved: true } }).reason, /remaining 2 activities/);
  assert.match(gate({ a: { approved: true }, b: { approved: false } }).reason, /remaining 1 activity/);
});
