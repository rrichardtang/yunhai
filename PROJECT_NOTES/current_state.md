# Current State

_Last updated: 2026-07-01_

## Objective
Land the mobile-UI feedback pass (branch `claude/mobile-ui-feedback-eqx6he`) — activity-card
prev/next navigation on all viewports, toast system removed in favor of a persistent error
banner, grounded activity adds via the new `/api/activity/add`, scrollable preference wizards,
and mobile overflow fixes — then verify the LLM-dependent paths in a keyed environment and
deploy. The memory-layer and arrange-redesign verifications remain queued behind their own
staging deploys.

## Active Workstream
Branch `claude/mobile-ui-feedback-eqx6he`, complete and pushed. All five feedback items
implemented; 144/144 tests pass; UI verified locally via Playwright against `?embed` mode at
desktop (1280px) and mobile (375px) widths. What could NOT be verified without API keys: the
`/api/activity/add` LLM fill + Places resolve gate live path, the replace-path retry, and the
refine re-enrichment (all need `GOOGLE_MAPS_API_KEY` / `ANTHROPIC_API_KEY`).

## Constraints
- Frontend stays a monolith (`public/app.js`) — only boundary concerns are extracted.
- `showToast` no longer exists; failures go through `showErrorBanner()` (persistent, dismissible,
  top-center). Do not reintroduce transient notifications.
- Add path: Places resolve gate runs before any LLM call; degrade gracefully when
  `GOOGLE_MAPS_API_KEY` is absent (gate skipped) or `ANTHROPIC_API_KEY` is absent (grounded
  minimal activity, never an error for a verified venue).
- Map links prefer `place_id` → lat,lng → name+city text search, in that order.
- Staging/prod deploy discipline unchanged: `deployment/promotion.sh` only; split env files
  (`.env` staging / `.env.prod` prod); `CLERK_AUTHORIZED_PARTIES` per env.

## Risks
- Keyed-environment verification of the grounding fixes is outstanding — the Sisterita-class
  bugs are fixed by construction but unproven against live Places/Anthropic.
- Removing success toasts means saves/deletes/copies have no positive confirmation; watch for
  user confusion reports.
- Checklist item delete lost its undo (was toast-based).
- (Carried over) Google OAuth client secret should be rotated; `client_secret_*.json` should be
  `.gitignore`d.

## Next Actions
- Verify on a keyed environment (VPS/staging): add "Sisterita" in San Francisco → gate passes,
  name verbatim, real address/pin; gibberish name → inline "Couldn't find…" with no LLM call;
  replace with an unresolvable venue → one retry then `unverified: true`; refine rename →
  coords/hours refreshed.
- Merge/deploy `claude/mobile-ui-feedback-eqx6he` via staging → promote.
- (Queued, from prior sessions) Staging verification of the memory layer
  (`claude/website-memory-architecture-3BI4W`) and the arrange redesign
  (`feature/arrange-reliability-thinking`) per open_items.
- Rotate Google OAuth secret + `.gitignore` the `client_secret` file (deferred).
