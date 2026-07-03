const { requireConfiguredAuth, getAuthedUserId, parseUserId } = require('../middleware/auth');
const { getOrCreateForwardingAddress } = require('../emailForwarding');
const { isEntitled, redeemCode } = require('../entitlements');
const { debugLog } = require('../services/debugLog');

function register(app) {
  app.get('/api/status', (_req, res) => {
    res.json({
      ok: true,
      keys: {
        anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        unsplashConfigured: Boolean(process.env.UNSPLASH_ACCESS_KEY),
        googleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
        clerkConfigured: Boolean(process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY),
        resendConfigured: Boolean(process.env.RESEND_API_KEY)
      }
    });
  });

  app.get('/api/config/maps-key', requireConfiguredAuth, (_req, res) => {
    res.json({ googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '' });
  });

  app.get('/api/auth/session', requireConfiguredAuth, (req, res) => {
    const userId = getAuthedUserId(req);
    const claims = req.auth?.().sessionClaims || {};
    const userEmail = String(claims.email || claims.email_address || '').trim();
    const forwardingAddress = getOrCreateForwardingAddress(userId, userEmail);

    return res.json({
      userId,
      forwardingAddress,
      forwardingEnabled: Boolean(forwardingAddress)
    });
  });

  app.get('/api/auth/entitlement', requireConfiguredAuth, (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    const entitled = userId ? isEntitled(userId) : false;
    debugLog('entitlement-check', `userId=${userId} entitled=${entitled}`);
    res.json({ entitled, userId });
  });

  app.post('/api/auth/redeem-code', requireConfiguredAuth, (req, res) => {
    const rawCode = req.body?.code;
    const userId = parseUserId(getAuthedUserId(req));
    if (!userId) {
      debugLog('redeem-code', `denied no-userId codeLen=${String(rawCode || '').length}`);
      return res.json({ ok: false, reason: 'invalid' });
    }
    const result = redeemCode(rawCode, userId);
    debugLog('redeem-code', `userId=${userId} codeLen=${String(rawCode || '').length} result=${JSON.stringify(result)}`);
    res.json(result);
  });
}

module.exports = { register };
