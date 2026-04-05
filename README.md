# TravelPlanner

Personal AI itinerary builder.

## Run locally

```bash
cd /data/.openclaw/workspace-sherlock/projects/travelplanner
cp .env.example .env
# fill in keys as needed
npm install
npm start
```

App runs at `http://localhost:3457`.

## Environment

- `ANTHROPIC_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `PORT` (default `3457`)

If keys are missing, app still loads and shows clear warnings in UI.

## API

- `POST /api/plan` body: `{ cities: [{ name, startDate, endDate }] }`
- `GET /api/image?q={query}&city={city}`
- `POST /api/itinerary` stores/echoes final itinerary payload

## Deployment

Use `deployment/docker-compose.yml` and copy to host path `/docker/travelplanner/docker-compose.yml`.
