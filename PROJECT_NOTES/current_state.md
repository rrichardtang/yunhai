# Current State

_Last updated: 2026-04-16 (session 6)_

## Objective
Preference system refactor complete. Ready to push to VPS and verify end-to-end.

## Active Workstream
Full preference system rewrite shipped:
- `preferences.js` stripped to 3 fields: `profileInstruction`, `preferences`, `constraints`
- All signal/distillation machinery removed
- `profileInstruction` (AI-generated summary) now stored server-side, not localStorage
- Learned preferences extracted from replace/modify notes and chat; shown as editable tags in My Profile
- AI summary only regenerates when profile answers or aboutMe change
- Manual edits to AI summary textarea saved on blur

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access
- All iOS browsers forced onto WebKit engine — Brave on iPhone behaves like Safari
- `planner.html` still does not load helper scripts directly; `app.js` retains runtime fallbacks

## Risks
- Existing VPS users with `distilledProfile` in their JSON will lose it on next write — old field silently dropped by new `normalize()`. If there's valuable data, needs one-time migration before deploy.
- Confidence validation is heuristic-based and intentionally lightweight for MVP
- Email summary depends on Resend env configuration and authenticated user email claim
- Concurrent writes from two devices remain last-write-wins
- Mobile city card layout uses `nth-child` selectors — fragile if HTML child order changes

## Next Actions
- Push to VPS
- Check existing user JSON files for `distilledProfile` data worth preserving before deploy
- Verify: My Profile shows AI summary from server, learned prefs tags appear, enrich only fires on profile change
