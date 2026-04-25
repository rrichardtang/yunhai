const { getAuthedUserId, parseUserId } = require('../middleware/auth');
const { getItineraryById } = require('../itineraryStore');
const {
  buildCalendarItems,
  computeFingerprint,
  getGoogleOAuthConfig,
  isGoogleConfigured,
  getUserGoogleToken,
  setUserGoogleToken,
  callGoogleCalendarApi,
  detectConflicts,
  getSyncRecord,
  setSyncRecord
} = require('../calendarSync');
const { buildItineraryIcs } = require('../services/calendarIcs');

function register(app) {
  app.get('/api/calendar/google/auth-url', (req, res) => {
    if (!isGoogleConfigured()) {
      return res.status(503).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
    }

    const userId = parseUserId(getAuthedUserId(req));
    const { clientId, redirectUri } = getGoogleOAuthConfig();
    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      state
    });
    return res.json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  });

  app.get('/api/calendar/google/status', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    const token = getUserGoogleToken(userId);
    return res.json({ connected: Boolean(token?.accessToken) });
  });

  app.get('/api/calendar/google/oauth/callback', async (req, res) => {
    try {
      const code = String(req.query.code || '').trim();
      const stateRaw = String(req.query.state || '').trim();
      if (!code || !stateRaw) return res.status(400).send('Missing code/state');
      if (!isGoogleConfigured()) return res.status(503).send('Google OAuth not configured');

      const parsedState = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
      const userId = String(parsedState?.userId || '').trim();
      if (!userId) return res.status(400).send('Invalid OAuth state');

      const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) return res.status(500).send(`OAuth exchange failed: ${tokenJson?.error || 'unknown error'}`);

      setUserGoogleToken(userId, {
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token || '',
        tokenType: tokenJson.token_type || 'Bearer',
        expiryDate: Date.now() + (Number(tokenJson.expires_in || 0) * 1000)
      });

      return res.send('Google Calendar connected. You can close this tab and return to TravelPlanner.');
    } catch (error) {
      return res.status(500).send(`OAuth callback failed: ${error.message || 'unknown error'}`);
    }
  });

  app.post('/api/itinerary/:id/calendar/google/precheck', async (req, res) => {
    try {
      const userId = parseUserId(getAuthedUserId(req));
      const itinerary = getItineraryById(req.params.id, userId);
      if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

      const token = getUserGoogleToken(userId);
      if (!token?.accessToken) return res.status(401).json({ error: 'Google Calendar not connected' });

      const metadataMode = String(req.body?.metadataMode || 'compact').toLowerCase() === 'full' ? 'full' : 'compact';
      const items = buildCalendarItems(itinerary, { metadataMode });
      const conflicts = await detectConflicts({ accessToken: token.accessToken, calendarId: 'primary', items });
      return res.json({ ok: true, conflictCount: conflicts.length, conflicts });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || 'Conflict check failed' });
    }
  });

  app.post('/api/itinerary/:id/calendar/google/sync', async (req, res) => {
    try {
      const userId = parseUserId(getAuthedUserId(req));
      const itinerary = getItineraryById(req.params.id, userId);
      if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

      const token = getUserGoogleToken(userId);
      if (!token?.accessToken) return res.status(401).json({ error: 'Google Calendar not connected' });

      const metadataMode = String(req.body?.metadataMode || 'compact').toLowerCase() === 'full' ? 'full' : 'compact';
      const items = buildCalendarItems(itinerary, { metadataMode });

      let created = 0;
      let updated = 0;
      for (const item of items) {
        const fingerprint = computeFingerprint(item);
        const syncRecord = getSyncRecord(userId, itinerary.id, fingerprint);
        const payload = {
          summary: item.title,
          location: item.location || undefined,
          description: item.description || undefined,
          start: { dateTime: item.start.toISOString() },
          end: { dateTime: item.end.toISOString() }
        };

        if (syncRecord?.eventId) {
          await callGoogleCalendarApi({
            accessToken: token.accessToken,
            method: 'PATCH',
            path: `/calendars/primary/events/${encodeURIComponent(syncRecord.eventId)}`,
            body: payload
          });
          updated += 1;
        } else {
          const createdEvent = await callGoogleCalendarApi({
            accessToken: token.accessToken,
            method: 'POST',
            path: '/calendars/primary/events',
            body: payload
          });
          if (createdEvent?.id) setSyncRecord(userId, itinerary.id, fingerprint, createdEvent.id);
          created += 1;
        }
      }

      return res.json({ ok: true, total: items.length, created, updated, metadataMode });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || 'Google Calendar sync failed' });
    }
  });

  app.get('/api/itinerary/:id/calendar.ics', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    const itinerary = getItineraryById(req.params.id, userId);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

    const metadataMode = String(req.query.metadata || 'compact').toLowerCase() === 'full' ? 'full' : 'compact';
    const ics = buildItineraryIcs(itinerary, { metadataMode });
    const safeName = String(itinerary.tripName || 'itinerary').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').toLowerCase();
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName || 'itinerary'}.ics"`);
    return res.send(ics);
  });
}

module.exports = { register };
