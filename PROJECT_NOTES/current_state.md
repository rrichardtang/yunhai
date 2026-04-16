# Current State

_Last updated: 2026-04-16 (session 7)_

## Objective
Two My Profile bugs fixed. Ready to push to VPS.

## Active Workstream
Bug fixes to AI-generated summary visibility in My Profile modal:
1. `profileChanged` check was always false — slider dot-click handler mutates `state.profile` live, so `prev === state.profile` already had new values by save time. Fixed by capturing a `profileSnapshot` JSON string on modal open and comparing against that.
2. `GET /api/preferences` on every modal open could overwrite in-memory `profileInstruction` with an empty string from the server (race/stale write). Fixed by merging: incoming `profileInstruction` only wins if non-empty, otherwise fall back to existing `state.learnedPrefs?.profileInstruction`.

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access
- All iOS browsers forced onto WebKit engine — Brave on iPhone behaves like Safari
- `planner.html` still does not load helper scripts directly; `app.js` retains runtime fallbacks

## Risks
- Root cause of #2 (server returning empty profileInstruction) not fully confirmed — the fix is defensive but underlying cause (race condition vs userId mismatch) may resurface
- Confidence validation is heuristic-based and intentionally lightweight for MVP
- Email summary depends on Resend env configuration and authenticated user email claim
- Concurrent writes from two devices remain last-write-wins

## Next Actions
- Push to VPS
- Verify: AI summary persists across modal open/close cycles without needing to re-save
