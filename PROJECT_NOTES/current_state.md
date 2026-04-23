# Current State

_Last updated: 2026-04-23 (session 21)_

## Objective
Codebase rename: "confidence" → split into `bookingChecklist` (stored user state) and `tripHealth` (derived report). Rationale: "confidence" was overloaded and inaccurate for a booking-readiness checklist.

## Active Workstream
`feature/arrange-time-locks` — also bundles the in-flight checklist-persistence fix (saveSnapshot now sends `bookingChecklist` to PUT `/api/itinerary/:id`).

## Constraints
- No database — flat JSON files
- Debug mode: legacy itineraries with `itinerary.confidence` are NOT migrated. Old data will silently lose its checklist on next save.
- Buffer tables duplicated in `src/` and `public/js/` — must stay in sync
- `state.lastFinalizeLocks` is in-memory only (clears on page reload)

## Risks
- Any production records with `itinerary.confidence` field will not be readable. Acceptable per debug-mode policy.
- `state.lastFinalizeLocks` is ephemeral (acceptable per spec)
- `/refine` still depends on `OPENAI_API_KEY`

## Next Actions
- Commit bundled rename + checklist-persistence fix on `feature/arrange-time-locks`
- Push to remote and deploy to VPS
- Smoke test: load existing itinerary, edit checklist, save, restart container, reload — checklist should persist
