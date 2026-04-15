# Current State

_Last updated: 2026-04-14 (session 11)_

## Objective
Mobile experience polish — fix navigation bugs and responsive layout issues on iOS WebKit (Brave on iPhone).

## Active Workstream
All mobile fixes complete and pushed. Latest fix addresses mobile crash when rapidly tapping step headers:
- `setStep()` transition lock (RAF-based) prevents concurrent render calls from rapid taps
- Sortable instances now tracked and destroyed before each `renderArrange()` re-render
- Step indicator CSS hardened for mobile: `touch-action: manipulation`, `user-select: none`, tap highlight suppressed

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access
- All iOS browsers forced onto WebKit engine — Brave on iPhone behaves like Safari

## Risks
- Confidence validation is heuristic-based and intentionally lightweight for MVP
- Email summary depends on Resend env configuration and authenticated user email claim
- Concurrent writes from two devices remain last-write-wins
- Mobile city card layout uses `nth-child` selectors — fragile if HTML child order changes

## Next Actions
- Verify rapid-tap crash fix on device
- Add visual issue deep-links from confidence step to specific itinerary items/cards
- Add “reminder before departure” scheduling behavior behind a simple server-side cron/passive worker
