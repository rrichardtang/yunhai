# Open Items

## [2026-08-07] Run the planCity model bake-off and decide Sonnet 5 vs GPT-5.6
**Status:** Pending input (needs a staging run)
**Description:** The harness has run the Sonnet 4.6 control twice and produced the baseline economics, but no other arm has ever run. `planCity` stays on `claude-sonnet-4-6` until the matrix reports.
**Context:** decisions [2026-08-07], [2026-08-08]. Baseline: 6.26/6.07 sec per activity, $0.00542/$0.00537 per activity, $0.35 per 2-city trip, all linear in activity count with no fixed overhead. Because splitting the call is a ~3x speed lever against a faster model's ~30%, the decision rests on quality and cost, not speed. Two GPT-5.6 facts are still unconfirmed and either disqualifies it: max output tokens (a 36-activity array is ~12k) and `response_format: {type: "json_schema"}` support, which decides whether the parse-retry can be deleted as `output_config.format` would on Sonnet 5. Sonnet 5 is $3/$15 with an introductory $2/$10 through 2026-08-31 and must be benchmarked above 32768 `max_tokens` because adaptive thinking shares that budget.
**Next action:** Re-run the unsplit baseline with the `venue_name` fix, settle `dedupeByVenue` from it, then A/B `--split 2`, then `--arms gpt-5.6 --runs 1` to settle the output ceiling empirically, then the full matrix. Decide on `distinct%` / `ghost` / `meal res%` first and `sec/act` / `$/act` second; read the per-arm lists blind before trusting the table. A tie goes to Sonnet 5 (model-ID swap vs re-tuning SYSTEM_PROMPT for another family).

## [2026-08-08] Decide whether `dedupeByVenue` survives
**Status:** Pending input (needs the post-fix baseline)
**Description:** `dedupeByVenue` collapses activities that ground to the same coordinate. On the run that introduced it, it dropped 5 of 35 Lijiang and 10 of 32 Shangri-La activities, taking delivered counts below target (30/36, 22/30). Most of those collisions were artifacts of the label-lookup bug rather than real duplicates.
**Context:** decisions [2026-08-08]. The surviving true positives split into two kinds: the same place sold three times under three names (Pudacuo National Park), and genuinely different times at one venue (Dukezong morning vs evening), which should not collapse.
**Next action:** Read the post-fix baseline's drop list. If it is near-empty, the function is dead weight. If it still fires, decide whether keying on coordinates alone is right or whether time-of-day has to be part of the key.

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
