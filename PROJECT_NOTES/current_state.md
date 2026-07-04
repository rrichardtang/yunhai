# Current State

_Last updated: 2026-07-03_

## Objective
Land the codebase clean-sweep (branch `claude/codebase-review-sweep-2z6t4h`) — security
hardening (entitlement bypass, key leak, IDORs, XSS), correctness fixes, and a
duplication/dead-code pass — then complete the ops follow-ups (Maps key rotation, new
required envs) and deploy. The mobile-UI feedback branch and the queued memory-layer /
arrange-redesign verifications remain pending their staging deploys.

## Active Workstream
Branch `claude/codebase-review-sweep-2z6t4h`. Two passes: (1) the security/correctness/dedup
clean sweep (5 commits — authed-by-default identity, fail-closed email webhook, owner-gated
debug/admin, tooltip XSS fix, atomic store writes, fetch timeouts, bounded in-memory stores,
shared `llmJson`/`jsonFileCache`/calendar-time helpers); (2) the mobile de-squish pass
(2026-07-03) — full-width budget meter on its own line, city-card date pill on a dedicated
row (stale `.city-row-main` nth-child rules deleted), scrollable tabs, compact one-row
topbar. 168/168 tests; Playwright-verified 20/20 geometry checks at 390/375/1280px.

## Constraints
- Frontend stays a monolith (`public/app.js`); all `innerHTML` goes through `esc()`, and
  `dataset.*` reads must be re-escaped (values come back entity-decoded).
- Identity is never taken from request body/query — always `getAuthedUserId(req)`.
- Pre-auth API surface is only `/api/status` (booleans) + the email webhook (secret-gated,
  fails closed). Debug/admin surfaces require `OWNER_USER_ID`.
- Staging/prod deploy discipline unchanged: `deployment/promotion.sh` only; split env files.

## Risks
- `GOOGLE_MAPS_API_KEY` was publicly retrievable until this branch deploys — must be
  rotated (open_items 2026-07-03).
- Email ingest is now disabled until `EMAIL_WEBHOOK_SECRET` is set in the deploy envs;
  `ADMIN_TOKEN` is retired in favor of `OWNER_USER_ID`.
- Chat-session ownership is in-memory only; sessions created before a restart lose their
  owner stamp (first toucher claims) — acceptable for now, worth revisiting if sessions persist.
- (Carried over) Keyed-environment verification of grounding fixes, memory layer, and the
  arrange overhaul still outstanding; Google OAuth client secret rotation still deferred.

## Next Actions
- Rotate the Maps key + set `EMAIL_WEBHOOK_SECRET`/`OWNER_USER_ID` in env files (owner/ops).
- Deploy `claude/codebase-review-sweep-2z6t4h` via staging → verify sign-in, invite redeem,
  Places autocomplete (new `/api/config/maps-key` path), chat, arrange, admin stats → promote.
- Then resume the queued items: mobile-UI branch keyed verification, memory-layer staging
  verification, arrange-overhaul live verification (see open_items).
