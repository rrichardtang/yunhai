const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isFoodActivity, PRICE_LEVEL_MAP } = require('./placesEnrich');

test('food categories are detected', () => {
  assert.equal(isFoodActivity({ name: 'Dinner at Botín', category: 'dinner' }), true);
  assert.equal(isFoodActivity({ name: 'Lunch spot', category: 'lunch' }), true);
  assert.equal(isFoodActivity({ name: 'Brunch place', category: 'breakfast' }), true);
  assert.equal(isFoodActivity({ name: 'Tapas crawl', category: 'food' }), true);
  assert.equal(isFoodActivity({ name: 'Rooftop bar drinks' }), true);
});

test('non-food categories are not enriched', () => {
  assert.equal(isFoodActivity({ name: 'Prado Museum', category: 'museum' }), false);
  assert.equal(isFoodActivity({ name: 'Retiro Park walk', category: 'walk' }), false);
  assert.equal(isFoodActivity({ name: 'Flamenco show', category: 'show' }), false);
});

test('price level map covers all Google levels', () => {
  assert.equal(PRICE_LEVEL_MAP.PRICE_LEVEL_FREE, 0);
  assert.equal(PRICE_LEVEL_MAP.PRICE_LEVEL_INEXPENSIVE, 1);
  assert.equal(PRICE_LEVEL_MAP.PRICE_LEVEL_MODERATE, 2);
  assert.equal(PRICE_LEVEL_MAP.PRICE_LEVEL_EXPENSIVE, 3);
  assert.equal(PRICE_LEVEL_MAP.PRICE_LEVEL_VERY_EXPENSIVE, 4);
});
