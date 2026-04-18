# Current State

_Last updated: 2026-04-18 (session 14)_

## Objective
Itinerary view (formerly "Execution") overhauled: renamed, card layout simplified, Phosphor icons throughout, and local-filesystem ticket attachment support added.

## Active Workstream
Idle — feature shipped.

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access
- All iOS browsers forced onto WebKit engine — Brave on iPhone behaves like Safari
- `planner.html` still does not load helper scripts directly; `app.js` retains runtime fallbacks
- `defaultProfilesStore()` now returns an empty store — all code paths that previously assumed a profile always exists must guard against empty `profiles[]`
- Attachments stored at `/data/attachments/{userId}/` with per-user `manifest.json`; max 10 MB/file; PDF + image types only

## Risks
- Transportation overlap detection requires both `departureTime`+`arrivalTime` (and return equivalents) to be filled in — if user leaves arrival time blank, that transport leg is skipped from overlap checks silently
- `/refine` uses OpenAI (`gpt-5.4-mini`) — if `OPENAI_API_KEY` is not set on VPS, Optimize will silently fail per-activity
- VPS disk pressure if users upload many large attachments — monitor `/data/attachments/` size; migration to Cloudflare R2 is the planned escape valve (only `src/attachmentStore.js` changes)

## Next Actions
- Smoke test Itinerary view: plan a trip → approve activities → arrange → check Itinerary tab shows new card layout
- Test upload: upload a PDF ticket, confirm file count increments; open viewer; delete file
- Verify old `?mode=execution` share links redirect gracefully to Itinerary mode
- Separately fix auto arrange prompt to pass actual arrival/departure times in fixedStart/fixedEnd labels so LLM can reason about the transport buffer
