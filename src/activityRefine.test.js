const test = require('node:test');
const assert = require('node:assert/strict');
const { applyCostShapeToUpdates } = require('./routes/activities');

const nestedActivity = () => ({
  name: 'Fancy Dinner',
  cost: { estimated_usd: 120, type: 'per_person' }
});

const legacyActivity = () => ({
  name: 'Fancy Dinner',
  estimated_cost_usd: 120,
  cost_type: 'per_person'
});

test('nested activity + top-level update folds into cost object', () => {
  const updates = applyCostShapeToUpdates(nestedActivity(), { estimated_cost_usd: 45 });
  assert.deepEqual(updates.cost, { estimated_usd: 45, type: 'per_person' });
  assert.equal(updates.estimated_cost_usd, undefined);
  assert.equal(updates.cost_type, undefined);
});

test('nested activity + top-level update with cost_type carries the new type', () => {
  const updates = applyCostShapeToUpdates(nestedActivity(), { estimated_cost_usd: 45, cost_type: 'per_group' });
  assert.deepEqual(updates.cost, { estimated_usd: 45, type: 'per_group' });
});

test('nested activity + nested update is left as-is', () => {
  const updates = applyCostShapeToUpdates(nestedActivity(), { cost: { estimated_usd: 45, type: 'per_person' } });
  assert.deepEqual(updates.cost, { estimated_usd: 45, type: 'per_person' });
});

test('legacy activity + nested update folds into top-level fields', () => {
  const updates = applyCostShapeToUpdates(legacyActivity(), { cost: { estimated_usd: 45, type: 'per_group' } });
  assert.equal(updates.estimated_cost_usd, 45);
  assert.equal(updates.cost_type, 'per_group');
  assert.equal(updates.cost, undefined);
});

test('legacy activity + nested update without type falls back to activity cost_type', () => {
  const updates = applyCostShapeToUpdates(legacyActivity(), { cost: { estimated_usd: 45 } });
  assert.equal(updates.estimated_cost_usd, 45);
  assert.equal(updates.cost_type, 'per_person');
});

test('legacy activity + top-level update is left as-is', () => {
  const updates = applyCostShapeToUpdates(legacyActivity(), { estimated_cost_usd: 45 });
  assert.equal(updates.estimated_cost_usd, 45);
  assert.equal(updates.cost, undefined);
});

test('update with no cost fields is untouched', () => {
  const updates = applyCostShapeToUpdates(nestedActivity(), { name: 'Cheap Eats', why_it_fits: 'budget' });
  assert.deepEqual(updates, { name: 'Cheap Eats', why_it_fits: 'budget' });
});

test('non-numeric cost values are ignored', () => {
  const updates = applyCostShapeToUpdates(nestedActivity(), { estimated_cost_usd: 'free' });
  assert.equal(updates.cost, undefined);
  assert.equal(updates.estimated_cost_usd, 'free');
});
