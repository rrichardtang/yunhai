const { requireAuth } = require('@clerk/express');
const { resolveUserId } = require('../preferences');
const { isEntitled } = require('../entitlements');
const { debugLog } = require('../services/debugLog');

function requireConfiguredAuth(req, res, next) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
    return res.status(503).json({ error: 'Clerk is not configured' });
  }
  return requireAuth()(req, res, next);
}

function getAuthedUserId(req) {
  const auth = typeof req?.auth === 'function' ? req.auth() : null;
  return String(auth?.userId || '').trim() || null;
}

function parseUserId(rawUserId) {
  return resolveUserId(rawUserId);
}

const ENTITLEMENT_BYPASS_PATHS = new Set([
  '/auth/session',
  '/auth/entitlement',
  '/auth/redeem-code'
]);

function requireEntitlement(req, res, next) {
  if (ENTITLEMENT_BYPASS_PATHS.has(req.path)) return next();
  const userId = parseUserId(getAuthedUserId(req));
  if (!isEntitled(userId)) {
    debugLog('entitlement-gate', `denied path=${req.path} userId=${userId}`);
    return res.status(403).json({ error: 'not_entitled' });
  }
  return next();
}

module.exports = { requireConfiguredAuth, requireEntitlement, getAuthedUserId, parseUserId };
