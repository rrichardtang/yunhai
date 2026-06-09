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

test('summarizeItinerary uses days array length when populated', () => {
  const summary = summarizeItinerary({
    id: 'it_5',
    days: [{}, {}, {}],
    cities: [{ startDate: '2026-06-01', endDate: '2026-06-10' }]
  });
  assert.equal(summary.days, 3);
});

test('summarizeItinerary falls back to city date spans (inclusive) when days empty', () => {
  const summary = summarizeItinerary({
    id: 'it_6',
    days: [],
    cities: [
      { startDate: '2026-06-01', endDate: '2026-06-03' },
      { startDate: '2026-06-04', endDate: '2026-06-04' }
    ]
  });
  assert.equal(summary.days, 4);
});

test('summarizeItinerary day fallback ignores invalid/reversed city dates', () => {
  const summary = summarizeItinerary({
    id: 'it_7',
    days: [],
    cities: [
      { startDate: '2026-06-05', endDate: '2026-06-01' },
      { startDate: '', endDate: '' },
      { startDate: '2026-06-10', endDate: '2026-06-11' }
    ]
  });
  assert.equal(summary.days, 2);
});
