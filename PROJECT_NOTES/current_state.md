# Current State

_Last updated: 2026-08-07_

## Objective
Ship branch `claude/guide-me-setup-stuck-mszkyo` — the Setup → Review fixes from a reported
"stuck" plan on a 2-city Yunnan trip: per-phase plan progress, image sourcing rework, graceful
no-hotel planning, per-city failure isolation, plus a model bake-off harness that gates the
`planCity` model decision. Three earlier branches remain complete but undeployed
(`claude/yunhai-url-endpoints-t6a3ja`, `claude/budget-optimization-loading-screens-4hc6a3`,
`claude/codebase-review-sweep-2z6t4h`).

## Active Workstream
Four commits on `claude/guide-me-setup-stuck-mszkyo`, 202/202 unit tests (up from 176):

1. Plan progress — `city_start`/`phase` SSE events + 15s heartbeat; the loader counts 4 steps per
   city instead of whole cities. Also removes the prose `<p>` from the review nav pill.
2. Images — venue's own Google Places photo first, per-city Unsplash pool second. Per-activity
   keyword search is gone.
3. No-hotel planning — `accommodation`/`accommodations` shape fix, city-coordinate fallback for
   the Places bias and the inter-city leg, transfer day derived from the real `leaveTime`, and
   per-city failure isolation via `city_error`.
4. Bake-off — injectable `generate` seam on `planCity` and `scripts/planCityBakeoff.js`.

## Constraints
- `planCity` stays on `claude-sonnet-4-6` until the bake-off reports. Do not migrate on spec
  comparison — GPT-5.6's output ceiling and pricing are unconfirmed, and Sonnet 5's adaptive
  thinking shares the `max_tokens` budget with its response (benchmarking it at today's 32768
  would measure truncation).
- Places photo-media lookups are billed (~$7/1000). `placesCache` amortises them; watch the line
  item after deploy.
- `PLAN_PHASES_PER_CITY` (client) must stay equal to the number of progress-emitting events per
  city on the server (3 phases + the `city` event). Adding a phase means changing both.
- Frontend stays a monolith (`public/app.js`); all `innerHTML` goes through `esc()`, and
  `dataset.*` reads must be re-escaped.
- Identity is never taken from request body/query — always `getAuthedUserId(req)`.
- `STEP_SLUGS` is duplicated in `src/server.js` and `public/app.js` and coupled to the
  `#stepIndicator` tabs in `planner.html`.
- Staging/prod deploy discipline unchanged: `deployment/promotion.sh` only; split env files.

## Risks
- Nothing on this branch has run against live LLMs, Brave, Places or Unsplash — this container has
  no API keys. The deterministic parts are unit-tested and the SSE/image/transfer paths were
  verified against stubs, but real-provider behaviour is unproven.
- The Unsplash pool assumes `results[].tags` and `alt_description` are populated well enough to
  score against. If they are sparse for a city, matching degrades to "any city photo" — still
  better than the placeholder, but the type hints stop earning their keep.
- Existing `placesCache` entries are refetched once on first touch after deploy (detected by the
  missing `photoName` key), so the first plan after release does more Places calls than steady state.
- (Carried over) `GOOGLE_MAPS_API_KEY` rotation + `EMAIL_WEBHOOK_SECRET`/`OWNER_USER_ID` env setup
  still pending; memory-layer / arrange-overhaul / grounding keyed verifications still outstanding.

## Next Actions
- Push the branch and deploy behind the three queued branches.
- Post-deploy, keyed: replan the Yunnan trip and confirm the EventStream shows `city_start`/`phase`
  within seconds with no silent gap >15s, the bar advances 8 times, cards show venue photos, and
  `GET /debug?scope=unsplash` shows ~3 pool queries per city instead of ~36.
- Run `node scripts/planCityBakeoff.js` in a keyed env, then write the migration plan from its
  numbers. Confirm GPT-5.6's max output tokens and JSON-schema support first — either can
  disqualify it before any code.
- Then resume the sweep-branch ops follow-ups and the queued keyed verifications.
