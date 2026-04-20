# Open Items

## [2026-04-20] Phase 3 — Finalize Modal implementation

**Status:** Deferred
**Description:** Finalize button is visible and enabled when verified/fixed activities exist, but clicking it shows a "coming soon" toast. Phase 3 must implement the Finalize Modal: activity list with lock toggles, inline time editing, live overlap validation, `lockedActivities` server payload, `ALREADY OCCUPIED` prompt injection, lock icons on arrange cards, and drag protection.
**Context:** Plan spec in `PROJECT_NOTES/arrange_phase3_locks.md`. Save-button plan (this branch) provides the hook point (Finalize button) and data source (verified checklist items persist correctly). Phase 3 wires up the modal and lock semantics.
**Next action:** Implement Phase 3 on a new branch after this branch is deployed and smoke-tested.

---

## [2026-04-19] Apply for GetYourGuide Partner API when traffic hits 100k monthly

**Status:** Deferred
**Description:** The Basic GetYourGuide Partner API exposes real tour prices and availability but requires 100k monthly visitors to qualify. Revisit once traffic approaches that threshold.
**Context:** We currently link out to the public GetYourGuide search URL from tour/attraction cards instead of showing a fabricated price. The affiliate link is functional and monetized, but a real price on the card would be a better UX.
**Next action:** Check analytics monthly; when monthly unique visitors cross ~80k, begin the Partner API application so it is approved before we hit the gate.

---
