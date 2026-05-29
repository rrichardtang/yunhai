# Current State

_Last updated: 2026-05-29_

## Objective
Ship the modular agent-memory layer (A-MEM / Mem0-inspired) that all four LLM touchpoints
(activity generation, activity refine/replace, TianHe chat, arrange) share, with both
long-term (user) and per-trip working memory, while staying on flat-JSON (no DB). Roll it out
to prod (`yunhai.io`) via staging → promote, on top of the now-landed server-side Clerk auth fix.

## Active Workstream
Branch `claude/website-memory-architecture-3BI4W`, merged up to current `main` (which already
carries the `feature/clerk-server-auth` fixes). `src/memory/` module shipped:
`recall()` (sync, no-LLM, relevance-ranked retrieval merging user + trip scope) and
`observe()` (detached LLM-driven ADD/UPDATE/DELETE reconciliation via Haiku, gated by the
global semaphore), backed by a swappable `MemoryStore` (`store.js`, flat-JSON at
`/data/memory/{userId}.json`). `preferences.js` is now a thin facade preserving its old API +
diff-based sync + legacy migration. Wired into all five read sites and three write sites.
`tripId` is plumbed through every touchpoint (frontend POST bodies + chat/plan routes),
standardized on the itinerary id as the canonical per-trip key. 113/113 tests pass; server boots clean.

Already on `main` (landed via `feature/clerk-server-auth`): fixed server-side Clerk auth
(`req.auth()` is a function, was read as a property → `userId=null`), added `trust proxy` +
`authorizedParties` for verification behind Traefik, and hardened admin routes with real Clerk
verification (`req.auth().userId` vs `OWNER_USER_ID`). Production is `yunhai.io`; access is
distributed via magic invite links managed from `/admin.html` (owner-only).

## Constraints
- Stay flat-JSON / no-DB. The `MemoryStore` interface is the single swap point for a future
  Postgres + pgvector backend.
- `recall()` is on the hot path of every LLM call → must stay synchronous and make zero LLM
  calls. `observe()` is detached so reconciliation latency never blocks user responses.
- Retrieval is heuristic (salience + recency + lexical overlap); embeddings are deferred
  behind the pluggable `score()` signature.
- Approve/decline is intentionally NOT a write pathway (honors the 2026-04-16 decision).
- `tripId` is optional everywhere (null ⇒ user-scoped only); canonical key is the itinerary id
  (`state.currentItineraryId`). The frontend sends it on all relevant POST bodies.
- Staging and prod are separate deployments with split env files: staging reads
  `/docker/travelplanner/.env` (test Clerk instance, `pk_test_`); prod reads
  `/docker/travelplanner/.env.prod` (live instance, `pk_live_`). Same email → different Clerk
  userId per instance, so `OWNER_USER_ID` differs between them.
- `CLERK_AUTHORIZED_PARTIES` must be set per env (staging URL vs `https://yunhai.io`).
- Deploys must go through `deployment/promotion.sh` (`deploy-staging` / `promote`) — file-by-file
  `git checkout` does NOT restart the Node process.
- Node isn't on the VPS PATH — admin is browser-driven, not CLI.

## Risks
- Arrange feedback ingestion is gated on a free-text scheduling note to avoid a Haiku call on
  every draft click; structured prefs only ride along when a note is present. If users rarely
  type notes, arrange-derived learning will be thin.
- Live end-to-end (chat → memory write → reflected in a later plan; contradiction reconcile)
  is UNVERIFIED in this container — no API keys present. Needs a keyed environment.
- `data/invite-codes.json` and `/data/memory/*.json` live on the VPS, not in git. If the data
  dir is wiped, invites and learned memory are lost. Worth backing up.
- `/debug` and `/debug/codes` expose internal logs / the code list. Now Clerk-gated (resolves a
  userId), but worth restricting to owner-only later.
- (Carried over) Google OAuth client secret was briefly exposed; should be rotated.
  `client_secret_*.json` should be `.gitignore`d.

## Next Actions
- `bash deployment/promotion.sh deploy-staging claude/website-memory-architecture-3BI4W`, then
  verify the memory layer end-to-end on staging in a keyed environment: state a preference in
  chat → confirm a record is written and appears in a later plan/arrange prompt; state a
  contradicting preference → confirm reconciler UPDATEs/DELETEs instead of appending a duplicate;
  decline with a note → replacement reflects memory; refine reflects memory. Confirm a trip-only
  statement is tagged trip-scoped to the itinerary id and surfaces in arrange for that trip but
  not another.
- `bash deployment/promotion.sh promote --yes` (ensure both checkouts clean first) → merges to
  `main`, redeploys prod.
- Confirm `CLERK_AUTHORIZED_PARTIES=https://yunhai.io` is set in `.env.prod` (and staging URL in `.env`).
- Rotate Google OAuth secret + `.gitignore` the `client_secret` file (deferred from prior sessions).
