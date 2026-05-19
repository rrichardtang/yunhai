# Current State

_Last updated: 2026-05-19_

## Objective
Add a per-trip "Schedule Preferences" wizard that feeds the Arrange step with explicit, structured scheduling inputs (day start/end, lunch/dinner times, tour timing, pacing) so the LLM-generated draft actually honors the traveler's day-shape preferences.

## Active Workstream
Branch `feature/scheduling-wizard-arrange` — implementation complete locally, tests pass (99/99). Awaiting push + staging verification.

## Constraints
- Per-trip scope: prefs stored on itinerary + localStorage; not per-profile (a beach trip ≠ a museum trip).
- Window clamps must apply ONLY to the arrange POST payload, not to the global timeline UI — manual drag/drop still works across the full day range.
- Arrival/departure days keep their travel-time bounds (clamp does not narrow them further).

## Risks
- (Carried over) Google OAuth client secret was briefly exposed; should be rotated.
- (Carried over) `client_secret_*.json` should be added to `.gitignore`.

## Next Actions
- Push `feature/scheduling-wizard-arrange` and verify on staging.
- Open the wizard from Draft on a fresh trip; confirm window clamps and prompt block reach the LLM.
- Rotate Google OAuth secret + .gitignore the client_secret file (deferred from prior session).
