# Current State

_Last updated: 2026-04-12_

## Objective
Budget feature — per-activity cost estimates, booking links, and a budget tracker in step 2.

## Active Workstream
Shipped budget feature:
- Step 1: Total Budget (USD) + Number of Travelers inputs
- LLM outputs `estimated_cost_usd`, `cost_type` (per_person/per_group), `is_bookable` per activity
- Post-generation: parallel Brave search validates/overrides LLM cost estimates (takes higher value)
- Booking links constructed per activity: GetYourGuide + Viator for tours, Google Maps for named restaurants
- Booking link dates updated to actual scheduled date after auto-arrange
- Step 2: cost display on cards with per-person multiplication, sticky budget tracker with color states
- Customize (refine) endpoint re-enriches cost + links after activity changes

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access

## Risks
- Concurrent writes from two devices could overwrite each other (last-write-wins)
- Brave price parsing relies on regex against snippets — may miss prices in non-standard formats
- LLM cost estimates are rough; Brave validation helps but neither source is authoritative

## Next Actions
- Test on VPS: verify Brave price searches fire correctly and booking links work
- Add token refresh flow and graceful retry on expired Google access tokens
- Consider caching Brave search results to stay within free tier (2000 req/month)
