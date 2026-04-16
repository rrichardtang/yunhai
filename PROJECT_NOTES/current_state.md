# Current State

_Last updated: 2026-04-16 (session 8)_

## Objective
Modify vs Replace split complete. Ready to push to VPS.

## Active Workstream
Implemented Modify / Replace split on activity cards:
- `/api/activity/refine` upgraded: now uses `gpt-5.4-mini`, unconditional Brave `search()` grounding when configured, optional `budget_target` field, terse reasoning-reliant prompt
- Frontend: single textarea + two buttons (pencil = Modify → `/refine`, arrows = Replace → `/replace`); both inline card and expanded modal wired; `id` preserved on modify
- All 11 tests pass

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
- Push to VPS
- Smoke test: Modify (pin to named venue) + Replace (swap activity type) + existing replace flows
