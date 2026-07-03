# Current State

_Last updated: 2026-07-03_

## Objective
Land the codebase clean-sweep (branch `claude/codebase-review-sweep-2z6t4h`) — security
hardening (entitlement bypass, key leak, IDORs, XSS), correctness fixes, and a
duplication/dead-code pass — then complete the ops follow-ups (Maps key rotation, new
required envs) and deploy. The mobile-UI feedback branch and the queued memory-layer /
arrange-redesign verifications remain pending their staging deploys.

## Active Workstream
Branch `claude/codebase-review-sweep-2z6t4h`, 5 commits, pushed. All fixes are sweep-sized
(no architectural changes): authed-by-default identity (userId always from the Clerk
session), fail-closed email webhook, owner-gated debug/admin, tooltip XSS fix, atomic
store writes, outbound fetch timeouts, bounded in-memory stores, shared `llmJson` /
`jsonFileCache` / calendar-time helpers. 168/168 tests pass (8 new security smoke
regressions); server boots clean keyless with correct degradation.

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
