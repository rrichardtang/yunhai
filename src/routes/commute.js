const { getCommuteBetweenActivities } = require('../services/distanceMatrix');

function register(app) {
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
