# Current State

_Last updated: 2026-04-15 (session 5)_

## Objective
Fix add-activity enrichment returning wrong activity (e.g. "Sunset Boat Tour" → unrelated city activity).

## Active Workstream
Bug fix shipped for `/api/activity/replace` userAdded path:
- Root cause: `claude-haiku-4-5` with `max_tokens: 600` lacked instruction-following precision for enrichment; prompt used negative guardrails that were brittle against weaker model
- Fix: `userAdded` path now uses `claude-sonnet-4-6` + `max_tokens: 1024`; decline/replace path keeps Haiku
- Prompt simplified to positive framing — tell the model what to do, not what not to do
- Awaiting VPS push and live test

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access
- All iOS browsers forced onto WebKit engine — Brave on iPhone behaves like Safari
- `planner.html` still does not load helper scripts directly; `app.js` retains runtime fallbacks

## Risks
- Confidence validation is heuristic-based and intentionally lightweight for MVP
- Email summary depends on Resend env configuration and authenticated user email claim
- Concurrent writes from two devices remain last-write-wins
- Mobile city card layout uses `nth-child` selectors — fragile if HTML child order changes
- User-added activities have no image — card image area will be blank until enrichment fetches one

## Next Actions
- Push to VPS and test add-activity with "Sunset Boat Tour" to verify correct enrichment
