# Current State

_Last updated: 2026-05-29_

## Objective
Roll out YunHai to a small private beta. Distribute access via magic invite links; manage codes from the browser admin page (`/admin.html`, owner-only). Production is `yunhai.io`.

## Active Workstream
Branch `feature/clerk-server-auth`. Fixed server-side Clerk auth and hardened the admin page:
- Root cause of `userId=null`: `@clerk/express` v2 exposes `req.auth` as a function; code read it as a property. Fixed all read sites.
- Added `trust proxy` + `authorizedParties` (`CLERK_AUTHORIZED_PARTIES` env) for verification behind Traefik.
- Admin routes now use real Clerk verification (`req.auth().userId` vs `OWNER_USER_ID`), not a spoofable query param.

Verified end-to-end on staging (minting works, real userId resolves). **Awaiting promote to prod.**

## Constraints
- Staging and prod are separate deployments with split env files: staging reads `/docker/travelplanner/.env` (test Clerk instance, `pk_test_`); prod reads `/docker/travelplanner/.env.prod` (live instance, `pk_live_`). Same email → different Clerk userId per instance, so `OWNER_USER_ID` differs between them.
- `CLERK_AUTHORIZED_PARTIES` must be set per env (staging URL vs `https://yunhai.io`).
- Deploys must go through `deployment/promotion.sh` (`deploy-staging` / `promote`) — file-by-file `git checkout` does NOT restart the Node process.
- Node isn't on the VPS PATH — admin is browser-driven, not CLI.
- Clerk dev tier on staging — don't rely on Backend API invitations.

## Risks
- `data/invite-codes.json` lives on the VPS, not in git. If the data dir is wiped, all invites are lost. Worth backing up.
- `/debug` and `/debug/codes` expose internal logs / the code list. Now Clerk-gated (resolves a userId), but worth restricting to owner-only later.
- (Carried over) Google OAuth client secret was briefly exposed; should be rotated. `client_secret_*.json` should be `.gitignore`d.

## Next Actions
- `bash deployment/promotion.sh promote --yes` (ensure both checkouts clean first) → merges to `main`, redeploys prod.
- Verify on `yunhai.io/admin.html`: sign in, mint a real code, confirm the `?invite=` redeem flow in an incognito window.
- Confirm `CLERK_AUTHORIZED_PARTIES=https://yunhai.io` is set in `.env.prod` (and staging URL in `.env`).
- Once verified, start sending invite links.
- Rotate Google OAuth secret + `.gitignore` the `client_secret` file (deferred from prior sessions).
