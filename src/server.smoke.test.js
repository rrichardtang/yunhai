const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

const app = require('./server');

const routes = [
  ['get', '/api/status'],
  ['get', '/api/auth/session'],
  ['post', '/api/email/inbound'],
  ['get', '/api/geocode?q=Paris'],
  ['get', '/api/places/resolve'],
  ['post', '/api/activity/refine'],
  ['post', '/api/activity/replace'],
  ['get', '/api/arrange-config'],
  ['post', '/api/arrange'],
  ['post', '/api/plan'],
  ['get', '/api/image'],
  ['post', '/api/commute'],
  ['get', '/api/preferences'],
  ['put', '/api/preferences'],
  ['post', '/api/preferences/reset'],
  ['get', '/api/userdata'],
  ['put', '/api/userdata'],
  ['get', '/api/userdata/field'],
  ['put', '/api/userdata/field'],
  ['post', '/api/profile/enrich'],
  ['post', '/api/chat/message'],
  ['get', '/api/chat/session/abc'],
  ['delete', '/api/chat/session/abc'],
  ['post', '/api/itinerary'],
  ['get', '/api/itinerary'],
  ['get', '/api/itineraries'],
  ['get', '/api/itinerary/abc'],
  ['put', '/api/itinerary/abc'],
  ['delete', '/api/itinerary/abc'],
  ['get', '/api/itinerary/abc/trip-health'],
  ['put', '/api/itinerary/abc/trip-health'],
  ['post', '/api/itinerary/abc/trip-health/email-summary'],
  ['get', '/api/calendar/google/auth-url'],
  ['get', '/api/calendar/google/status'],
  ['get', '/api/calendar/google/oauth/callback'],
  ['post', '/api/itinerary/abc/calendar/google/precheck'],
  ['post', '/api/itinerary/abc/calendar/google/sync'],
  ['get', '/api/itinerary/abc/calendar.ics'],
  ['get', '/api/itinerary/abc/activity/xyz/attachments'],
  ['get', '/api/itinerary/abc/attachments'],
  ['get', '/api/attachments/abc'],
  ['delete', '/api/attachments/abc']
];

for (const [method, path] of routes) {
  test(`${method.toUpperCase()} ${path} is mounted`, async () => {
    const res = await request(app)[method](path).send({});
    assert.notEqual(res.status, 404, `route ${method} ${path} returned 404 — not mounted`);
  });
}

test('GET /debug/codes is removed (falls through to the SPA catch-all)', async () => {
  const res = await request(app).get('/debug/codes');
  assert.match(res.headers['content-type'] || '', /html/);
  assert.equal(res.body.codes, undefined);
});

test('GET /api/status does not expose the Google Maps API key', async () => {
  const res = await request(app).get('/api/status');
  assert.equal(res.status, 200);
  assert.equal('googleMapsApiKey' in res.body, false);
});

for (const path of ['/debug', '/debug/clear', '/api/config/maps-key']) {
  test(`GET ${path} is not publicly accessible`, async () => {
    const res = await request(app).get(path);
    assert.ok([401, 403, 503].includes(res.status), `expected auth rejection, got ${res.status}`);
  });
}

test('POST /debug/client rejects unauthenticated writes', async () => {
  const res = await request(app).post('/debug/client').send({ scope: 'x', message: 'y' });
  assert.ok([401, 403, 503].includes(res.status), `expected auth rejection, got ${res.status}`);
});

test('POST /api/auth/redeem-code rejects unauthenticated calls', async () => {
  const res = await request(app).post('/api/auth/redeem-code').send({ code: 'nope' });
  assert.ok([401, 403, 503].includes(res.status), `expected auth rejection, got ${res.status}`);
});

test('POST /api/email/inbound fails closed when no webhook secret is configured', async () => {
  const prev = process.env.EMAIL_WEBHOOK_SECRET;
  delete process.env.EMAIL_WEBHOOK_SECRET;
  const res = await request(app).post('/api/email/inbound').send({ to: 'x@y.z' });
  if (prev !== undefined) process.env.EMAIL_WEBHOOK_SECRET = prev;
  assert.equal(res.status, 503);
});
