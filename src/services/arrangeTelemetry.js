const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_PATH = path.join(LOG_DIR, 'arrange.jsonl');

function logRun(entry) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    // best-effort
  }
}

async function readRecent(limit = 100) {
  if (!fs.existsSync(LOG_PATH)) return [];
  const lines = [];
  const stream = fs.createReadStream(LOG_PATH);
  const rl = readline.createInterface({ input: stream });
  for await (const line of rl) {
    if (line.trim()) lines.push(line);
  }
  const tail = lines.slice(-limit);
  return tail.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function summarize(runs) {
  const total = runs.length;
  if (!total) return { total: 0 };
  let errors = 0;
  let totalFlexible = 0;
  let totalPlaced = 0;
  let totalUnplaced = 0;
  let redistributed = 0;
  let diagnosticsFired = 0;
  const droppedByReason = {};
  for (const r of runs) {
    if (r.error) { errors += 1; continue; }
    totalFlexible += r.flexibleCount || 0;
    totalPlaced += r.placedCount || 0;
    totalUnplaced += r.unplacedCount || 0;
    redistributed += r.mealRedistributed || 0;
    if (r.diagnosticsCount) diagnosticsFired += 1;
    for (const [reason, n] of Object.entries(r.droppedByReason || {})) {
      droppedByReason[reason] = (droppedByReason[reason] || 0) + n;
    }
  }
  const scheduled = total - errors;
  return {
    total,
    errors,
    placedPct: totalFlexible ? Math.round((totalPlaced / totalFlexible) * 100) : null,
    avgUnplacedPerRun: scheduled ? Number((totalUnplaced / scheduled).toFixed(2)) : 0,
    mealRedistributedTotal: redistributed,
    diagnosticsFiredRuns: diagnosticsFired,
    droppedByReason
  };
}

module.exports = { logRun, readRecent, summarize };
