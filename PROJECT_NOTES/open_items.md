# Open Items

## [2026-08-08] Verify the GPT-5.6 switch on a keyed environment before it reaches users
**Status:** Pending input (needs deploy)
**Description:** `planCity` now runs `gpt-5.6` with `SYSTEM_PROMPT_GPT_LEAN` (decisions
[2026-08-08]). The arm is well measured through the bake-off harness, but the harness injects its
own `generate` — so `openaiGenerator()`, the function production actually calls, has never run.
Two things are new and untested end to end: the OpenAI call inside the real `/api/plan` request
(under the shared LLM semaphore, three cities in parallel), and the `OPENAI_KEY_MISSING` error
branch that replaced `ANTHROPIC_KEY_MISSING`.
**Context:** changelog [2026-08-08] "Production planning switched to GPT-5.6". `OPENAI_API_KEY` was
already required for chat and refine, so a correctly configured environment needs no new secret —
but an environment that had only `ANTHROPIC_API_KEY` working will now fail to plan at all rather
than degrading.
**Next action:** **Check `OPENAI_API_KEY` in both env files before promoting** — staging reads
`/docker/travelplanner/.env`, prod reads `/docker/travelplanner/.env.prod`, so a green staging check
proves nothing about prod, and `promote` deletes the feature branch as it runs:
`grep -c '^OPENAI_API_KEY=..*' /docker/travelplanner/.env /docker/travelplanner/.env.prod` — both
must be 1. Then confirm status and replan the Yunnan trip. Neither compose file publishes a port
(Traefik routes by host to 3457 *inside* the container), so `localhost:3457` from the host never
answers: use `docker exec travelplanner-staging-travelplanner-1 curl -s localhost:3457/api/status`
or the staging hostname. Check `GET /debug?scope=plan-city` shows `model=gpt-5.6` and a `RETURN` per
city. Separately, unset `OPENAI_API_KEY` in a scratch env and confirm `/api/plan` emits the typed
`OPENAI_KEY_MISSING` event rather than a generic failure.

## [2026-08-07] Verify the Setup → Review fixes against live providers
**Status:** Pending input (needs deploy)
**Description:** The plan-progress stream, image ladder, transfer-day timing and per-city failure isolation are unit-tested (202/202) and verified against stubs, but no part of this branch has touched a real LLM, Brave, Places or Unsplash.
**Context:** changelog [2026-08-07]. Branch `claude/guide-me-setup-stuck-mszkyo`.
**Next action:** After deploy, replan the Yunnan trip: (1) EventStream shows `city_start`/`phase` within seconds, `: ping` every 15s, no silent gap >15s, bar advances 8 times; (2) cards show venue photos for meals/museums/landmarks and matched pool images elsewhere — `GET /debug?scope=places-fetch` for `photo=yes`, `GET /debug?scope=unsplash` for ~3 pool queries per city and no `rate limit hit`; (3) `GET /debug?scope=plan-city` shows `elapsed_ms` per city to confirm where the time actually goes; (4) confirm no activities land on 2026-10-13 in both cities.

## [2026-08-07] Watch the Google Places photo-media cost line
**Status:** Deferred
**Description:** Adding `places.photos` to the field mask plus a `/media` resolve per venue introduces a billed lookup (~$7/1000) where images were previously free via Unsplash. A 66-activity plan is roughly $0.50 before caching.
**Context:** decisions [2026-08-07]. `placesCache` (90-day TTL) amortises replans, and the first plan after deploy refetches every previously cached venue once because old entries lack the `photoName` key.
**Next action:** Check the Places billing line after a week of real traffic. If it is material, cap photo lookups to `VENUE_TYPES` only, or resolve photos lazily on card render rather than during planning.

## [2026-07-30] Shared `/trip/:id` links still require the recipient to sign in
**Status:** Pending input (product decision)
**Description:** `/trip/:id` now resolves to the planner shell and the client loads the itinerary from the pre-auth `GET /api/public/itinerary/:id`, but a signed-out recipient never gets that far: `init()` awaits `initClerkAuth()` first, which calls `openSignIn()` and throws "Authentication required" before `maybeLoadSharedItineraryFromUrl()` runs. The `hasShareLink` bypass only skips the *entitlement* check, not the Clerk sign-in — so share links work for any signed-in user (entitled or not) and nobody else.
**Context:** Pre-existing, not introduced by the URL work; surfaced while verifying it (changelog [2026-07-30]). The read-only view and public API are already anonymous-safe, so the plumbing is there. Changing the auth gate is a security-relevant decision, deliberately left out of the URL change.
**Next action:** Decide whether share links should be truly public. If yes: skip `initClerkAuth()` (or run it non-blocking) when the path matches `/trip/:id`, and confirm the read-only view degrades cleanly without a Clerk session — the topbar, chat widget, and save buttons all assume one.

