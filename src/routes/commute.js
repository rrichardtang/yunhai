const {
  getCommuteBetweenActivities,
  getFastestCommuteMinutes,
  haversineKm,
  getActivityCoords
} = require('../services/distanceMatrix');

const MAX_PAIRS_PER_REQUEST = 2000;
const CLUSTER_RADIUS_KM = 2.0;

function clusterByProximity(activities, radiusKm = CLUSTER_RADIUS_KM) {
  const clusters = [];
  for (const act of activities) {
    const coords = getActivityCoords(act);
    if (!coords) {
      clusters.push({ centroidLat: null, centroidLng: null, members: [act] });
      continue;
    }
    const found = clusters.find((c) => (
      Number.isFinite(c.centroidLat)
      && haversineKm(c.centroidLat, c.centroidLng, coords.lat, coords.lng) <= radiusKm
    ));
    if (found) {
      found.members.push(act);
      const n = found.members.length;
      found.centroidLat = (found.centroidLat * (n - 1) + coords.lat) / n;
      found.centroidLng = (found.centroidLng * (n - 1) + coords.lng) / n;
    } else {
      clusters.push({ centroidLat: coords.lat, centroidLng: coords.lng, members: [act] });
    }
  }
  return clusters;
}

function register(app) {
  app.post('/api/commute-matrix', async (req, res) => {
    try {
      const activities = Array.isArray(req.body?.activities) ? req.body.activities : [];
      const matrix = {};
      if (activities.length < 2) return res.json({ matrix });

      const clusters = clusterByProximity(activities);

      const intraPairs = [];
      for (const cluster of clusters) {
        for (let i = 0; i < cluster.members.length; i += 1) {
          for (let j = i + 1; j < cluster.members.length; j += 1) {
            intraPairs.push({ kind: 'intra', from: cluster.members[i], to: cluster.members[j] });
          }
        }
      }

      const interPairs = [];
      for (let i = 0; i < clusters.length; i += 1) {
        for (let j = i + 1; j < clusters.length; j += 1) {
          const aMembers = clusters[i].members;
          const bMembers = clusters[j].members;
          interPairs.push({ kind: 'inter', from: aMembers[0], to: bMembers[0], aMembers, bMembers });
        }
      }

      const allPairs = [...intraPairs, ...interPairs];
      if (allPairs.length > MAX_PAIRS_PER_REQUEST) {
        console.warn(`[commute-matrix] throttled: ${activities.length} activities → ${allPairs.length} pairs (${intraPairs.length} intra + ${interPairs.length} inter) > ${MAX_PAIRS_PER_REQUEST} cap`);
        return res.json({ matrix: {}, throttled: true });
      }

      console.log(`[commute-matrix] ${activities.length} activities → ${clusters.length} clusters → ${intraPairs.length} intra + ${interPairs.length} inter pairs`);

      const setPair = (fromId, toId, minutes) => {
        if (!matrix[fromId]) matrix[fromId] = {};
        if (!matrix[toId]) matrix[toId] = {};
        matrix[fromId][toId] = minutes;
        matrix[toId][fromId] = minutes;
      };

      const CONCURRENCY = 6;
      for (let i = 0; i < allPairs.length; i += CONCURRENCY) {
        const slice = allPairs.slice(i, i + CONCURRENCY);
        const results = await Promise.all(slice.map(async (pair) => {
          const minutes = await getFastestCommuteMinutes(pair.from, pair.to);
          return { pair, minutes };
        }));
        for (const { pair, minutes } of results) {
          if (!Number.isFinite(minutes)) continue;
          if (pair.kind === 'intra') {
            setPair(pair.from.id, pair.to.id, minutes);
          } else {
            for (const a of pair.aMembers) {
              for (const b of pair.bMembers) {
                if (a.id === b.id) continue;
                setPair(a.id, b.id, minutes);
              }
            }
          }
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
          modeIcon: commute.modeIcon,
          isWalkingDistance: commute.isWalkingDistance || false
        });
      }

      return res.json({ commutes });
    } catch {
      return res.json({ commutes: [] });
    }
  });
}

module.exports = { register };
