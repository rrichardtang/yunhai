# Current State

_Last updated: 2026-04-07_

## Objective
Continue local development of TravelPlanner and push changes to git for VPS deployment.

## Active Workstream
Concierge chatbot evolving context window — awaiting VPS test.

## Constraints
- Local development, testing on VPS at https://travelplanner.srv1553531.hstgr.cloud/planner.html
- Google Maps API does not work on localhost, so testing requires VPS deployment
- No .env file locally — user only edits frontend files

## Risks
- Chat system prompt is now larger (profile + schedule) — monitor token usage on Haiku
- Per-trip chat session map in localStorage could grow if user creates many itineraries

## Next Actions
- Push to main and test concierge chatbot on VPS with a real trip
- Verify chat session switches correctly when loading different saved itineraries
