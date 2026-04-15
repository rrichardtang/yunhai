# Current State

_Last updated: 2026-04-15 (session 3)_

## Objective
Stabilize frontend boundaries with a minimal split of high-churn logic out of `public/app.js` while keeping behavior unchanged.

## Active Workstream
Frontend boundary split landed with minimal scope:
- Extracted **overlay/modal manager** into `public/js/overlayManager.js`
- Extracted **API/service layer** into `public/js/apiService.js`
- Extracted **top-level state/persistence helpers** into `public/js/statePersistence.js`

Primary motivation:
- reduce mobile fragility from one giant script
- lower regression risk by isolating frequently-touched concerns
- create clearer seams for future refactors without forcing a full rewrite now

Intentional hold line:
- `public/app.js` still owns core planner orchestration/UI flow (step rendering, activity/review interactions, arrange/finalize flow, chat wiring, map behaviors, and checklist UX orchestration)
- split is intentionally **minimal and revertible** (small boundary files + fallback paths in `app.js`, no large architectural migration)

Script-loading caveat status:
- `planner.html` still does **not** load the new helper scripts directly in this environment (`/app.js` is still the only local app script tag), so `app.js` keeps runtime fallbacks and in-file defaults to preserve behavior if helper globals are absent.

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access
- All iOS browsers forced onto WebKit engine — Brave on iPhone behaves like Safari

## Risks
- Confidence validation is heuristic-based and intentionally lightweight for MVP
- Email summary depends on Resend env configuration and authenticated user email claim
- Concurrent writes from two devices remain last-write-wins
- Mobile city card layout uses `nth-child` selectors — fragile if HTML child order changes
- Checklist items created before this overhaul will be migrated via `normalizeChecklistItem`; old `bookingReference`/`city` fields map to new typed fields

## Next Actions
- Push and test on VPS — verify modal renders, Google Maps autocomplete fires in modal context
- Check that existing saved itineraries with old checklist schema migrate cleanly on load
- Test notes feature: save notes, verify they persist in state.reviewed and pre-populate on card re-render; verify notes pass through to Replace/Modify LLM call
- Verify checklist auto-population: approve a tour/attraction card and confirm it appears under the correct city; approve a restaurant/none card and confirm it is excluded
