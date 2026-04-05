# Architecture

## Overview
TravelPlanner is a single-page frontend served by an Express backend.

- `public/index.html`: 4-step UI shell
- `public/app.js`: state management, API calls, rendering, drag/drop
- `public/styles.css`: dark navy/cream design system
- `src/server.js`: API + static serving
- `src/claude.js`: Anthropic wrapper with required system prompt
- `src/unsplash.js`: Unsplash proxy fetcher

## Data Flow
1. Step 1 posts cities to `POST /api/plan`.
2. Server calls Claude and returns JSON activities.
3. Client fetches images from `GET /api/image`.
4. User approves/declines and annotates cards.
5. Step 3 uses Sortable.js to assign approved cards to day columns.
6. `POST /api/itinerary` stores/echoes final itinerary.

## State
- Client-side main state object in `app.js`
- Persisted to `localStorage` (`travelplanner_state_v1`)
- Server stores only latest itinerary in memory

## Reliability
- Missing Anthropic/Unsplash keys do not crash app.
- `/api/status` indicates key config.
- UI displays clear key-missing banners.
