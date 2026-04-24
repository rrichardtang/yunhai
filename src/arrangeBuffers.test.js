const { test } = require('node:test');
const assert = require('node:assert/strict');
const { arrivalBufferMins, departureBufferMins } = require('../shared/arrangeBuffers.js');

test('arrivalBufferMins flight international', () => {
  assert.equal(arrivalBufferMins('flight', true), 135);
});

test('arrivalBufferMins flight domestic', () => {
  assert.equal(arrivalBufferMins('flight', false), 70);
});

test('arrivalBufferMins train', () => {
  assert.equal(arrivalBufferMins('train'), 45);
});

test('arrivalBufferMins unknown mode falls back to other', () => {
  assert.equal(arrivalBufferMins('unknown'), 60);
});

test('departureBufferMins flight international', () => {
  assert.equal(departureBufferMins('flight', true), 180);
});
