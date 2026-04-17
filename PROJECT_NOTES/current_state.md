# Current State

_Last updated: 2026-04-17 (session 13)_

## Objective
My Profile reworked: consolidated header UI, stacked question layout, and single-profile-per-user enforcement with forced wizard on first login or after deletion.

## Active Workstream
Idle — feature shipped.

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access
- All iOS browsers forced onto WebKit engine — Brave on iPhone behaves like Safari
- `planner.html` still does not load helper scripts directly; `app.js` retains runtime fallbacks
- `defaultProfilesStore()` now returns an empty store — all code paths that previously assumed a profile always exists must guard against empty `profiles[]`

## Risks
- Transportation overlap detection requires both `departureTime`+`arrivalTime` (and return equivalents) to be filled in — if user leaves arrival time blank, that transport leg is skipped from overlap checks silently
- `/refine` uses OpenAI (`gpt-5.4-mini`) — if `OPENAI_API_KEY` is not set on VPS, Optimize will silently fail per-activity
- Existing users with 2–3 profiles in localStorage will still have those profiles loaded (normalizeProfilesStore keeps them), but the UI no longer exposes multi-profile switching

## Next Actions
- Smoke test My Profile: new user → verify forced wizard opens on login with no cancel; complete wizard → verify modal opens; delete profile → verify forced wizard re-opens
- Smoke test Trip Health: add conflicting activity + transport on same day, verify overlap fires before check-off
- Separately fix auto arrange prompt to pass actual arrival/departure times in fixedStart/fixedEnd labels so LLM can reason about the transport buffer
