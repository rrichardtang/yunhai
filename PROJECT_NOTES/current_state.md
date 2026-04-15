# Current State

_Last updated: 2026-04-14 (session 12)_

## Objective
Mobile experience polish — fix navigation bugs and responsive layout issues on iOS WebKit (Brave on iPhone).

## Active Workstream
All mobile fixes complete and pushed. Latest fix addresses mobile UI scaling: buttons too large, fields clipped, and chat panel cut off — all caused by missing or incorrect mobile CSS overrides in `styles.css`.

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
