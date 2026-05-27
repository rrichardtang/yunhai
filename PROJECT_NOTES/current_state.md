# Current State

_Last updated: 2026-05-27_

## Objective
Roll out YunHai to a small private beta. Distribute access via magic invite links; manage codes from a browser admin page (no CLI on VPS).

## Active Workstream
Branch `feature/invite-link-magic`. Built:
- `?invite=ABC` URLs that auto-redeem after Clerk sign-up (no manual paste).
- `/admin.html` browser UI to mint / list / revoke codes, gated by `OWNER_USER_ID`.
- `src/routes/admin.js` endpoints.

Awaiting deploy to staging (`https://staging.travelplanner.srv1553531.hstgr.cloud/`) for smoke test. Production target: `yunhai.io`.

## Constraints
- Node isn't on the VPS PATH — admin must be browser-driven, not CLI.
- Test domain: `https://staging.travelplanner.srv1553531.hstgr.cloud/` before any prod (`yunhai.io`) rollout.
- Clerk dev tier — don't rely on Backend API invitations / allowlist (low caps).
- `OWNER_USER_ID` env var must be set on the VPS for the admin page to work. The page surfaces the current Clerk user id when access is denied, so the owner can copy it into the env var.

## Risks
- `data/invite-codes.json` lives on the VPS and is not in git. If the data dir is wiped, all invites are lost. Worth backing up.
- `/debug/codes` (pre-existing) exposes the code list unauthenticated. Not exploited by attackers since redemption still requires a Clerk userId, but the list of valid codes is readable. Worth restricting later.
- (Carried over) Google OAuth client secret was briefly exposed; should be rotated.
- (Carried over) `client_secret_*.json` should be added to `.gitignore`.

## Next Actions
- Push `feature/invite-link-magic` and deploy to staging.
- Set `OWNER_USER_ID` env var on staging VPS to the Clerk userId of c3u2b4e@gmail.com.
- Visit `https://staging.travelplanner.srv1553531.hstgr.cloud/admin.html`, mint a few codes, verify the invite-link flow end-to-end in an incognito window.
- Once smoke test passes, promote to `yunhai.io` and start sending links.
- Rotate Google OAuth secret + `.gitignore` the `client_secret` file (deferred from prior sessions).
