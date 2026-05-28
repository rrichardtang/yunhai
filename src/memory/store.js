const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', '..', 'data', 'memory');
const MAX_PREFERENCES = 30;
const MAX_CONSTRAINTS = 20;
const VALID_SOURCES = new Set(['chat', 'decline', 'arrange', 'profile', 'manual']);

function ensureDir() {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function filePath(resolvedUserId) {
  return path.join(MEMORY_DIR, `${resolvedUserId}.json`);
}

function clampSalience(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function makeRecord(input = {}) {
  const now = Math.floor(Date.now() / 1000);
  const text = String(input.text || '').trim();
  if (!text) return null;
  const scope = input.scope === 'trip' ? 'trip' : 'user';
  return {
    id: input.id || `mem_${now}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    type: input.type === 'constraint' ? 'constraint' : 'preference',
    scope,
    tripId: scope === 'trip' ? (input.tripId || null) : null,
    keywords: Array.isArray(input.keywords) ? input.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12) : [],
    salience: clampSalience(input.salience),
    source: VALID_SOURCES.has(input.source) ? input.source : 'manual',
    createdTs: Number(input.createdTs) || now,
    updatedTs: now,
    supersedes: Array.isArray(input.supersedes) ? input.supersedes.map(String) : []
  };
}

function coerce(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rec = makeRecord(raw);
  if (!rec) return null;
  // makeRecord stamps updatedTs=now; preserve the stored timestamps on load.
  rec.updatedTs = Number(raw.updatedTs) || rec.createdTs;
  return rec;
}

function exists(resolvedUserId) {
  return fs.existsSync(filePath(resolvedUserId));
}

function loadAll(resolvedUserId) {
  ensureDir();
  const p = filePath(resolvedUserId);
  if (!fs.existsSync(p)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(parsed?.records) ? parsed.records.map(coerce).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveAll(resolvedUserId, records) {
  ensureDir();
  const p = filePath(resolvedUserId);
  const tmp = `${p}.tmp`;
  const clean = (Array.isArray(records) ? records : []).map(coerce).filter(Boolean);
  fs.writeFileSync(tmp, JSON.stringify({ records: clean }, null, 2));
  fs.renameSync(tmp, p);
  return clean;
}

function add(resolvedUserId, input) {
  const rec = makeRecord(input);
  if (!rec) return null;
  const records = loadAll(resolvedUserId);
  records.push(rec);
  saveAll(resolvedUserId, records);
  return rec;
}

function update(resolvedUserId, id, patch = {}) {
  const records = loadAll(resolvedUserId);
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const merged = makeRecord({ ...records[idx], ...patch, id, createdTs: records[idx].createdTs });
  if (!merged) return null;
  records[idx] = merged;
  saveAll(resolvedUserId, records);
  return merged;
}

function remove(resolvedUserId, id) {
  const records = loadAll(resolvedUserId);
  const next = records.filter((r) => r.id !== id);
  if (next.length === records.length) return false;
  saveAll(resolvedUserId, next);
  return true;
}

// Caps apply to the durable, user-visible (user-scoped) layer only. Keeps the
// most recently updated records and drops the stalest beyond the per-type cap.
function trimUserScoped(records) {
  const keep = [];
  const userPrefs = [];
  const userCons = [];
  for (const r of records) {
    if (r.scope !== 'user') { keep.push(r); continue; }
    if (r.type === 'constraint') userCons.push(r);
    else userPrefs.push(r);
  }
  const byRecent = (a, b) => (b.updatedTs || 0) - (a.updatedTs || 0);
  userPrefs.sort(byRecent);
  userCons.sort(byRecent);
  return keep
    .concat(userPrefs.slice(0, MAX_PREFERENCES))
    .concat(userCons.slice(0, MAX_CONSTRAINTS));
}

function formatRecords(records) {
  const prefs = records.filter((r) => r.type === 'preference');
  const cons = records.filter((r) => r.type === 'constraint');
  const parts = [];
  if (prefs.length) parts.push(`Learned preferences:\n${prefs.map((r) => `- ${r.text}`).join('\n')}`);
  if (cons.length) parts.push(`Constraints:\n${cons.map((r) => `- ${r.text}`).join('\n')}`);
  return parts.join('\n\n');
}

module.exports = {
  MEMORY_DIR,
  MAX_PREFERENCES,
  MAX_CONSTRAINTS,
  makeRecord,
  exists,
  loadAll,
  saveAll,
  add,
  update,
  remove,
  trimUserScoped,
  formatRecords
};
