# Current State

_Last updated: 2026-05-28_

## Objective
Ship a modular agent-memory layer (A-MEM / Mem0-inspired) that all four LLM touchpoints
(activity generation, activity refine/replace, TianHe chat, arrange) share, with both
long-term (user) and per-trip working memory, while staying on flat-JSON (no DB).

## Active Workstream
Branch `claude/website-memory-architecture-3BI4W`. `src/memory/` module shipped:
`recall()` (sync, no-LLM, relevance-ranked retrieval merging user + trip scope) and
`observe()` (detached LLM-driven ADD/UPDATE/DELETE reconciliation via Haiku, gated by the
global semaphore), backed by a swappable `MemoryStore` (`store.js`, flat-JSON at
`/data/memory/{userId}.json`). `preferences.js` is now a thin facade preserving its old API +
diff-based sync + legacy migration. Wired into all five read sites and three write sites.
Follow-up shipped: `tripId` plumbed through every touchpoint (frontend POST bodies + chat/plan
routes), standardized on the itinerary id as the canonical per-trip key — per-trip memory is now
coherent across chat/arrange/refine/replace/plan. 113/113 tests pass; server boots clean.

## Constraints
- Stay flat-JSON / no-DB. The `MemoryStore` interface is the single swap point for a future
  Postgres + pgvector backend.
- `recall()` is on the hot path of every LLM call → must stay synchronous and make zero LLM
  calls. `observe()` is detached so reconciliation latency never blocks user responses.
- Retrieval is heuristic (salience + recency + lexical overlap); embeddings are deferred
  behind the pluggable `score()` signature.
- Approve/decline is intentionally NOT a write pathway (honors the 2026-04-16 decision).
- `tripId` is optional everywhere (null ⇒ user-scoped only); canonical key is the itinerary id
  (`state.currentItineraryId`). The frontend now sends it on all relevant POST bodies.

## Risks
- Arrange feedback ingestion is gated on a free-text scheduling note to avoid a Haiku call on
  every draft click; structured prefs only ride along when a note is present. If users rarely
  type notes, arrange-derived learning will be thin.
- Live end-to-end (chat → memory write → reflected in a later plan; contradiction reconcile)
  is UNVERIFIED in this container — no API keys present. Needs a keyed environment.
- (Carried over) Google OAuth client secret should be rotated; `client_secret_*.json` should
  be gitignored.

## Next Actions
- Verify end-to-end in a keyed environment: state a preference in chat → confirm a record is
  written and appears in a later plan/arrange prompt; state a contradicting preference →
  confirm reconciler UPDATEs/DELETEs instead of appending a duplicate; decline with a note →
  replacement reflects memory; refine now reflects memory. Also confirm a trip-only statement is
  tagged trip-scoped to the itinerary id and surfaces in arrange for that trip but not another.
- Commit + push branch `claude/website-memory-architecture-3BI4W`.
