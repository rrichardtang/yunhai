# Current State

_Last updated: 2026-07-30_

## Objective
Ship clean public URLs (branch `claude/yunhai-url-endpoints-t6a3ja`) — no `.html` in the address
bar, per-step paths, working share links — on top of two earlier branches that are complete but
still awaiting deploy: the budget-optimization cost fix + loaders
(`claude/budget-optimization-loading-screens-4hc6a3`) and the clean-sweep branch
(`claude/codebase-review-sweep-2z6t4h`), which still carries ops follow-ups (Maps key rotation,
new required envs).

## Active Workstream
Branch `claude/yunhai-url-endpoints-t6a3ja`, complete and verified locally:
`/plan`, `/plan/setup|review|arrange|finalize`, `/trip/:id`, `/admin`, with 301s from
`/planner.html`, `/admin.html`, `/index.html` (query strings preserved). Clean routes are
registered before `express.static` and all reuse `serveWithClerkKey()`. `setStep()` now pushes a
real URL; boot clamps a deep-linked step to `state.maxStep` and corrects the URL. Fixed a live bug
where the Share-trip button emitted `/trip/<id>` that no server route handled — links landed on the
marketing page; both share paths now emit the same clean URL. 176/176 unit tests, 15/15 Playwright
checks, curl-verified route table.

## Constraints
- `STEP_SLUGS` is duplicated in `src/server.js` and `public/app.js` and its order is coupled to the
  `#stepIndicator` tabs in `planner.html` — changing the steps means touching all three.
- Embed mode (`?embed=1`) and read-only share views keep `setStep`'s null-URL behavior; only normal
  sessions rewrite the address bar.
- Frontend stays a monolith (`public/app.js`); all `innerHTML` goes through `esc()`, and
  `dataset.*` reads must be re-escaped (values come back entity-decoded).
- Identity is never taken from request body/query — always `getAuthedUserId(req)`.
- Pre-auth surface is only `/api/status`, `GET /api/public/itinerary/:id`, and the secret-gated
  email webhook. Debug/admin surfaces require `OWNER_USER_ID`.
- Staging/prod deploy discipline unchanged: `deployment/promotion.sh` only; split env files.

## Risks
- Any external link, bookmark, or Clerk dashboard setting pointing at `/planner.html` now takes a
  301. Redirects cover it, but Clerk's allowed redirect origins/paths should be checked at deploy.
- Share links remain sign-in-gated (`open_items` 2026-07-30) — the URL is clean and resolves, but
  signed-out recipients still hit `openSignIn()`. Pre-existing, now documented.
- (Carried over) Existing trips' budget meter totals shift once when the budget-opt branch deploys.
- (Carried over) `GOOGLE_MAPS_API_KEY` rotation + `EMAIL_WEBHOOK_SECRET`/`OWNER_USER_ID` env setup
  still pending before the sweep branch deploys; memory-layer / arrange-overhaul / grounding keyed
  verifications still outstanding.

## Next Actions
- Push `claude/yunhai-url-endpoints-t6a3ja`; deploy after the two queued branches.
- Post-deploy: run the VPS URL checklist (`open_items` 2026-07-30) — redirects, step navigation,
  sign-out/in round-trip, cross-account share link.
- Decide whether `/trip/:id` should be truly public (`open_items` 2026-07-30).
- Then resume the sweep-branch ops follow-ups and the queued keyed verifications.
