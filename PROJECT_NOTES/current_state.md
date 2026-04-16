# Current State

_Last updated: 2026-04-16 (session 9)_

## Objective
Budget Lens + Booking Checklist bugs fixed. Pushed to VPS, ready for smoke test.

## Active Workstream
Fixed three bugs in the Budget Lens / Booking Checklist feature area:
- Bug A/B: `buildChecklistFromState` now includes ALL approved activities (removed `booking_type` gate and placement requirement); budget lens and checklist populate immediately after Step 2 approval
- Bug C: checklist price always recomputed from live `estimated_cost_usd` — no more stale prices after activity refinement
- Per-person cost on activity cards is now user-editable inline

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access
- All iOS browsers forced onto WebKit engine — Brave on iPhone behaves like Safari
- `planner.html` still does not load helper scripts directly; `app.js` retains runtime fallbacks

## Risks
- `/refine` model is `gpt-5.4-mini` — unknown if this model ID is stable/correct (was used for chat concierge already; low risk)
- Budget optimization batch UI (flip cards, progress bar) not yet wired — `/refine` is ready to serve it as backbone
- Planner still generates generic venue names — users rely on Modify to pin specifics

## Next Actions
- Smoke test: approve all visible → verify Budget Lens fills and checklist populates
- Smoke test: edit per-person cost on a card → verify checklist price updates
