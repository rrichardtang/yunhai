const test = require('node:test');
const assert = require('node:assert');
const { buildChatSystemPrompt, parseChatResponse } = require('./chatPrompt');

function digest(overrides = {}) {
  return {
    name: 'teamLab Planets', type: 'museum', durationMin: 120, location: 'Toyosu',
    lat: 35.6, lng: 139.7, costUsd: 32, costType: 'per_person',
    booking: { type: 'attraction', reference: null, links: [] },
    openingHours: '', whyItFits: 'immersive art', pitfall: 'sells out', insiderTips: null, smarterAlternative: null,
    ...overrides
  };
}

test('serializer renders accommodation address, coords, check-in, and arrival', () => {
  const prompt = buildChatSystemPrompt({
    cities: [{
      name: 'Tokyo', startDate: '2026-06-01', endDate: '2026-06-04', leaveTime: '18:00', notes: 'avoid crush hour',
      accommodation: { address: 'Park Hotel Tokyo', checkIn: '2026-06-01', checkOut: '2026-06-04', lat: 35.66, lng: 139.76 },
      arrival: { mode: 'flight', time: '15:00' }
    }]
  });
  assert.match(prompt, /staying: Park Hotel Tokyo \(35\.66,139\.76\)/);
  assert.match(prompt, /check-in 2026-06-01 → check-out 2026-06-04/);
  assert.match(prompt, /arriving by flight at 15:00/);
  assert.match(prompt, /notes: avoid crush hour/);
});

test('duration renders from durationMin and never shows undefined', () => {
  const prompt = buildChatSystemPrompt({
    scheduledByDay: [{ date: '2026-06-01', city: 'Tokyo', activities: [{ time: '09:00', ...digest({ durationMin: 90 }) }] }]
  });
  assert.match(prompt, /90min/);
  assert.doesNotMatch(prompt, /undefined/);
});

test('activity with no durationMin omits the minutes rather than printing undefined', () => {
  const prompt = buildChatSystemPrompt({
    scheduledByDay: [{ date: '2026-06-01', city: 'Tokyo', activities: [{ time: '09:00', ...digest({ durationMin: null }) }] }]
  });
  assert.doesNotMatch(prompt, /undefined/);
  assert.doesNotMatch(prompt, /, min\)/);
});

test('shortlist digests render cost, why, pitfall and booking status', () => {
  const prompt = buildChatSystemPrompt({
    approvedActivities: [digest()],
    declinedActivities: [{ name: 'Robot Restaurant', type: 'show', whyItFits: 'too touristy', booking: { type: 'none' } }]
  });
  assert.match(prompt, /Activities on the shortlist/);
  assert.match(prompt, /\$32\/per_person/);
  assert.match(prompt, /why: immersive art/);
  assert.match(prompt, /needs booking via attraction/);
  assert.match(prompt, /Activities the traveler declined/);
  assert.match(prompt, /Robot Restaurant/);
});

test('booked activity shows the reference instead of needs-booking', () => {
  const prompt = buildChatSystemPrompt({
    approvedActivities: [digest({ booking: { type: 'attraction', reference: 'ABC123', links: [] } })]
  });
  assert.match(prompt, /booked \(ref ABC123\)/);
  assert.doesNotMatch(prompt, /needs booking/);
});

test('token guard caps detailed activities and summarizes the rest', () => {
  const activities = Array.from({ length: 40 }, (_, i) => ({ time: '09:00', ...digest({ name: `Act${i}`, whyItFits: `reason ${i}` }) }));
  const prompt = buildChatSystemPrompt({
    scheduledByDay: [{ date: '2026-06-01', city: 'Tokyo', activities }]
  });
  // First activities show the "why" detail line; later ones are summarized to name only.
  assert.match(prompt, /why: reason 0/);
  assert.doesNotMatch(prompt, /why: reason 39/);
  assert.match(prompt, /Act39/);
});

test('parseChatResponse parses JSON and falls back on plain prose', () => {
  assert.deepEqual(
    parseChatResponse('{"reply":"hi","signals":[{"constraint":"Allergic to sushi"}]}'),
    { reply: 'hi', signals: [{ constraint: 'Allergic to sushi' }] }
  );
  assert.deepEqual(parseChatResponse('```json\n{"reply":"x","signals":[]}\n```'), { reply: 'x', signals: [] });
  const fallback = parseChatResponse('just plain text, not json');
  assert.equal(fallback.reply, 'just plain text, not json');
  assert.deepEqual(fallback.signals, []);
});
