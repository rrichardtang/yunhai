# ROADMAP

## Now
- Shipping **Map-first Step 2 review UX**:
  - Quizlet-style card flip animation on activity cards.
  - Back-face mini-map per activity using Leaflet + OpenStreetMap.
  - Full-screen itinerary map overlay with all activities pinned.
  - Selected activity highlighted with a star marker and pin-to-card cross-reference.
- Shipping the **Robust Calendar & Sync Mode MVP** for low-noise calendar export.
- Active build focus:
  - Metadata toggle support (compact/full) in calendar export flow.
  - ICS export metadata mode via `?metadata=compact|full`.
  - Google Calendar one-way sync with OAuth endpoints and token persistence.
  - Pre-sync conflict detection against existing Google events.
  - Dedupe-safe sync mapping to prevent duplicate event creation per itinerary item fingerprint.

## Next
- Add refresh-token flow and graceful retry handling for expired Google access tokens.
- Add selective sync scope controls (city/date filters).
- Add per-item conflict resolution UI in sync flow.
- Add tests for calendar item fingerprint stability and sync dedupe behavior.

## Scalability

- **Current:** Global semaphore caps total in-flight Anthropic calls at 10 across all users. Per-request concurrency of 3 cities in parallel. Sufficient for ~20–50 concurrent users.
- **Later (100+ users):** Replace semaphore with a **job queue** (BullMQ + Redis). Requests enqueue a job per city; workers pull at a controlled rate; results stream back via polling or WebSockets. Decouples HTTP request handling from LLM throughput entirely and survives server restarts. Enables per-user queue priority and observable backlog metrics.

## Hosting & Infrastructure
- **Current:** Self-hosted VPS with Docker + Traefik, env vars via `.env` file.
- **Next:** Migrate to Railway — deploys from GitHub, env vars in dashboard, persistent volume at `/app/data`, no PM2 needed. ~$5/mo. Render is fallback (free tier but spins down).
- **Later:** Replace flat-file `data/` storage with a real DB. Options in order of effort:
  1. **Turso** — SQLite over the network, closest to current flat JSON semantics, minimal code change. Fine if the goal is only single-user durability/scaling.
  2. **Supabase** — Postgres with dashboard, more powerful, slightly more setup. **Preferred if collaboration is on the table** — Postgres gives row-level transactions for concurrent multi-user edits, plus `pgvector` (memory embeddings) and Realtime (presence) in one stack. See **Collaboration & Persistence Migration** for the phased plan.
- **Eventually:** Custom domain behind Cloudflare (free SSL, CDN, DDoS protection). Move Google Calendar token storage into DB.

