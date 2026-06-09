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
  let firstPassValid = 0;
  let repairUsed = 0;
  let secondPassValid = 0;
  let forceDropped = 0;
  const issueTypes = {};
  for (const r of runs) {
    if (r.firstPassValid) firstPassValid += 1;
    if (r.repairUsed) repairUsed += 1;
    if (r.secondPassValid) secondPassValid += 1;
    if (r.forceDropped) forceDropped += 1;
    for (const issue of r.issues || []) {
      const t = issue.type || 'unknown';
      issueTypes[t] = (issueTypes[t] || 0) + 1;
    }
  }
  return {
    total,
    firstPassValidPct: Math.round((firstPassValid / total) * 100),
    repairUsedPct: Math.round((repairUsed / total) * 100),
    secondPassValidPct: repairUsed ? Math.round((secondPassValid / repairUsed) * 100) : null,
    forceDropPct: Math.round((forceDropped / total) * 100),
    topIssueTypes: Object.entries(issueTypes).sort((a, b) => b[1] - a[1]).slice(0, 10)
  };
}

module.exports = { logRun, readRecent, summarize };
