# Current State

_Last updated: 2026-05-09_

## Objective
Auto-arrange now passes the precomputed Distance Matrix into the prompt and the validator no longer enforces a hardcoded 20-min buffer. Sonnet schedules with real transit numbers; the validator only flags genuine physics violations. The cleanup logic drops one side of each overlap pair instead of both.

## Active Workstream
Pending user smoke test on the same Tokyo trip that previously produced ~50 unplaced items:
- Confirm placements count rises from ~10 to ~55+.
- Confirm the prompt sent to Sonnet contains a COMMUTE TIMES block with real minute counts.
- Confirm any remaining unplaced items carry their original Sonnet-emitted reasons (`opening_hours_no_fit` / `locked_conflict` / `no_time_slot_remaining`), not the generic `physics_unresolved` fallback.

## Constraints
- No database — flat JSON files.
- Distance Matrix API: no new costs (matrix was already being computed and shipped, just discarded).
- 91/91 tests passing.

## Risks
- If `/api/commute-matrix` returns an empty matrix (Google Maps API down or unconfigured), the COMMUTE TIMES block is omitted and Sonnet falls back to address-only reasoning. Acceptable — same behavior as before this change.
- The cleanup loop's "drop later-starting" heuristic in overlap pairs may occasionally drop a higher-value activity. Long-term we may want priority scoring; for now, earlier placements anchor day structure and dropping the later one preserves that anchor.

## Next Actions
- User smoke test of arrange flow on a multi-day trip.
- If unplaced count is still high with non-`physics_unresolved` reasons, inspect what Sonnet is emitting via `?debug=1` and the response payload.
