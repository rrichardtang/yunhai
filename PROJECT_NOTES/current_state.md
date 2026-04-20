# Current State

_Last updated: 2026-04-20 (session 16)_

## Objective
Land the new activity schema (v2) across the full stack without changing user-visible behavior. Phase 1 is complete and pushed; Phase 2 (arrival/departure buffer pass-through in arrange) is next.

## Active Workstream
Phase 1 complete on `feature/arrange-schema-migration`. Pending VPS deploy + smoke test per exit criteria in `arrange_phase1_schema.md`.

## Constraints
- No database — flat JSON files
- Migration is in-memory only on load; write-back happens on next user save
- New itineraries tagged `_schemaVersion: 2` after save
- `actDurationHours`, `actPreferredTime`, `actAddress`, `actCostUsd`, `actCostType`, `actBookingType`, `actBookingLinks`, `actOpeningHours` helpers in `app.js` handle both old and new activity shapes
- `public/js/activityMigration.js` loaded before `app.js` via `<script>` in `planner.html`

## Risks
- Half-migrated localStorage state (activities migrated but days not, or vice versa) — optional chaining in accessor helpers prevents crashes but may show stale data until user re-saves
- Existing itineraries on VPS are legacy shape — first load migrates in memory, write-back on next save
- `/refine` still depends on `OPENAI_API_KEY`
- Transportation overlap detection still requires both `departureTime`+`arrivalTime`

## Next Actions
- Deploy `feature/arrange-schema-migration` to VPS and run exit criteria checklist from `arrange_phase1_schema.md` §7
- Phase 2: pass actual arrival/departure times in `fixedStart`/`fixedEnd` labels of `/api/arrange` prompt (`open_items.md` item)
- Continue with Phase 3 (lock UI) per `arrange_phase3_locks.md`
