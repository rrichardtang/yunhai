const { requireConfiguredAuth, getAuthedUserId, parseUserId } = require('../middleware/auth');
const { getOrCreateForwardingAddress } = require('../emailForwarding');
const { isEntitled, redeemCode } = require('../entitlements');

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
      },
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
  });

  app.get('/api/auth/session', requireConfiguredAuth, (req, res) => {
    const userId = getAuthedUserId(req);
    const userEmail = String(req?.auth?.sessionClaims?.email || req?.auth?.sessionClaims?.email_address || '').trim();
    const forwardingAddress = getOrCreateForwardingAddress(userId, userEmail);

    return res.json({
      userId,
      forwardingAddress,
      forwardingEnabled: Boolean(forwardingAddress)
    });
  });

  app.get('/api/auth/entitlement', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    res.json({ entitled: isEntitled(userId) });
  });

  app.post('/api/auth/redeem-code', (req, res) => {
    const userId = parseUserId(getAuthedUserId(req));
    const result = redeemCode(req.body?.code, userId);
    res.json(result);
  });
}

module.exports = { register };
