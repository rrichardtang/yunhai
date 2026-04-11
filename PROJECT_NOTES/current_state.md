# Current State

_Last updated: 2026-04-11_

## Objective
Ship Map-First Step 2 review UX (card flip + full itinerary map overlay) while keeping Calendar & Sync MVP intact.

## Active Workstream
Step 2 map-first review enhancements:
- Activity cards now support a Quizlet-style 3D flip with a map back face
- Back face renders a Leaflet mini-map (OpenStreetMap tiles) with pinned activity location
- Geocoding uses OpenStreetMap Nominatim (`/search`) with local cache (`localStorage`) and queued requests to reduce API hammering
- Clicking a mini-map opens a full-screen Leaflet overlay map containing all activities
- Overlay markers use numeric labels; selected activity gets a star-highlight marker
- Pin clicks can cross-reference back to the card (scroll + temporary highlight)
- Existing approve/decline/note behavior on the front face remains unchanged

## Constraints
- Leaflet loaded via CDN in planner page
- OSM/Nominatim free-tier best-practice respected via caching + serialized fetches
- Step 2 structure preserved (no new review page)

## Risks
- Nominatim can throttle or return ambiguous hits for sparse location strings
- Geocoding currently happens client-side on-demand; first open can feel slower on fresh cache

## Next Actions
- Add lightweight fallback copy for map errors (network blocked / geocode failed)
- Add marker clustering if activity count grows large in one itinerary
- Add token refresh flow and graceful retry on expired Google access tokens
- Add selective sync scope (city/date filters) and per-item conflict resolution UI
- Add tests for calendar item fingerprint stability + sync dedupe behavior
- Consider adding Brave search result caching (knowledgeStore) when free tier cap becomes a concern
