# Current State

_Last updated: 2026-04-19 (session 15)_

## Objective
Fix activity map pins landing at wrong landmarks and wildly incorrect activity prices. Replace Brave web-scraped prices with Google Places for pin resolution and a $-$$$$ badge for restaurants; link out to GetYourGuide/Viator for tours and attractions instead of showing a fabricated number.

## Active Workstream
Implementation complete on branch `feature/activity-location-price-fix`. Pending VPS deploy + smoke test.

## Constraints
- No database — flat JSON files
- localStorage geocode cache bumped to `_v2` to flush stale wrong pins
- In-memory Places cache on the server is capped at 500 entries (LRU), no TTL
- GetYourGuide Partner API gated behind 100k monthly visitors — use affiliate search links until threshold reached
- User-entered `budgetUsd` in the checklist continues to override all seeded values

## Risks
- Existing stored itineraries have no `venue_name` or `price_level` — they'll fall back to Nominatim until re-planned or enriched
- Google Places API usage will tick up (one lookup per activity on first render); monitor billing
- If `GOOGLE_MAPS_API_KEY` is missing the resolver returns `{ error: 'maps_disabled' }` and UI falls back to the existing Nominatim `/api/geocode` proxy
- Transportation overlap detection still requires both `departureTime`+`arrivalTime` to flag overlaps
- `/refine` still depends on `OPENAI_API_KEY`

## Next Actions
- VPS deploy and smoke test: plan a new trip, verify restaurant pins land on the correct venues and `$$`-style badges render on cards
- Verify tour/attraction cards show "Price on GetYourGuide →" link and that click-through opens the affiliate search URL
- Revisit GetYourGuide Partner API application once monthly visitors approach 100k
- Separately fix auto-arrange prompt to pass actual arrival/departure times in `fixedStart`/`fixedEnd` labels
