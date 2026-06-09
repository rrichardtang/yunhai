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


## [2026-06-09] Verify Arrange reliability levers on the VPS
**Status:** Pending input
**Description:** `feature/arrange-reliability-thinking` is pushed but unverified — local server/tests are not run for this project. On the VPS: (1) record BEFORE baseline from `GET /api/admin/arrange-stats?limit=200` (`firstPassValidPct`, `repairUsedPct`, `secondPassValidPct`, `forceDropPct`, `topIssueTypes`); (2) run a dense case (re-use the Kyoto 18+4 / 5-meal trip) and confirm in arrange debug logs: `tool_use=true` stays true (watch for prose / `ERROR msg=` from the `auto` switch or a rejected untyped param), `cache_write>0` then `cache_read>0` on a 2nd call within 5 min, a smaller first-pass `VALIDATE_FAIL count`, a 2nd `REPAIR_PASS iter=2` on hard cases, and all 5 meals surviving; (3) compare arrange-stats after — expect `firstPassValidPct` up and `forceDropPct` down.
**Context:** See decisions [2026-06-09] and changelog [2026-06-09]. If `tool_use=false` (prose) shows up in practice, add a one-shot forced-tool fallback in `callLlmForJson`. If meal/ordering drops persist, revisit the deferred deterministic reorder / meal-enforcement options.
**Next action:** Owner deploys the branch to the VPS and runs the before/after comparison.

## [2026-06-09] Missing commute pairs from Google distance-matrix (transit ZERO_RESULTS)
**Status:** Deferred
**Description:** Arrange logs show `live_fail=25` and repeated `[dm] element-status=ZERO_RESULTS mode=transit` — some venue pairs return no transit duration, so the adjuster falls back to a 10-min walking assumption and the LLM schedules without real commute data for those pairs. Orthogonal to the LLM scaffolding work; affects scheduling accuracy.
**Context:** Surfaced in the same Kyoto run analyzed for the reliability levers. Likely needs a mode fallback (transit→driving/walking) or caching of a coarse fallback estimate in `distanceMatrix`/commute-matrix services.
**Next action:** Investigate distance-matrix mode fallback when transit returns ZERO_RESULTS.
