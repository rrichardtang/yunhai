const { requireAuth } = require('@clerk/express');
const { resolveUserId } = require('../preferences');
const { isEntitled } = require('../entitlements');

function requireConfiguredAuth(req, res, next) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
    return res.status(503).json({ error: 'Clerk is not configured' });
  }
  return requireAuth()(req, res, next);
}

function getAuthedUserId(req) {
  return String(req?.auth?.userId || '').trim() || null;
}

function parseUserId(rawUserId) {
  return resolveUserId(rawUserId);
}

const ENTITLEMENT_BYPASS_PATHS = new Set([
  '/api/auth/session',
  '/api/auth/entitlement',
  '/api/auth/redeem-code'
]);

function requireEntitlement(req, res, next) {
  if (ENTITLEMENT_BYPASS_PATHS.has(req.path)) return next();
  const userId = parseUserId(getAuthedUserId(req));
  if (!isEntitled(userId)) return res.status(403).json({ error: 'not_entitled' });
  return next();
}

module.exports = { requireConfiguredAuth, requireEntitlement, getAuthedUserId, parseUserId };
