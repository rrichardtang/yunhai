require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { clerkMiddleware } = require('@clerk/express');
const { requireConfiguredAuth, requireEntitlement } = require('./middleware/auth');
const { readDebugLog, clearDebugLog, debugLog } = require('./services/debugLog');

const app = express();
const PORT = Number(process.env.PORT || 3457);

app.use(express.json({ limit: '1mb' }));

const _clerk = clerkMiddleware();
app.use((req, res, next) => {
  _clerk(req, res, (err) => {
    if (err) {
      debugLog('clerk-middleware', `swallowed err on ${req.method} ${req.path}: ${err?.message || err}`);
      return next();
    }
    return next();
  });
});

function serveWithClerkKey(filename) {
  return (_req, res) => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', filename), 'utf8');
    const key = process.env.CLERK_PUBLISHABLE_KEY || '';
    const fapiDomain = key ? Buffer.from(key.replace(/^pk_(test|live)_/, ''), 'base64').toString().replace(/\$$/, '') : '';
    res.send(html
      .replace('data-clerk-publishable-key=""', `data-clerk-publishable-key="${key}"`)
      .replaceAll('__CLERK_FAPI_DOMAIN__', fapiDomain));
  };
}

app.get('/planner.html', serveWithClerkKey('planner.html'));
app.get('/admin.html', serveWithClerkKey('admin.html'));

app.post('/debug/client', (req, res) => {
  const scope = String(req.body?.scope || 'client').slice(0, 40);
  const message = typeof req.body?.message === 'string'
    ? req.body.message
    : JSON.stringify(req.body?.message ?? (req.body || {}));
  debugLog(scope, message);
  res.json({ ok: true });
});

app.get('/debug', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const log = readDebugLog();
  if (log == null) return res.status(404).type('text/plain').send('No log yet');
  const scope = String(req.query.scope || '').trim();
  const tailRaw = Number(req.query.tail);
  const tail = Number.isInteger(tailRaw) && tailRaw > 0 ? tailRaw : 50;
  let lines = log.split('\n');
  if (scope) lines = lines.filter((l) => l.includes(`[${scope}]`));
  lines = lines.slice(-tail);
  res.type('text/plain').send(lines.join('\n'));
});

app.get('/debug/clear', (_req, res) => {
  res.type('text/plain').send(clearDebugLog() ? 'cleared' : 'failed');
});

const noStoreFor = (res, filePath) => {
  if (/\.(html|js|css)$/.test(filePath)) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
  }
};
app.use(express.static(path.join(__dirname, '..', 'public'), { setHeaders: noStoreFor }));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared'), { setHeaders: noStoreFor }));

require('./routes/status').register(app);
require('./routes/email').register(app);
require('./routes/geocode').register(app);
require('./routes/itinerary').registerPublic(app);
require('./routes/admin').register(app);

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

app.use((err, req, res, _next) => {
  debugLog('express-error', `${req.method} ${req.path}: ${err?.message || err} stack=${(err?.stack || '').split('\n').slice(0, 3).join(' | ')}`);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal', message: err?.message || 'Unknown error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TravelPlanner listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