## [2026-07-30] Verify clean URLs on the VPS after deploy
**Status:** Pending input (needs deploy)
**Description:** Routes and redirects are verified locally (curl + Playwright 15/15), but not behind Traefik with real Clerk keys. Two things only a keyed environment can prove: (1) Clerk's sign-in redirect round-trip lands back on `/plan/...` (it uses `window.location.href`, so it should, but the allowed-redirect settings in the Clerk dashboard may reference the old URL); (2) the full share-link render for a signed-in non-owner.
**Context:** changelog/decisions [2026-07-30]. Branch `claude/yunhai-url-endpoints-t6a3ja`.
**Next action:** After deploy: hit `https://yunhai.io/planner.html` → expect 301 to `/plan`; click through all four steps watching the address bar; sign out and back in from `/plan/review`; paste a `/trip/<id>` link into a second signed-in account. Check the Clerk dashboard's allowed redirect origins/paths if sign-in bounces.

## [2026-07-07] Verify budget-opt cost fix + loaders against live LLMs
**Status:** Pending input (needs API keys)
**Description:** The refine cost-shape normalization, meter recompute, and the three new interactive loaders are unit-tested (176/176) and Playwright-verified against stubbed responses, but the live OpenAI refine / Anthropic replace+arrange paths are unproven in this keyless container.
**Context:** decisions [2026-07-07]; changelog [2026-07-07]. Branch `claude/budget-optimization-loading-screens-4hc6a3`.
**Next action:** In a keyed env: (1) set a trip budget, optimize, accept alternatives → meter drop matches the overlay's flip-phase savings; (2) confirm a real refine response lowers the displayed card cost for both nested-cost and legacy activities; (3) eyeball loader pacing on real latencies (budget-opt N-of-M, arrange milestones, replace).

## [2026-07-03] Post-sweep ops follow-ups: rotate exposed Maps key, set new required envs
**Status:** Pending input (owner/ops)
**Description:** The sweep branch closed the leaks, but two ops actions remain: (1) rotate `GOOGLE_MAPS_API_KEY` — until this deploys it was returned verbatim by the unauthenticated `/api/status`, so treat it as exposed; add referrer/IP restrictions on the new key. (2) On deploy, ensure `EMAIL_WEBHOOK_SECRET` (email ingest now 503s without it) and `OWNER_USER_ID` (gates `/debug` and `/api/admin/*`; `ADMIN_TOKEN` is retired) are set in both env files.
**Context:** decisions [2026-07-03]; changelog [2026-07-03]. Branch `claude/codebase-review-sweep-2z6t4h`.
**Next action:** Rotate the key in Google Cloud console, update `.env`/`.env.prod`, verify arrange-stats works with the owner account, then deploy the branch.

## [2026-07-03] Encrypt Google OAuth refresh tokens at rest
**Status:** Deferred
**Description:** `data/google-calendar-tokens.json` stores users' Google refresh tokens as plaintext JSON. Out of scope for the clean sweep (needs a key-management decision), but a refresh token is a long-lived credential to the user's calendar.
**Context:** Flagged during the 2026-07-03 review. `calendarSync.js` already imports `crypto`.
**Next action:** Pick an approach (env-key AES-GCM at minimum) and migrate the existing token file.

## [2026-04-19] Apply for GetYourGuide Partner API when traffic hits 100k monthly

**Status:** Deferred
**Description:** The Basic GetYourGuide Partner API exposes real tour prices and availability but requires 100k monthly visitors to qualify. Revisit once traffic approaches that threshold.
**Context:** We currently link out to the public GetYourGuide search URL from tour/attraction cards instead of showing a fabricated price. The affiliate link is functional and monetized, but a real price on the card would be a better UX.
**Next action:** Check analytics monthly; when monthly unique visitors cross ~80k, begin the Partner API application so it is approved before we hit the gate.

---

## [2026-05-28] Verify agent-memory layer end-to-end in a keyed environment

**Status:** Pending input (needs API keys)
**Description:** The memory layer (`src/memory/`) is built, unit-tested (113/113), and boots clean, but the live LLM path is unverified because this container has no API keys.
**Context:** `observe()` runs a Haiku reconciliation call; `recall()` is LLM-free. Reconciliation (ADD/UPDATE/DELETE) only exercises with a real Anthropic key.
**Next action:** In a keyed env: (1) state a preference in chat → confirm a record is written and appears in a later plan/arrange prompt; (2) state a contradicting preference → confirm reconciler UPDATEs/DELETEs instead of duplicating; (3) decline an activity with a note → replacement reflects memory; (4) confirm `/api/activity/refine` now reflects memory.

---


