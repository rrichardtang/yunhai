require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { clerkMiddleware } = require('@clerk/express');
const { requireConfiguredAuth } = require('./middleware/auth');

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

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

require('./routes/status').register(app);
require('./routes/email').register(app);
require('./routes/geocode').register(app);

app.use('/api', requireConfiguredAuth);

app.get('/api/debug/meal-log', (_req, res) => {
  try {
    const log = fs.readFileSync('/tmp/meal-debug.log', 'utf8');
    res.type('text/plain').send(log);
  } catch (e) {
    res.status(404).type('text/plain').send(`No log yet: ${e.message}`);
  }
});

app.delete('/api/debug/meal-log', (_req, res) => {
  try {
    fs.writeFileSync('/tmp/meal-debug.log', '');
    res.type('text/plain').send('cleared');
  } catch (e) {
    res.status(500).type('text/plain').send(`failed: ${e.message}`);
  }
});

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
