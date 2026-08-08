require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { clerkMiddleware } = require('@clerk/express');
const { requireConfiguredAuth, requireEntitlement, requireOwner } = require('./middleware/auth');
const { readDebugLog, clearDebugLog, debugLog } = require('./services/debugLog');

const app = express();
const PORT = Number(process.env.PORT || 3457);

app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

const AUTHORIZED_PARTIES = (process.env.CLERK_AUTHORIZED_PARTIES || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const _clerk = clerkMiddleware(
  AUTHORIZED_PARTIES.length ? { authorizedParties: AUTHORIZED_PARTIES } : {}
);
app.use((req, res, next) => {
  _clerk(req, res, (err) => {
    if (err) {
      debugLog('clerk-middleware', `err on ${req.method} ${req.path}: ${err?.message || err}`);
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

const STEP_SLUGS = ['setup', 'review', 'arrange', 'finalize'];
const servePlanner = serveWithClerkKey('planner.html');

app.get('/plan', servePlanner);
app.get('/plan/:step', (req, res, next) => (
  STEP_SLUGS.includes(req.params.step) ? servePlanner(req, res, next) : res.redirect(302, '/plan')
));
app.get('/trip/:id', servePlanner);
app.get('/admin', serveWithClerkKey('admin.html'));

const queryOf = (req) => req.url.slice(req.path.length);
app.get('/planner.html', (req, res) => res.redirect(301, `/plan${queryOf(req)}`));
app.get('/admin.html', (req, res) => res.redirect(301, `/admin${queryOf(req)}`));
app.get('/index.html', (req, res) => res.redirect(301, `/${queryOf(req)}`));

app.post('/debug/client', requireConfiguredAuth, (req, res) => {
  const scope = String(req.body?.scope || 'client').slice(0, 40);
  const message = typeof req.body?.message === 'string'
    ? req.body.message
    : JSON.stringify(req.body?.message ?? (req.body || {}));
  debugLog(scope, message);
  res.json({ ok: true });
});

app.get('/debug', requireConfiguredAuth, requireOwner, (req, res) => {
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

app.get('/debug/clear', requireConfiguredAuth, requireOwner, (_req, res) => {
  res.type('text/plain').send(clearDebugLog() ? 'cleared' : 'failed');
});

// Results of scripts/planCityBakeoff.js, which runs wherever the API keys are.
// Owner-gated text, same as the debug log — not a UI, and nothing links to it.
app.get('/debug/bakeoff', requireConfiguredAuth, requireOwner, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const dir = path.join(__dirname, '..', 'data', 'bakeoff');

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return res.status(404).type('text/plain').send('No bake-off run yet — run: node scripts/planCityBakeoff.js');
  }

  // Match against the real directory listing rather than joining the query onto
  // a path, so a traversal attempt simply finds no entry.
  // "+" in a query string decodes to a space, so an arm label like `gpt-5.6+lean`
  // arrives here already mangled. Match the decoded form and the raw one.
  const requested = String(req.query.file || '').trim();
  const forms = [requested, requested.replace(/ /g, '+')];
  if (requested) {
    const match = entries.find((entry) => forms.some((form) => entry === form || entry === `${form}.json`));
    if (!match) return res.status(404).type('text/plain').send('Unknown file');
    return res
      .type(match.endsWith('.json') ? 'application/json' : 'text/plain')
      .send(fs.readFileSync(path.join(dir, match), 'utf8'));
  }

  const report = entries.includes('report.md')
    ? fs.readFileSync(path.join(dir, 'report.md'), 'utf8')
    : 'No report.md yet — the run may not have finished.';
  const activityLists = entries
    .filter((entry) => entry.endsWith('.json') && !['results.json', 'brave-cassette.json'].includes(entry))
    .sort()
    .map((entry) => `  /debug/bakeoff?file=${encodeURIComponent(entry)}`);

  const blindRead = entries.includes('blind-read.md')
    ? 'Blind read:  /debug/bakeoff?file=blind-read.md'
    : 'Blind read:  not generated yet — run `node scripts/blindRead.js`';

  res.type('text/plain').send([
    report,
    'Raw rows:  /debug/bakeoff?file=results.json',
    blindRead,
    '',
    `Underlying activity lists (${activityLists.length}):`,
    ...activityLists
  ].join('\n'));
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
