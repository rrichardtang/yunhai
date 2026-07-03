# Open Items

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