## Auth
- **Current:** Clerk (`@clerk/express`) with Google social sign-in via shared Clerk OAuth credentials.
- **Later:** Switch to custom Google OAuth credentials in Clerk dashboard for production (create OAuth 2.0 Client ID in Google Cloud Console, set redirect URI to Clerk's callback URL).
- Add token refresh flow for Google Calendar OAuth (expired tokens currently require full reconnect).

## Calendar Sync
- **Current:** One-way sync, conflict pre-check (warns, doesn't block), dedupe-safe fingerprinting.
- **Planned:** Token auto-refresh, selective sync by city/date, per-item conflict resolution UI.

## Collaboration & Persistence Migration

**Goal:** let multiple users co-edit one itinerary (owner/editor/viewer). This forces a move off flat files — `itineraryStore.js` rewrites all of `data/itineraries.json` on every save with last-write-wins, so concurrent edits clobber each other. Collaboration is a **concurrency-control** problem, so the fix is a transactional DB, not a graph DB. Target: **Postgres** (Supabase) + `pgvector`; optional CRDT layer for live editing. Reserve graph databases for future relationship/recommendation features, which are a separate axis.

### Phase 0 — Storage abstraction (cheap, do first, no behavior change)
Put repository interfaces in front of every flat-file store so a DB impl can drop in, exactly as `src/memory/store.js` already does. Wrap `src/itineraryStore.js` and `src/userDataStore.js` behind interfaces; `preferences.js` (facade), `memory/store.js`, and `attachmentStore.js` are already swappable. Pure prep — worth doing even if the DB comes later.

### Phase 1 — Postgres + schema, single-user parity (no collaboration yet)
Provision Postgres; migrate data 1:1 behind the Phase 0 interfaces so app behavior is identical. Staged schema to de-risk:
- `users(id text pk /* Clerk userId */, …)`
- `itineraries(id, owner_id fk users, name, generated_at, updated_at, version int, booking_checklist jsonb, document jsonb)` — start with the nested tree in a `document` jsonb for fast parity.
- `bookings(id, itinerary_id fk, …)` — already a flat list in the blob today.
- `memory(id, user_id, type, scope, trip_id fk itineraries, keywords, salience, source, created_ts, updated_ts, embedding vector(1536) null)` — replaces `data/memory/`; `trip_id` FK enables shared trip memory and unlocks embedding retrieval via `pgvector`.
- `google_tokens`, `email_routing` tables (currently `data/*.json`).

One-time idempotent migration script reads the JSON files and inserts rows. Cut over with shadow-read/dual-write to verify before deleting the flat files.

### Phase 2 — Collaboration data model
- `itinerary_members(itinerary_id, user_id, role enum[owner|editor|viewer], invited_by, created_at)`; owner auto-inserted.
- **Authorization shift:** itinerary access checks *membership*, not `owner_id == userId`. Update the userId-scoped queries in `itineraryStore.js` and the guards in `src/routes/itinerary.js` to join `itinerary_members`.
- Invite flow: email/link invite → accept → insert membership. Read-only **public share link** = a viewer token (extends the existing share-link feature; addresses the prior "public link security" hold).
- **Memory under collaboration (clean payoff of the shipped `tripId` standardization):** trip-scoped memory (keyed by itinerary id) becomes **shared** across members; user-scoped memory stays **private**. `recall()` for a shared trip merges the requester's user-scoped records with the trip's shared trip-scoped records — no key changes needed.

### Phase 3 — Concurrency control
- **v1 (small): optimistic concurrency.** Bump `itineraries.version` (or per-activity version) on write; client sends the version it read; stale writes get `409` → client refetches/merges. Enough for "a couple people editing." Requires normalizing activities/placements into rows (below) for fine-grained, non-conflicting edits — a single `document` jsonb still has whole-row write contention.
- **Normalize hot entities:** promote `activities` and `placements` from the `document` jsonb into `activities(id, itinerary_id, …)` / `placements(activity_id, date, time, locked_by, …)` rows so two people editing different activities never conflict at the DB level.
- **v2 (large): real-time CRDT.** A Yjs/Automerge document per itinerary persisted to Postgres (or Supabase Realtime), websockets for presence + automatic merge — Google-Docs-style simultaneous editing without manual conflict resolution. Replaces `userDataStore.js` last-write-wins sync.

### Phase 4 — Realtime presence (optional polish)
Per-itinerary websocket channel (who's online, section/activity soft-locks, live cursors). Supabase Realtime can supply this without building a socket layer.

### Risks / tradeoffs
- Clerk `userId` is the identity anchor across all tables.
- True concurrent-edit value requires normalized activity/placement rows or CRDT; a jsonb blob alone only buys single-user DB parity.
- Public share-link security and permission scoping (the existing hold reason) land in Phase 2.
- Migration correctness — dual-write/shadow-read during cutover before deleting flat files.
- `pgvector` arrives "for free" with Postgres and unlocks the deferred embedding-based `recall()` upgrade.
- Sequencing: Phase 0 now (cheap insurance); Phases 1–2 are the real migration; Phase 3 v1 is small, v2 is large; Phase 4 optional.

## Later
> **Group & Family Collaboration Suite**
> Multi-user collaboration: editable itineraries, family templates (pacing/kid-friendly POIs), cost-splitting, and read-only public share links that don't require sign-up. Role-based permissions (owner/editor/viewer).
> Concrete migration plan: see **Collaboration & Persistence Migration** above. Hold reasons (conflict resolution, permission scoping, public-link security) are addressed across Phases 2–3; revisit once core product is solid.

> **Shared Knowledge Store (cache layer for Brave search)**
> A flat-JSON cache (`data/knowledge/{city}.json`) that accumulates city activity data across requests. Sits between `planCity()`/chat concierge and Brave — serves cached results when fresh, calls Brave when stale. ~100 lines in `src/knowledgeStore.js`, follows atomic write pattern from `itineraryStore.js`. Freshness TTL (60 days) controls Brave re-calls; prune TTL (180 days) deletes unused files.
> Revisit when: Brave free tier cap (2000/month) is regularly hit, city overlap is common enough that cache hits improve results, or Brave latency (~500ms/call) becomes a UX problem.

> **Other longer-term features**
> - Mobile app — React Native or PWA promotion (service worker already in place)
> - Richer booking ingest — improve heuristic email parser for edge-case confirmation formats
> - Export to PDF — printable trip summary beyond ICS
