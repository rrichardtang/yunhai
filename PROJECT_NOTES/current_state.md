# Current State

_Last updated: 2026-04-27_

## Objective
On `feature/arrange-polish`: post-hybrid refactor (LLM picks times, validator is physics-only) is in. Today's work added Google Places price-tier enrichment for restaurants and a hard floor on activity counts driven by pace.

## Active Workstream
Pending user smoke test:
- Re-plan a trip with food activities; confirm `data/places-cache.json` is created and `$`–`$$$$` symbols render under restaurant names in the itinerary card.
- Re-plan a 6-day "active" trip; confirm Claude returns ≥48 activities (5 non-meal × 6 + 3 meals × 6) and that meals on arrival/departure days are skipped when their natural time falls outside the window.
- Confirm `/api/arrange` still works end-to-end with the LLM-picks-times flow.

## Constraints
- No database — flat JSON files; new `places-cache.json` follows the `commute-cache.json` pattern.
- Same `GOOGLE_MAPS_API_KEY` powers Distance Matrix and Places Text Search; one extra call per food activity on cache miss.
- 99/99 npm-test suite still passes; new placesEnrich tests live in `src/services/` (not picked up by current `src/*.test.js` glob — separate cleanup).

## Risks
- Places Text Search match quality depends on activity name + city — generic names ("Tapas Crawl") won't match a real place; activity just renders without a tier (acceptable).
- Hard count floor is enforced by prompt only. Claude may still undershoot on weird trip shapes; no deterministic backstop.
- Meal-skip rule for partial days is one sentence in the prompt — if Claude generates 7am breakfast on a 3pm arrival, we'll need to pre-compute per-day meal availability in JS.

## Next Actions
- User smoke test of price tiers and activity-count floor.
- Decide whether existing itineraries need a one-shot enrichment job to backfill price tiers (currently they only appear on freshly planned trips).
- Phase 4 cleanup item still open: delete unused `src/services/arrangePrompt.js`.
