# Open Items

## [2026-05-18] Backend never validates locked-vs-locked overlaps on logistics days

**Status:** Deferred
**Description:** Three latent bugs surfaced while diagnosing the arrival/accommodation visual overlap, none of which caused that bug but all of which are real:
1. `src/services/arrangeTimeAdjuster.js:61–66` — `byDate` is built from LLM placements only. A day containing only locked anchors is silently skipped (no `ADJUSTER_DAY_START` log line).
2. `src/arrangeValidator.js:75–120` — outer loop iterates `byDate` (placements). Locked-vs-locked overlap on the same date is never checked; only flexible-vs-locked is.
3. Arrival flights and hotel check-ins live in `city.logistics` / `state.commutes`, are rendered as logistics cards only, and are never sent to `/api/arrange` as `lockedActivities`. The Finalize modal's `findLockedOverlaps` also can't see them.
**Context:** Surfaced during investigation of the 2026-05-18 logistics-card overlap fix. Data integrity bug separate from the visual fix that was shipped.
**Next action:** Decide whether arrival/departure/lodging should become first-class locked activities (preferred) or whether the validator/adjuster should iterate over `days[].date` regardless of placements and treat city.logistics times as additional locked anchors.

---

## [2026-04-19] Apply for GetYourGuide Partner API when traffic hits 100k monthly

**Status:** Deferred
**Description:** The Basic GetYourGuide Partner API exposes real tour prices and availability but requires 100k monthly visitors to qualify. Revisit once traffic approaches that threshold.
**Context:** We currently link out to the public GetYourGuide search URL from tour/attraction cards instead of showing a fabricated price. The affiliate link is functional and monetized, but a real price on the card would be a better UX.
**Next action:** Check analytics monthly; when monthly unique visitors cross ~80k, begin the Partner API application so it is approved before we hit the gate.

---
