# Current State

_Last updated: 2026-04-08_

## Objective
Continue local development of TravelPlanner and push changes to git for VPS deployment.

## Active Workstream
Arrival/departure logistics cards with real commute times — pushed, awaiting VPS test.

## Constraints
- Local development, testing on VPS at https://travelplanner.srv1553531.hstgr.cloud/planner.html
- Google Maps API does not work on localhost, so testing requires VPS deployment
- No .env file locally — user only edits frontend files

## Risks
- LLM may not reliably honor FIXED FIRST/LAST constraints in edge cases (e.g. very tight windows)
- Logistics pseudo-activities need valid lat/lng or address strings for Google Maps to resolve commute times

## Next Actions
- Verify arrival/departure commute times show correctly (real Google Maps data, not static arrows)
- Verify accommodation label shows short form (first comma-segment only)
- Verify auto-arrange schedules no activities before arrival or after departure legs
