# Current State

_Last updated: 2026-05-18_

## Objective
None active. Last completed work: Google Calendar sync UX fix (deployed to staging, verified working end-to-end).

## Active Workstream
Idle. Branch `feature/google-calendar-sync-fix` is pushed and deployed on staging via Docker Compose.

## Constraints
- Staging OAuth consent screen is in "Testing" mode — only listed test users can authorize Google Calendar. Test user grants expire every 7 days.
- Google Calendar API quotas apply.

## Risks
- Google OAuth client secret was briefly exposed in chat (file name pasted, file contains the secret). **Should be rotated** in Google Cloud Console → Credentials → Reset secret, then updated in VPS `.env` and container restarted.
- `client_secret_*.json` is in repo root and not in `.gitignore` — should be added before next commit.

## Next Actions
- Rotate Google OAuth client secret and update staging `.env`.
- Add `client_secret_*.json` to `.gitignore`.
- Merge `feature/google-calendar-sync-fix` into `main` when ready.
- For production launch: submit OAuth consent screen for Google verification to remove the "Access blocked: unverified app" wall.
