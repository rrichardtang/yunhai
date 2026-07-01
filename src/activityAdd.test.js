const test = require('node:test');
const assert = require('node:assert/strict');
const { groundActivityToPlace } = require('./routes/activities');
const { normalizeActivity } = require('./claude');

const PLACE = {
  placeId: 'ChIJabc123',
  lat: 37.7648,
  lng: -122.4194,
  name: 'Sisterita',
  formattedAddress: '3560 18th St, San Francisco, CA 94110, USA',
  priceLevel: 2,
  openingHours: '11:00-21:00'
};

test('groundActivityToPlace forces the canonical place name and venue', () => {
  const activity = normalizeActivity({ name: 'Sausalito Day Trip', type: 'meal' }, 'San Francisco');
  groundActivityToPlace(activity, PLACE);
  assert.equal(activity.name, 'Sisterita');
  assert.equal(activity.venue_name, 'Sisterita');
});

test('groundActivityToPlace applies place_id, coords, address, and opening hours', () => {
  const activity = normalizeActivity({ name: 'Sisterita', type: 'meal' }, 'San Francisco');
  groundActivityToPlace(activity, PLACE);
  assert.equal(activity.place_id, 'ChIJabc123');
  assert.equal(activity.location.lat, 37.7648);
  assert.equal(activity.location.lng, -122.4194);
  assert.equal(activity.location.address, '3560 18th St, San Francisco, CA 94110, USA');
  assert.equal(activity.opening_hours, '11:00-21:00');
  assert.equal(activity.timing.opening_hours, '11:00-21:00');
  assert.equal(activity.price_level, 2);
});

test('groundActivityToPlace lets user-supplied cost win over LLM cost', () => {
  const activity = normalizeActivity({ name: 'Sisterita', type: 'meal', estimated_cost_usd: 80 }, 'San Francisco');
  groundActivityToPlace(activity, PLACE, { cost: 30, costType: 'per_group' });
  assert.equal(activity.cost.estimated_usd, 30);
  assert.equal(activity.cost.type, 'per_group');
});

test('groundActivityToPlace with no place only applies the cost override', () => {
  const activity = normalizeActivity({ name: 'Hidden Gem Tour', type: 'tour' }, 'Kyoto');
  groundActivityToPlace(activity, null, { cost: 55, costType: 'per_person' });
  assert.equal(activity.name, 'Hidden Gem Tour');
  assert.equal(activity.place_id, undefined);
  assert.equal(activity.location.lat, null);
  assert.equal(activity.cost.estimated_usd, 55);
  assert.equal(activity.cost.type, 'per_person');
});

test('groundActivityToPlace handles legacy-shaped activities', () => {
  const activity = { name: 'Sisterita', city: 'San Francisco', estimated_cost_usd: 80, cost_type: 'per_person' };
  groundActivityToPlace(activity, PLACE, { cost: 25, costType: 'per_group' });
  assert.equal(activity.name, 'Sisterita');
  assert.equal(activity.location.lat, 37.7648);
  assert.equal(activity.estimated_cost_usd, 25);
  assert.equal(activity.cost_type, 'per_group');
});
