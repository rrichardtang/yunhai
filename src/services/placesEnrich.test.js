const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isFoodActivity,
  isVenueActivity,
  formatOpeningHoursFromPlaces,
  PRICE_LEVEL_MAP
} = require('./placesEnrich');

test('food categories are detected', () => {
  assert.equal(isFoodActivity({ name: 'Dinner at Botín', category: 'dinner' }), true);
  assert.equal(isFoodActivity({ name: 'Lunch spot', category: 'lunch' }), true);
  assert.equal(isFoodActivity({ name: 'Brunch place', category: 'breakfast' }), true);
  assert.equal(isFoodActivity({ name: 'Tapas crawl', category: 'food' }), true);
  assert.equal(isFoodActivity({ name: 'Rooftop bar drinks' }), true);
});

test('non-food categories are not flagged as food', () => {
  assert.equal(isFoodActivity({ name: 'Prado Museum', category: 'museum' }), false);
  assert.equal(isFoodActivity({ name: 'Retiro Park walk', category: 'walk' }), false);
});

test('venue categories include concrete-place activities beyond food', () => {
  assert.equal(isVenueActivity({ name: 'Prado Museum', category: 'museum' }), true);
  assert.equal(isVenueActivity({ name: 'Mercado de San Miguel', category: 'market' }), true);
  assert.equal(isVenueActivity({ name: 'Flamenco show', category: 'show' }), true);
  assert.equal(isVenueActivity({ name: 'Reina Sofia', category: 'gallery' }), true);
});

test('venue categories exclude open-air / non-place activities', () => {
  assert.equal(isVenueActivity({ name: 'Walking tour', category: 'walk' }), false);
  assert.equal(isVenueActivity({ name: 'Retiro Park', category: 'park' }), false);
  assert.equal(isVenueActivity({ name: 'Day trip', category: 'tour' }), false);
  assert.equal(isVenueActivity({ name: 'Sunset stroll', category: 'sunset' }), false);
});

test('price level map covers all Google levels', () => {
  assert.equal(PRICE_LEVEL_MAP.PRICE_LEVEL_FREE, 0);
  assert.equal(PRICE_LEVEL_MAP.PRICE_LEVEL_INEXPENSIVE, 1);
  assert.equal(PRICE_LEVEL_MAP.PRICE_LEVEL_MODERATE, 2);
  assert.equal(PRICE_LEVEL_MAP.PRICE_LEVEL_EXPENSIVE, 3);
  assert.equal(PRICE_LEVEL_MAP.PRICE_LEVEL_VERY_EXPENSIVE, 4);
});

test('formats single daily window from Places periods', () => {
  const periods = [
    { open: { day: 1, hour: 10, minute: 0 }, close: { day: 1, hour: 18, minute: 0 } },
    { open: { day: 2, hour: 10, minute: 0 }, close: { day: 2, hour: 18, minute: 0 } }
  ];
  assert.equal(formatOpeningHoursFromPlaces({ periods }), '10:00-18:00');
});

test('formats split lunch/dinner windows from Places periods', () => {
  const periods = [
    { open: { day: 1, hour: 12, minute: 0 }, close: { day: 1, hour: 14, minute: 30 } },
    { open: { day: 1, hour: 19, minute: 0 }, close: { day: 1, hour: 22, minute: 30 } }
  ];
  assert.equal(formatOpeningHoursFromPlaces({ periods }), '12:00-14:30,19:00-22:30');
});

test('handles 24h venues (no close)', () => {
  const periods = [{ open: { day: 0, hour: 0, minute: 0 } }];
  assert.equal(formatOpeningHoursFromPlaces({ periods }), '00:00-23:59');
});

test('clamps overnight close to end-of-day', () => {
  const periods = [
    { open: { day: 5, hour: 20, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }
  ];
  assert.equal(formatOpeningHoursFromPlaces({ periods }), '20:00-23:59');
});

test('returns null for empty/missing periods', () => {
  assert.equal(formatOpeningHoursFromPlaces(null), null);
  assert.equal(formatOpeningHoursFromPlaces({ periods: [] }), null);
});
