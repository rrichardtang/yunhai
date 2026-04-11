# Current State

_Last updated: 2026-04-11_

## Objective
UX improvements — replace modal-based resume flow with inline "My Trips" section.

## Active Workstream
Replaced resume popup with "My Trips" panel on Step 1. Previously shipped cross-device sync for all localStorage-only data:
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
