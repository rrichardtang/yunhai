# Decisions

1. **No DB**: keep state in client localStorage + in-memory itinerary endpoint, per requirement.
2. **Graceful key handling**: APIs return `503` + explicit code when key missing; frontend banner explains impact.
3. **Single-page vanilla JS**: avoids framework overhead and fits solo-tool scope.
4. **Image fetch strategy**: lazy-enrich activities after planning via `/api/image` proxy.
5. **Daily columns**: expanded from city date ranges into concrete day objects (`city + ISO date`).