## [2026-06-10] Verify the Arrange REDESIGN on the VPS
**Status:** Pending input
**Description:** `feature/arrange-reliability-thinking` now carries the full redesign (LLM `assign_days` → deterministic `arrangeScheduler.js`). Deterministic core is proven locally (126/126 tests). Unverified end-to-end because local server isn't run. On the VPS: (1) run the dense Kyoto 18+4 / multi-meal trip; in arrange debug logs confirm `ASSIGN_CALL` → `LLM_RESPONSE finish=tool_use tool_use=true` (fast, ~one call), `SCHED_DAY` lines per day, and NO `SCHED_ASSERT_FAIL` (validator self-check passes); (2) `GET /api/admin/arrange-stats?limit=200` → `placedPct` near 100 (vs old ~67%), low `avgUnplacedPerRun`, `mealRedistributedTotal` firing; (3) eyeball the Arrange UI — no overlaps, meals in lunch/dinner windows, geographically coherent days. A drop should only occur for genuine over-subscription (more meals/activities than a day can hold).
**Context:** decisions [2026-06-10]; changelog [2026-06-10]. The LLM now only assigns days — if days look geographically incoherent, that's an LLM-assignment-quality issue (tune the prompt), NOT a time/violation issue (those are structurally impossible now).
**Next action:** Owner deploys the branch and runs the dense case + arrange-stats.

## [2026-06-09] Missing commute pairs from Google distance-matrix (transit ZERO_RESULTS)
**Status:** Deferred
**Description:** Arrange logs show `live_fail=25` and repeated `[dm] element-status=ZERO_RESULTS mode=transit` — some venue pairs return no transit duration, so the adjuster falls back to a 10-min walking assumption and the LLM schedules without real commute data for those pairs. Orthogonal to the LLM scaffolding work; affects scheduling accuracy.
**Context:** Surfaced in the same Kyoto run analyzed for the reliability levers. Likely needs a mode fallback (transit→driving/walking) or caching of a coarse fallback estimate in `distanceMatrix`/commute-matrix services.
**Next action:** Investigate distance-matrix mode fallback when transit returns ZERO_RESULTS.

## [2026-07-01] Verify grounded activity-add / replace-retry / refine-enrichment in a keyed environment
**Status:** Pending input (needs API keys)
**Description:** The mobile-UI feedback branch reworked activity grounding: new `POST /api/activity/add` (Places resolve gate → LLM fill with verbatim name → `groundActivityToPlace`), one retry on the replace path when the suggested venue doesn't resolve, and refine re-enrichment on rename. Deterministic parts are unit-tested (`src/activityAdd.test.js`) and the UI flows Playwright-verified, but the live Places + Anthropic paths are unproven in this keyless container.
**Context:** Fixes the reported Sisterita substitution / hallucinated-address / Muir Woods→Sausalito bugs. decisions [2026-07-01]; changelog [2026-07-01]. Branch `claude/mobile-ui-feedback-eqx6he`.
**Next action:** In a keyed env: (1) add "Sisterita" (San Francisco) → canonical name kept, real address, map pin resolves; (2) add a gibberish name → inline modal error, no LLM call (check debug log `activity-add REJECT reason=place_not_found`); (3) decline→replace toward an unresolvable venue → `activity-replace RETRY` then coords or `unverified:true`; (4) refine that renames a venue → coords/opening hours refreshed.

## [2026-07-02] Verify the arrange overhaul live (VPS) + locked-pair commute follow-up
**Status:** Pending input (needs keys/VPS)
**Description:** The server-authoritative endTime contract, meal rescue pass, and commute-honesty changes are unit-tested (160/160) and Playwright-verified against canned responses, but not against a live LLM+Google run. Also deferred: budgeting commute to/from LOCKED activities — requires the client to send lock coords and include locks in the `/api/commute-matrix` request (absent today, app.js lockedActivities payload), so locks currently get obstacle collision-avoidance only.
**Context:** decisions [2026-07-02]; changelog [2026-07-02]. Supersedes the live-verification checklist of the 2026-06-10 redesign item (endTime now expected in placements).
**Next action:** On VPS: dense-city arrange → `SCHED_DAY` per day, no `SCHED_ASSERT_FAIL`, `SCHED_MEAL_RESCUE` firing where applicable; `GET /api/admin/arrange-stats` populated (telemetry now observable); `[dm]` logs show walking-sourced recoveries where transit+driving ZERO_RESULT; watch `droppedByReason.no_time_slot_remaining` for regressions from honest-but-large haversine commutes.

## [2026-08-08] Take deterministic work out of the plan prompt
**Status:** Pending input (plan written, not started)
**Description:** The plan prompt asks the model for fields code overwrites (`opening_hours`,
`cost_type`, `booking_type`, `city`) and states rules code already enforces (venue dedupe, name
prefixes). `applyMealPoolCap` deleting all 12 of GPT-5.6's Lijiang restaurants was one instance of
that class. Phase 2 sources meals from activity coordinates via a Places cluster search instead of
from the model's memory, which makes the hour-away restaurant unselectable rather than forbidden.
**Context:** `PROJECT_NOTES/plan-deterministic-prompt-split.md`. Owner principle: if deterministic
logic covers it, it does not belong in the prompt at all.
Phase 1B addresses the ~1,150 Places requests across four runs: a miss costs two calls (search +
photo media) and the cache is keyed on the model's prose, so it almost never hits.
**Next action:** Phase 1A (mechanical, self-contained), then Phase 1B step 0 — a free measurement
over the 300+ saved venue names that decides whether the normalise and alias layers are worth
building — then Phase 2.
