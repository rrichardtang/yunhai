# Current State

_Last updated: 2026-04-20 (session 18)_

## Objective
Checklist save fix + arrive-early buffer + Draft/Finalize buttons implemented on `feature/arrange-transport-buffers`. Next: VPS deploy + smoke test, then Phase 3 (Finalize Modal).

## Active Workstream
`feature/arrange-transport-buffers` — save-button plan implemented, pending push/deploy.

## Constraints
- No database — flat JSON files
- Migration is in-memory only on load; write-back happens on next user save
- New itineraries tagged `_schemaVersion: 2` after save
- `actDurationHours`, `actPreferredTime`, `actAddress`, `actCostUsd`, `actCostType`, `actBookingType`, `actBookingLinks`, `actOpeningHours` helpers in `app.js` handle both old and new activity shapes
- `public/js/activityMigration.js`, `public/js/arrangeBuffers.js`, `public/js/arrangeArrivalBuffers.js` loaded before `app.js` via `<script>` in `planner.html`
- Buffer tables are duplicated in `src/` (server/test) and `public/js/` (client) — must stay in sync

## Risks
- Half-migrated localStorage state — optional chaining in accessor helpers prevents crashes but may show stale data until user re-saves
- Existing itineraries on VPS are legacy shape — `normalizeCityLogistics` defaults mode=flight/international=true on first load
- `/refine` still depends on `OPENAI_API_KEY`
- Finalize button shows "coming soon" toast — Phase 3 must wire the modal before the button is functional

## Next Actions
- Push `feature/arrange-transport-buffers` to remote and deploy to VPS
- Run Phase 2 exit criteria from `arrange_phase2_buffers.md` §8 + verify checklist save fix
- Implement Phase 3 (Finalize Modal) per `arrange_phase3_locks.md` on a new branch
