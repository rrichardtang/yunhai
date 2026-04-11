# Current State

_Last updated: 2026-04-11_

## Objective
Cross-device data sync — ensure profiles, snapshots, view mode, and chat session mappings are available on any device after Clerk sign-in.

## Active Workstream
Just shipped cross-device sync for all localStorage-only data:
- New `src/userDataStore.js` flat-file store at `data/userdata.json` keyed by Clerk userId
- REST endpoints (`GET/PUT /api/userdata`, `GET/PUT /api/userdata/:field`) for per-user data
- Frontend writes to both localStorage (fast cache) and server (durable sync) on every save
- On sign-in, `syncFromServer()` hydrates localStorage from server if local is empty or stale
- Synced fields: profiles, snapshot, viewMode, chatSessions

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access

## Risks
- Concurrent writes from two devices could overwrite each other (last-write-wins)
- Large userdata.json file if many users accumulate (single file for all users)

## Next Actions
- Test cross-device sync on VPS deployment
- Add token refresh flow and graceful retry on expired Google access tokens
- Add selective sync scope (city/date filters) and per-item conflict resolution UI
- Add tests for calendar item fingerprint stability + sync dedupe behavior
- Consider adding Brave search result caching (knowledgeStore) when free tier cap becomes a concern
