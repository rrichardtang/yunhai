# Current State

_Last updated: 2026-04-14 (session 10)_

## Objective
Mobile experience polish — fix navigation bugs and responsive layout issues on iOS WebKit (Brave on iPhone).

## Active Workstream
All mobile fixes complete and pushed:
- Back button / browser nav causing full page reload on iOS WebKit — fixed via `history.replaceState` seed + `pushState` with null URL + `spa` flag guard on `popstate`
- Header buttons unclickable on mobile — fixed with `position: relative; z-index: 100` on `.topbar`
- Chat concierge panel offset off-screen on mobile — fixed `right: -24px` → `right: 0; left: 0`
- City card row layout broken on mobile — replaced 1fr collapse with explicit `nth-child` grid placement
- Structural navigation bug fixed: 3 independent nav systems (Next/Back, step tabs, browser back) had inconsistent per-step render logic; `setStep()` now owns all step-entry rendering so every nav path gets the same behavior

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
- Verify mobile fixes on device (back button, header buttons, chat, city card layout, step navigation)
- Add visual issue deep-links from confidence step to specific itinerary items/cards
- Add “reminder before departure” scheduling behavior behind a simple server-side cron/passive worker
