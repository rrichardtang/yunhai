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
      checklist: [{ type: 'accommodation', city: 'Tokyo', dateTime: '2026-06-01T15:00:00', status: 'open', notes: 'Hotel' }]
    }
  });

  assert.equal(result.status, 'Conflicts found');
  assert.ok(result.issues.some((x) => x.type === 'overlapping_activities'));
  assert.ok(result.issues.some((x) => x.type === 'missing_datetime'));
  assert.equal(result.checklistSummary.counts.open, 1);
});

test('computeConfidence returns Ready when checklist finalized and no issues', () => {
  const result = computeConfidence({
    cities: [{ name: 'Lisbon', startDate: '2026-07-01', endDate: '2026-07-03' }],
    days: [{
      date: '2026-07-01',
      city: 'Lisbon',
      activities: [{ name: 'Walk', time: '10:00', duration_hours: 2 }]
    }],
    confidence: {
      checklist: [{ type: 'transportation', city: 'Lisbon', dateTime: '2026-07-01T09:00:00', status: 'finalized', notes: 'Flight' }]
    }
  });

  assert.equal(result.status, 'Ready');
  assert.equal(result.issueCount, 0);
  assert.equal(result.checklistSummary.counts.finalized, 1);
  assert.equal(result.checklistSummary.groupedChecklist[0].city, 'Lisbon');
});

test('computeConfidence returns empty checklist when no data provided', () => {
  const result = computeConfidence({});
  assert.equal(result.checklist.length, 0);
});

test('computeConfidence migrates old checklist format', () => {
  const result = computeConfidence({
    confidence: {
      checklist: [
        { type: 'flight', name: 'SFO to NRT', state: 'verified', dateTime: '2026-06-01', bookingReference: 'ABC123' },
        { type: 'hotel', name: 'Tokyo Hotel', state: 'needs_booking', dateTime: '2026-06-01' }
      ]
    }
  });
  assert.equal(result.checklist[0].type, 'transportation');
  assert.equal(result.checklist[0].status, 'resolved');
  assert.equal(result.checklist[0].name, 'SFO to NRT');
  assert.equal(result.checklist[0].bookingReference, 'ABC123');
  assert.equal(result.checklist[0].verified, true);
  assert.equal(result.checklist[1].type, 'accommodation');
  assert.equal(result.checklist[1].status, 'open');
});
