const { generateCodes, listCodes, revokeCode } = require('../entitlements');
const { requireConfiguredAuth, requireOwner } = require('../middleware/auth');
const commuteCache = require('../services/commuteCache');
const arrangeTelemetry = require('../services/arrangeTelemetry');

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

  app.get('/api/admin/arrange-stats', requireConfiguredAuth, requireOwner, async (req, res) => {
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 100));
    const runs = await arrangeTelemetry.readRecent(limit);
    return res.json({ summary: arrangeTelemetry.summarize(runs), runs });
  });

  // Flush the commute cache so the next Arrange re-fetches live. Pass
  // ?negativesOnly=1 to drop only "no route" entries and keep good positives.
  app.post('/api/admin/commute-cache/clear', requireConfiguredAuth, requireOwner, (req, res) => {
    const negativesOnly = req.query.negativesOnly === '1' || req.body?.negativesOnly === true;
    const result = negativesOnly ? commuteCache.clearNegatives() : commuteCache.clear();
    res.json({ ok: true, ...result });
  });
}

module.exports = { register };
