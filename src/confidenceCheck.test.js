const test = require('node:test');
const assert = require('node:assert/strict');
const { computeConfidence } = require('./confidenceCheck');

test('computeConfidence flags overlapping activities and missing times', () => {
  const result = computeConfidence({
    days: [{
      date: '2026-06-01',
      city: 'Tokyo',
      activities: [
        { name: 'A', time: '10:00', duration_hours: 2 },
        { name: 'B', time: '11:00', duration_hours: 1 },
        { name: 'C', duration_hours: 1 }
      ]
    }],
    confidence: {
      checklist: [{ title: 'Hotel', status: 'pending' }]
    }
  });

  assert.equal(result.status, 'Conflicts found');
  assert.ok(result.issues.some((x) => x.type === 'overlapping_activities'));
  assert.ok(result.issues.some((x) => x.type === 'missing_datetime'));
});

test('computeConfidence returns Ready when checklist verified and no issues', () => {
  const result = computeConfidence({
    cities: [{ name: 'Lisbon', startDate: '2026-07-01', endDate: '2026-07-03' }],
    days: [{
      date: '2026-07-01',
      city: 'Lisbon',
      activities: [{ name: 'Walk', time: '10:00', duration_hours: 2 }]
    }],
    confidence: {
      checklist: [{ title: 'Flight', status: 'verified' }]
    }
  });

  assert.equal(result.status, 'Ready');
  assert.equal(result.issueCount, 0);
});
