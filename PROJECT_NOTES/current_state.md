# Current State

_Last updated: 2026-04-12_

## Objective
Budget feature polish — booking type taxonomy, children travelers, cost accuracy fixes.

## Active Workstream
Shipped two follow-up fixes to the budget feature:
- Replaced `is_bookable` boolean with `booking_type` enum (`tour`/`attraction`/`restaurant`/`none`) — tours get GetYourGuide+Viator, attractions get Google tickets search, restaurants get Google Maps
- Strengthened `cost_type` prompt examples to prevent misclassification (e.g. teamLab is per_person not per_group)
- Added Children input (separate from Adults) to Step 1; children estimated at 60% of adult price
- Children count threaded through plan payload, LLM budget context, booking link params, cost display, and arrange prompt

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access

## Risks
- Concurrent writes from two devices could overwrite each other (last-write-wins)
- Brave price parsing relies on regex against snippets — may miss prices in non-standard formats
- LLM cost estimates are rough; Brave validation helps but neither source is authoritative

## Next Actions
- Test on VPS: verify booking_type classification is accurate, booking links route correctly
- Add token refresh flow and graceful retry on expired Google access tokens
- Consider caching Brave search results to stay within free tier (2000 req/month)
