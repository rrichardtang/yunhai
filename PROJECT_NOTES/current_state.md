# Current State

_Last updated: 2026-04-08_

## Objective
Continue local development of TravelPlanner and push changes to git for VPS deployment.

## Active Workstream
Auto-arrange overhaul — pushed, awaiting VPS test.

## Constraints
- Local development, testing on VPS at https://travelplanner.srv1553531.hstgr.cloud/planner.html
- Google Maps API does not work on localhost, so testing requires VPS deployment
- No .env file locally — user only edits frontend files

## Risks
- LLM may not reliably estimate inter-activity travel time accurately (no exact commute data at schedule time)
- Logistics pseudo-activities need valid lat/lng or address strings for Google Maps to resolve transit commute durations

## Next Actions
- Test auto-arrange on arrival/departure days: first/last activities should respect transit buffer
- Verify commute badges still render correctly after the post-processing removal
