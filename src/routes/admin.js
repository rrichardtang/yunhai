const { generateCodes, listCodes, revokeCode } = require('../entitlements');
const { requireConfiguredAuth } = require('../middleware/auth');

function requireOwner(req, res, next) {
  const ownerId = String(process.env.OWNER_USER_ID || '').trim();
  if (!ownerId) return res.status(503).json({ error: 'OWNER_USER_ID not configured' });
  const userId = String(req.auth?.userId || '').trim();
  if (userId !== ownerId) return res.status(403).json({ error: 'not_owner' });
  return next();
}

function register(app) {
  app.get('/api/admin/invites', requireConfiguredAuth, requireOwner, (_req, res) => {
    res.json({ codes: listCodes() });
  });

  app.post('/api/admin/invites', requireConfiguredAuth, requireOwner, (req, res) => {
    const count = parseInt(req.body?.count, 10) || 1;
    const codes = generateCodes(count);
    res.json({ codes });
  });

  app.delete('/api/admin/invites/:code', requireConfiguredAuth, requireOwner, (req, res) => {
    const result = revokeCode(req.params.code);
    res.json(result);
  });
}

module.exports = { register };
