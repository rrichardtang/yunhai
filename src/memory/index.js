const store = require('./store');
const { reconcile } = require('./reconcile');
const { resolveUserId, getProfileInstruction } = require('../preferences');

const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'i', 'me', 'my', 'we', 'at', 'it']);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// Pluggable relevance scorer. Heuristic for now (salience + recency + lexical
// overlap); swappable for embedding cosine behind the same signature without
// touching call sites.
function score(record, queryTokens, nowTs) {
  const ageDays = Math.max(0, (nowTs - (record.updatedTs || record.createdTs || nowTs)) / 86400);
  const recency = Math.exp(-ageDays / 120);
  let overlap = 0;
  if (queryTokens.length) {
    const hay = new Set(tokenize(record.text).concat(record.keywords || []));
    const hits = queryTokens.filter((t) => hay.has(t)).length;
    overlap = hits / queryTokens.length;
  }
  return (record.salience ?? 0.5) + 0.3 * recency + 0.5 * overlap;
}

function relevantRecords(records, tripId) {
  return records.filter((r) => r.scope === 'user' || (tripId && r.tripId === tripId));
}

function recall({ userId, tripId = null, query = '', scope = 'all', limit = 40 } = {}) {
  const resolved = resolveUserId(userId);
  const all = store.loadAll(resolved);
  let pool = scope === 'user' ? all.filter((r) => r.scope === 'user') : relevantRecords(all, tripId);

  const queryTokens = tokenize(query);
  const nowTs = Math.floor(Date.now() / 1000);
  pool = pool
    .map((r) => ({ r, s: score(r, queryTokens, nowTs) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r);

  const profileInstruction = getProfileInstruction(resolved);
  const block = store.formatRecords(pool);
  const text = [profileInstruction, block].filter(Boolean).join('\n\n');
  return { text, records: pool };
}

// Pure transform: apply reconciliation ops to the existing record set and
// return the next set. Kept separate from I/O so it is unit-testable.
function computeRecords(existing, ops, { tripId = null, source = 'manual' } = {}) {
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const op of Array.isArray(ops) ? ops : []) {
    const kind = String(op?.op || '').toUpperCase();
    if (kind === 'NOOP') continue;
    if (kind === 'DELETE' && op.id) {
      byId.delete(op.id);
      continue;
    }
    if (kind === 'UPDATE' && op.id && byId.has(op.id)) {
      const prev = byId.get(op.id);
      byId.set(op.id, store.makeRecord({
        ...prev,
        text: op.text || prev.text,
        type: op.type || prev.type,
        scope: op.scope || prev.scope,
        tripId: (op.scope || prev.scope) === 'trip' ? (tripId || prev.tripId) : null,
        keywords: op.keywords || prev.keywords,
        salience: op.salience != null ? op.salience : prev.salience,
        source
      }));
      continue;
    }
    if (kind === 'ADD' && op.text) {
      const rec = store.makeRecord({
        text: op.text,
        type: op.type,
        scope: op.scope,
        tripId,
        keywords: op.keywords,
        salience: op.salience,
        source
      });
      if (rec) byId.set(rec.id, rec);
    }
  }
  return store.trimUserScoped(Array.from(byId.values()));
}

// Ingest observations into memory with LLM reconciliation. Fire-and-forget at
// call sites: it never throws and never blocks the user response.
async function observe({ userId, tripId = null, source = 'manual', candidates = [] } = {}) {
  try {
    const resolved = resolveUserId(userId);
    const list = (Array.isArray(candidates) ? candidates : [candidates])
      .map((c) => String(c || '').trim())
      .filter(Boolean);
    if (!list.length) return;

    const existing = store.loadAll(resolved);
    const relevant = relevantRecords(existing, tripId);
    const ops = await reconcile({ existing: relevant, candidates: list, source, context: tripId ? `trip ${tripId}` : '' });

    if (ops === null) {
      // Reconciliation unavailable — degrade to plain dedup'd ADDs so we still learn.
      const next = computeRecords(existing, list.map((text) => ({ op: 'ADD', text, scope: 'user' })), { tripId, source });
      store.saveAll(resolved, dedupeByText(next));
      return;
    }
    store.saveAll(resolved, computeRecords(existing, ops, { tripId, source }));
  } catch (err) {
    console.error('[memory] observe failed:', err.message);
  }
}

function dedupeByText(records) {
  const seen = new Set();
  const out = [];
  for (const r of records) {
    const key = `${r.scope}|${r.type}|${r.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

module.exports = { recall, observe, computeRecords, score };
