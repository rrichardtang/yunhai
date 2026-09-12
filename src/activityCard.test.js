// Tests for the cost and duration accessors in public/js/activityCard.js, which read two activity
// shapes: the nested {cost:{estimated_usd,type}} / {timing:{duration_minutes}} form and the legacy
// flat estimated_cost_usd / cost_type / duration_hours form.
//
// Two cost bases coexisting is what produced the $90-vs-$180 finalize mismatch (decisions
// [2026-07-07]), so these accessors are the seam worth pinning.
const test = require('node:test');
const assert = require('node:assert');

const { actCostUsd, actCostType, actDurationHours } = require('../public/js/activityCard.js');

test('cost accessors read both the nested and the legacy flat shape', () => {
  assert.strictEqual(actCostUsd({ cost: { estimated_usd: 90, type: 'per_person' } }), 90);
  assert.strictEqual(actCostType({ cost: { estimated_usd: 90, type: 'per_person' } }), 'per_person');
  assert.strictEqual(actCostUsd({ estimated_cost_usd: 90, cost_type: 'total' }), 90);
  assert.strictEqual(actCostType({ estimated_cost_usd: 90, cost_type: 'total' }), 'total');
});

test('a nested zero cost is reported as 0, not as missing', () => {
  // The `a.cost != null` guard is what makes this work — a truthiness check would fall through to
  // the legacy field and report a free activity at someone else's price.
  assert.strictEqual(actCostUsd({ cost: { estimated_usd: 0 }, estimated_cost_usd: 45 }), 0);
});

test('cost type defaults to per_person only when nothing says otherwise', () => {
  assert.strictEqual(actCostType({}), 'per_person');
  assert.strictEqual(actCostType(null), 'per_person');
});

test('actDurationHours prefers the nested timing shape and falls back cleanly', () => {
  assert.strictEqual(actDurationHours({ timing: { duration_minutes: 90 } }), 1.5);
  assert.strictEqual(actDurationHours({ timing: {} }), 1, 'nested-but-empty uses the 60min default');
  assert.strictEqual(actDurationHours({ duration_hours: 3 }), 3);
  assert.strictEqual(actDurationHours(null, 2), 2);
});
