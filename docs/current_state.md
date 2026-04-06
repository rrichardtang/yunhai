# Current State

## Implemented
- Express server with endpoints:
  - `GET /api/status`
  - `POST /api/plan`
  - `GET /api/image`
  - `POST /api/itinerary`
  - `GET /api/itinerary`
- Anthropic integration (`claude-sonnet-4-6`) with exact provided system prompt.
- Unsplash integration proxy with key guardrails.
- 4-step frontend flow:
  - Step 1 setup form (trip + city ranges)
  - Step 2 review cards with approve/decline/notes + cultural budget tracker
  - Step 3 drag/drop arranging in day columns with editable time
  - Step 4 final printable itinerary grid + edit back button
- Local persistence via localStorage.
- Resilient Claude output parsing with recovery strategies (code fence stripping, JSON array extraction, trailing-comma cleanup) plus activity normalization defaults.
- Persistent itinerary storage on server (`data/itineraries.json`) with history endpoints:
  - `GET /api/itineraries`
  - `GET /api/itinerary/:id`
  - `DELETE /api/itinerary/:id`
- Calendar export endpoint for saved itineraries:
  - `GET /api/itinerary/:id/calendar.ics`
- Step 4 enhancements:
  - One-click `.ics` calendar export button
  - Saved itineraries panel with open/delete actions
- Deployment compose file in `deployment/docker-compose.yml`.

## Known Limitations
- Calendar export uses floating local times (no timezone conversion).
- Saved itinerary storage is file-based JSON (single-node, not multi-writer safe).
