const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeItinerary } = require('./itineraryStore');

test('summarizeItinerary counts activities nested in days', () => {
  const summary = summarizeItinerary({
    id: 'it_1',
    days: [
      { activities: [{ name: 'A' }, { name: 'B' }] },
      { activities: [{ name: 'C' }] }
    ],
    activities: [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
  });
  assert.equal(summary.activityCount, 3);
  assert.equal(summary.days, 2);
});

test('summarizeItinerary falls back to top-level activities when days have none', () => {
  const summary = summarizeItinerary({
    id: 'it_2',
    days: [{ activities: [] }, {}],
    activities: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]
  });
  assert.equal(summary.activityCount, 4);
});

test('summarizeItinerary returns 0 when no activities anywhere', () => {
  assert.equal(summarizeItinerary({ id: 'it_3' }).activityCount, 0);
  assert.equal(summarizeItinerary({ id: 'it_4', days: [], activities: [] }).activityCount, 0);
});
