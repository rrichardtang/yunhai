# Current State

_Last updated: 2026-04-15_

## Objective
Activity card UX polish — decline flow improvements and mobile card interaction fixes.

## Active Workstream
All changes complete and pushed. This session: replaced Cancel with Save Notes on decline flow, switched checkmark to Phosphor floppy-disk icon, fixed mobile map button position, added full-screen map overlay close button on mobile, and fixed approve/decline buttons in mobile expanded card overlay not persisting state.

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
