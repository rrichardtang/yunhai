const { requireAuth } = require('@clerk/express');
const { resolveUserId } = require('../preferences');

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

module.exports = { requireConfiguredAuth, getAuthedUserId, parseUserId };
