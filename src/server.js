require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { clerkMiddleware } = require('@clerk/express');
const { requireConfiguredAuth, requireEntitlement } = require('./middleware/auth');

const app = express();
const PORT = Number(process.env.PORT || 3457);

app.use(express.json({ limit: '1mb' }));
app.use(clerkMiddleware());

app.get('/planner.html', (_req, res) => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'planner.html'), 'utf8');
  const key = process.env.CLERK_PUBLISHABLE_KEY || '';
  const fapiDomain = key ? Buffer.from(key.replace(/^pk_(test|live)_/, ''), 'base64').toString().replace(/\$$/, '') : '';
  res.send(html
    .replace('data-clerk-publishable-key=""', `data-clerk-publishable-key="${key}"`)
    .replaceAll('__CLERK_FAPI_DOMAIN__', fapiDomain));
});

const { readDebugLog, clearDebugLog, debugLog } = require('./services/debugLog');

app.post('/debug/client', (req, res) => {
  const scope = String(req.body?.scope || 'client').slice(0, 40);
  const message = typeof req.body?.message === 'string'
    ? req.body.message
    : JSON.stringify(req.body?.message ?? (req.body || {}));
  debugLog(scope, message);
  res.json({ ok: true });
});

app.get('/debug', (req, res) => {
  const log = readDebugLog();
  if (log == null) return res.status(404).type('text/plain').send('No log yet');
  const scope = String(req.query.scope || '').trim();
  const tailRaw = Number(req.query.tail);
  let lines = log.split('\n');
  if (scope) lines = lines.filter((l) => l.includes(`[${scope}]`));
  if (Number.isInteger(tailRaw) && tailRaw > 0) lines = lines.slice(-tailRaw);
  res.type('text/plain').send(lines.join('\n'));
});

app.get('/debug/clear', (_req, res) => {
  res.type('text/plain').send(clearDebugLog() ? 'cleared' : 'failed');
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

require('./routes/status').register(app);
require('./routes/email').register(app);
require('./routes/geocode').register(app);
require('./routes/itinerary').registerPublic(app);

app.use('/api', requireConfiguredAuth);
app.use('/api', requireEntitlement);

require('./routes/attachments').register(app);
require('./routes/activities').register(app);
require('./routes/image').register(app);
require('./routes/commute').register(app);
require('./routes/preferences').register(app);
require('./routes/chat').register(app);
require('./routes/itinerary').register(app);
require('./routes/calendar').register(app);

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TravelPlanner listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
