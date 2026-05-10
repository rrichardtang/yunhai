const { getCommuteBetweenActivities, getFastestCommuteMinutes } = require('../services/distanceMatrix');

const MAX_PAIRS_PER_REQUEST = 2000;

function register(app) {
  app.post('/api/commute-matrix', async (req, res) => {
    try {
      const activities = Array.isArray(req.body?.activities) ? req.body.activities : [];
      const matrix = {};
      if (activities.length < 2) return res.json({ matrix });

      const totalPairs = (activities.length * (activities.length - 1)) / 2;
      if (totalPairs > MAX_PAIRS_PER_REQUEST) {
        console.warn(`[commute-matrix] throttled: ${activities.length} activities → ${totalPairs} pairs > ${MAX_PAIRS_PER_REQUEST} cap`);
        return res.json({ matrix: {}, throttled: true });
      }

      const pairs = [];
      for (let i = 0; i < activities.length; i += 1) {
        for (let j = i + 1; j < activities.length; j += 1) {
          pairs.push([activities[i], activities[j]]);
        }
      }

      const CONCURRENCY = 6;
      for (let i = 0; i < pairs.length; i += CONCURRENCY) {
        const slice = pairs.slice(i, i + CONCURRENCY);
        const results = await Promise.all(slice.map(async ([from, to]) => {
          const minutes = await getFastestCommuteMinutes(from, to);
          return { fromId: from.id, toId: to.id, minutes };
        }));
        for (const r of results) {
          if (!Number.isFinite(r.minutes)) continue;
          if (!matrix[r.fromId]) matrix[r.fromId] = {};
          if (!matrix[r.toId]) matrix[r.toId] = {};
          matrix[r.fromId][r.toId] = r.minutes;
          matrix[r.toId][r.fromId] = r.minutes;
        }
      }

      return res.json({ matrix });
    } catch {
      return res.json({ matrix: {} });
    }
  });

  app.post('/api/commute', async (req, res) => {
    try {
      const activities = Array.isArray(req.body?.activities) ? req.body.activities : [];
      if (activities.length < 2) return res.json({ commutes: [] });

      const commutes = [];
      for (let i = 0; i < activities.length - 1; i += 1) {
        const fromActivity = activities[i];
        const toActivity = activities[i + 1];
        const commute = await getCommuteBetweenActivities(fromActivity, toActivity);

        commutes.push({
          fromId: fromActivity.id,
          toId: toActivity.id,
          modes: commute.modes,
          selectedMode: commute.selectedMode,
          durationMinutes: commute.durationMinutes,
          modeIcon: commute.modeIcon
        });
      }

      return res.json({ commutes });
    } catch {
      return res.json({ commutes: [] });
    }
  });
}

module.exports = { register };
