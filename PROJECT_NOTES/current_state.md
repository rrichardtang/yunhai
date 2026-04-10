# Current State

_Last updated: 2026-04-10_

## Objective
Ship Robust Calendar & Sync Mode MVP for low-noise calendar export.

## Active Workstream
Calendar sync reliability MVP:
- Step 4 now includes metadata toggle (compact/full) for calendar export
- ICS export supports metadata mode query (`?metadata=compact|full`)
- Google Calendar one-way sync added with OAuth endpoints + token persistence
- Pre-sync conflict detection endpoint checks overlaps with existing Google events
- Dedupe-safe sync mapping prevents duplicate event creation per itinerary item fingerprint

## Constraints
- Google sync requires envs: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional `GOOGLE_REDIRECT_URI` override)
- OAuth callback currently uses server route and stores per-user token JSON locally for MVP

## Risks
- No refresh-token renewal flow implemented yet; expired access tokens will need reconnect for now
- Conflict precheck warns but still allows user to continue sync

## Next Actions
- Add token refresh flow and graceful retry on expired Google access tokens
- Add selective sync scope (city/date filters) and per-item conflict resolution UI
- Add tests for calendar item fingerprint stability + sync dedupe behavior
