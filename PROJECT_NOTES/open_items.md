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


## [2026-06-09] Verify final Arrange behavior on the VPS
**Status:** Pending input
**Description:** `feature/arrange-reliability-thinking` is pushed but unverified — local server/tests are not run for this project. The branch is the FAST forced-tool design (thinking was reverted) + deterministic meal anchoring. On the VPS: (1) record BEFORE baseline from `GET /api/admin/arrange-stats?limit=200` (`firstPassValidPct`, `forceDropPct`, `topIssueTypes`); (2) run a dense case (the Kyoto 18+4 / multi-meal trip) and confirm in arrange debug logs: `SUBMIT_CALL` → `LLM_RESPONSE finish=tool_use tool_use=true` in ~10–15s (NO `REASON_PASS`, NO `finish=max_tokens`), `cache_read>0` on repair calls, `ADJUSTER_MEAL_ANCHOR` lines pinning meals to lunch/dinner, and previously-cascaded meals surviving; a meal only drops with `no_meal_slot_on_day` when genuinely over-subscribed; (3) compare arrange-stats after — expect `forceDropPct` and meal-drop count down.
**Context:** See decisions [2026-06-09] (the SUPERSEDES entry) and changelog [2026-06-09]. Thinking is intentionally gone from the interactive path; do not reintroduce it.
**Next action:** Owner deploys the branch to the VPS and runs the before/after comparison.

## [2026-06-09] Missing commute pairs from Google distance-matrix (transit ZERO_RESULTS)
**Status:** Deferred
**Description:** Arrange logs show `live_fail=25` and repeated `[dm] element-status=ZERO_RESULTS mode=transit` — some venue pairs return no transit duration, so the adjuster falls back to a 10-min walking assumption and the LLM schedules without real commute data for those pairs. Orthogonal to the LLM scaffolding work; affects scheduling accuracy.
**Context:** Surfaced in the same Kyoto run analyzed for the reliability levers. Likely needs a mode fallback (transit→driving/walking) or caching of a coarse fallback estimate in `distanceMatrix`/commute-matrix services.
**Next action:** Investigate distance-matrix mode fallback when transit returns ZERO_RESULTS.
