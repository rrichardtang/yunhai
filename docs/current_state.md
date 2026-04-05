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
- Deployment compose file in `deployment/docker-compose.yml`.

## Known Limitations
- Claude output parsing expects valid pure JSON array.
- Itinerary storage is volatile (in-memory only).
