# Current State

_Last updated: 2026-04-15 (session 4)_

## Objective
Add user-initiated activity cards to the review step so users can manually add missing activities.

## Active Workstream
Add Activity + Replace/Modify Brave grounding shipped:
- Blank "Add activity" card appended at end of the review grid on every `renderActivities()` call
- Clicking the card opens a modal with 4 fields: name (text), city (dropdown from existing cities), est. cost ($ input + per person/group toggle), why it fits (textarea)
- On submit, stub pushed with `enriching: true`, card shows spinner; `/api/activity/replace` called with `userAdded: true`; enriched result swaps in-place on success
- `/api/activity/replace` now runs Brave search on `name + city` before every LLM call for both replace/modify and user-added flows — grounds responses in real venues
- `userAdded` flag on endpoint controls prompt framing and skips preference signal extraction

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
- Push and test on VPS
- Verify add card appears at end of grid and modal opens/closes cleanly
- Verify user-added activity appears as a real card after submit and can be approved/declined
