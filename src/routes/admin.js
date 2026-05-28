const { generateCodes, listCodes, revokeCode } = require('../entitlements');
const { debugLog } = require('../services/debugLog');

function requireOwner(req, res, next) {
  const ownerId = String(process.env.OWNER_USER_ID || '').trim();
  if (!ownerId) return res.status(503).json({ error: 'OWNER_USER_ID not configured' });
  const userId = String(req.query?.userId || req.body?.userId || '').trim();
  debugLog('admin', `requireOwner method=${req.method} userId=${userId} matchesOwner=${userId === ownerId}`);
  if (userId !== ownerId) return res.status(403).json({ error: 'not_owner' });
  return next();
}

function register(app) {
  app.get('/api/admin/invites', requireOwner, (_req, res) => {
    res.json({ codes: listCodes() });
  });

  app.post('/api/admin/invites', requireOwner, (req, res) => {
    const count = parseInt(req.body?.count, 10) || 1;
    const codes = generateCodes(count);
    res.json({ codes });
  });

  app.delete('/api/admin/invites/:code', requireOwner, (req, res) => {
    const result = revokeCode(req.params.code);
    res.json(result);
  });
}

module.exports = { register };
