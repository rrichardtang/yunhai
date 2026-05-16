const {
  getCommuteBetweenActivities,
  getFastestCommuteWithSource,
  haversineKm,
  getActivityCoords
} = require('../services/distanceMatrix');
const { debugLog } = require('../services/debugLog');

const MAX_PAIRS_PER_REQUEST = 2000;
const CLUSTER_RADIUS_KM = 3.0;

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
      const withCoords = activities.filter((a) => getActivityCoords(a)).length;
      debugLog('commute-matrix', `START activities=${activities.length} with_coords=${withCoords} api_key_set=${!!process.env.GOOGLE_MAPS_API_KEY}`);
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
        debugLog('commute-matrix', `THROTTLED activities=${activities.length} pairs=${allPairs.length} intra=${intraPairs.length} inter=${interPairs.length} cap=${MAX_PAIRS_PER_REQUEST}`);
        return res.json({ matrix: {}, throttled: true });
      }

      debugLog('commute-matrix', `PAIRS activities=${activities.length} clusters=${clusters.length} intra=${intraPairs.length} inter=${interPairs.length}`);
      const tStart = Date.now();

      const setPair = (fromId, toId, minutes) => {
        if (!matrix[fromId]) matrix[fromId] = {};
        if (!matrix[toId]) matrix[toId] = {};
        matrix[fromId][toId] = minutes;
        matrix[toId][fromId] = minutes;
      };

      const sourceCounts = { 'cache-hit': 0, 'cache-neg': 0, 'live-ok': 0, 'live-fail': 0, 'walking-skip': 0, 'no-query': 0, 'no-key': 0 };

      const CONCURRENCY = 6;
      for (let i = 0; i < allPairs.length; i += CONCURRENCY) {
        const slice = allPairs.slice(i, i + CONCURRENCY);
        const results = await Promise.all(slice.map(async (pair) => {
          const { minutes, sources } = await getFastestCommuteWithSource(pair.from, pair.to);
          return { pair, minutes, sources };
        }));
        for (const { pair, minutes, sources } of results) {
          for (const s of sources) {
            if (sourceCounts[s] !== undefined) sourceCounts[s] += 1;
          }
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

      const populated = Object.values(matrix).reduce((s, row) => s + Object.keys(row).length, 0);
      const totalApiAttempts = sourceCounts['cache-hit'] + sourceCounts['cache-neg'] + sourceCounts['live-ok'] + sourceCounts['live-fail'];
      debugLog('commute-matrix', `CACHE hits=${sourceCounts['cache-hit']} neg_hits=${sourceCounts['cache-neg']} live_ok=${sourceCounts['live-ok']} live_fail=${sourceCounts['live-fail']} walking_skip=${sourceCounts['walking-skip']} (total_api=${totalApiAttempts})`);
      debugLog('commute-matrix', `RETURN populated_pairs=${populated} elapsed_ms=${Date.now() - tStart}`);
      return res.json({ matrix });
    } catch (err) {
      debugLog('commute-matrix', `ERROR msg="${err?.message || err}"`);
      return res.json({ matrix: {} });
    }
  });

  app.post('/api/commute', async (req, res) => {
    const tStart = Date.now();
    try {
      const activities = Array.isArray(req.body?.activities) ? req.body.activities : [];
      debugLog('commute', `START activities=${activities.length}`);
      if (activities.length < 2) {
        debugLog('commute', `RETURN commutes=0 elapsed_ms=${Date.now() - tStart}`);
        return res.json({ commutes: [] });
      }

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

      debugLog('commute', `RETURN commutes=${commutes.length} elapsed_ms=${Date.now() - tStart}`);
      return res.json({ commutes });
    } catch (err) {
      debugLog('commute', `ERROR msg="${err?.message || err}" elapsed_ms=${Date.now() - tStart}`);
      return res.json({ commutes: [] });
    }
  });
}

module.exports = { register };
