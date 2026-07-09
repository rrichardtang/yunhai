# Current State

_Last updated: 2026-07-07_

## Objective
Ship the budget-optimization cost fix + shared interactive loading screens (branch
`claude/budget-optimization-loading-screens-4hc6a3`), while the earlier clean-sweep
branch (`claude/codebase-review-sweep-2z6t4h`) still awaits its ops follow-ups
(Maps key rotation, new required envs) and deploy.

## Active Workstream
Branch `claude/budget-optimization-loading-screens-4hc6a3`, several stacked changes (all
Playwright-verified in embed mode; 176/176 tests): (1) budget totals sum real per-activity
costs with `budgetUsdAuto` tracking; refine route normalizes LLM cost shape
(`applyCostShapeToUpdates`). (2) Shared interactive loader (`showLoader`/`hideLoader`) for
budget-opt, auto-arrange, and card replace. (3) `~$` estimate chip on review cards. (4)
**Single cost basis** — every per-activity $ surface (review chip, checklist, finalize
open-items, budget-opt chips/bar/summary) now derives from `activityCardCostUsd`, fixing
the $90-vs-$180 finalize bug; budget-opt eligibility widened to price-level-only meals;
`computeApprovedCost` deleted, progress bar zero-arg (fixes a flip-denominator jump). (5)
Category-spend summary in the budget-opt header. (6) Price sorting on Review
(`#reviewSortFilter`) and budget-opt (cycling toggle).

## Constraints
- Frontend stays a monolith (`public/app.js`); all `innerHTML` goes through `esc()`, and
  `dataset.*` reads must be re-escaped (values come back entity-decoded).
- Identity is never taken from request body/query — always `getAuthedUserId(req)`.
- Pre-auth API surface is only `/api/status` (booleans) + the email webhook (secret-gated,
  fails closed). Debug/admin surfaces require `OWNER_USER_ID`.
- The shared loader owns the single `#planningOverlay` node (z 2050) — flows using it are
  mutually exclusive; a concurrent flow would need a second mount.
- Staging/prod deploy discipline unchanged: `deployment/promotion.sh` only; split env files.

## Risks
- Existing trips' budget meter totals shift once after this branch deploys (real costs
  replace flat per-type estimates) — intended, per decisions [2026-07-07].
- The refine cost-shape fix is unit-tested but the live OpenAI refine path is unverified
  in this keyless container (open_items 2026-07-07).
- (Carried over from the sweep branch) `GOOGLE_MAPS_API_KEY` rotation +
  `EMAIL_WEBHOOK_SECRET`/`OWNER_USER_ID` env setup still pending before its deploy;
  memory-layer / arrange-overhaul / grounding keyed verifications still outstanding.

## Next Actions
- Push `claude/budget-optimization-loading-screens-4hc6a3`; deploy after the sweep branch.
- In a keyed env: run a real budget optimization and confirm the meter drop matches the
  overlay savings; eyeball the three new loaders with live latencies.
- Then resume the sweep-branch ops follow-ups and the queued keyed verifications.
