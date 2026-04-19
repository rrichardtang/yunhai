# Open Items

## [2026-04-17] Auto arrange arrival/departure time context

**Status:** Deferred
**Description:** Pass actual arrival/departure times in the `fixedStart`/`fixedEnd` labels of the `/api/arrange` prompt so the LLM can reason about a 2-hour buffer around the transport, not just the commute-adjusted window boundary.
**Context:** Currently `windowStart`/`windowEnd` bake in transit time but the LLM has no visibility into the raw flight/train arrival or departure time. User confirmed this is a separate fix from the Trip Health overhaul.
**Next action:** Edit `autoArrangeActiveCity()` in `public/app.js` to append arrival/departure time to the `fixedStart`/`fixedEnd` label strings before posting to `/api/arrange`.

---

## [2026-04-19] Apply for GetYourGuide Partner API when traffic hits 100k monthly

**Status:** Deferred
**Description:** The Basic GetYourGuide Partner API exposes real tour prices and availability but requires 100k monthly visitors to qualify. Revisit once traffic approaches that threshold.
**Context:** We currently link out to the public GetYourGuide search URL from tour/attraction cards instead of showing a fabricated price. The affiliate link is functional and monetized, but a real price on the card would be a better UX.
**Next action:** Check analytics monthly; when monthly unique visitors cross ~80k, begin the Partner API application so it is approved before we hit the gate.

---
