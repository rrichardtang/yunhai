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

Minimal two-environment layout:

- **Production URL:** `https://yunhai.io`
- **Shared staging URL:** `staging.travelplanner.srv1553531.hstgr.cloud`

Compose files:

- `deployment/docker-compose.prod.yml` (production)
- `deployment/docker-compose.staging.yml` (staging)
- `deployment/docker-compose.yml` (legacy/backward-compatible prod file)

Recommended host layout:

- Prod app path: `/docker/openclaw-fbdq/data/.openclaw/workspace-sherlock/projects/travelplanner`
- Staging app path: `/docker/openclaw-fbdq/data/.openclaw/workspace-sherlock/projects/travelplanner-staging`

Deploy with explicit compose file + project name (to avoid collisions):

```bash
# staging
cd /docker/openclaw-fbdq/data/.openclaw/workspace-sherlock/projects/travelplanner-staging
docker compose -p travelplanner-staging -f deployment/docker-compose.staging.yml up -d

# production
cd /docker/openclaw-fbdq/data/.openclaw/workspace-sherlock/projects/travelplanner
docker compose -p travelplanner-prod -f deployment/docker-compose.prod.yml up -d
```
