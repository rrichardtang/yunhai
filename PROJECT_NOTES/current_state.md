# Current State

_Last updated: 2026-04-26_

## Objective
Phase 4 (hybrid arrange scheduler) implemented on `feature/arrange-hybrid-scheduler`. LLM returns per-day ordered lists; server assigns times deterministically; validator catches overlaps/caps/window violations; one repair pass on failure.

## Active Workstream
Pending user smoke test of new auto-arrange flow: drag flexible activities, hit Auto Arrange, verify times look sensible, check that meal/category caps and locked-activity buffers work.

## Constraints
- No database — flat JSON files
- All `/api/*` route paths preserved (`/api/arrange` request shape extended with `commuteMatrix`, response adds `diagnostics`)
- 99/99 tests passing (added 19 new for assigner + validator)

## Risks
- Hybrid prompt is a wholesale rewrite of arrange — Claude may produce orderings the assigner cannot fully time. Repair pass should catch most; remaining issues surface as `diagnostics` to the client.
- `/api/commute-matrix` does N×N pairs serially in batches of 6 — could be slow for ≥10 flexible activities. Cache may be needed if real-world latency hurts.
- Old `src/services/arrangePrompt.js` still exists but is no longer imported. Safe to delete after smoke test passes.

## Next Actions
- User smoke test of auto-arrange.
- If green, delete unused `arrangePrompt.js` and merge to main.
- Phase 5 (intensity alternation, `must_happen_on_day`) per `arrange_phase5_*.md` if it exists.
