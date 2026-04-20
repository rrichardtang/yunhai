const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { showUpEarlyMins } = require('./arrangeArrivalBuffers');

describe('showUpEarlyMins', () => {
  it('returns 15 for tour', () => assert.equal(showUpEarlyMins('tour'), 15));
  it('returns 15 for attraction', () => assert.equal(showUpEarlyMins('attraction'), 15));
  it('returns 0 for restaurant', () => assert.equal(showUpEarlyMins('restaurant'), 0));
  it('returns 0 for none', () => assert.equal(showUpEarlyMins('none'), 0));
  it('returns 0 for unknown type', () => assert.equal(showUpEarlyMins('unknown'), 0));
  it('returns 0 for undefined', () => assert.equal(showUpEarlyMins(undefined), 0));
});
