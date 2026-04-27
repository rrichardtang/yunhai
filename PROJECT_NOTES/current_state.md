# Current State

_Last updated: 2026-04-28_

## Objective
Wave 1 of the activity-recommendation / auto-arrange / Brave-grounding audit is complete on `feature/arrange-polish`. Live opening hours from Google Places now backfill the LLM's hallucinated strings on concrete-venue categories; same-venue activity buffer is no longer triggered for back-to-back stops at one location; Brave query year is dynamic; dead `arrangePrompt.js` removed; unplaced reasons rendered with friendly labels.

## Active Workstream
Pending user smoke test of Wave 1:
- Plan Madrid (concrete-venue meal-custom test) and Tokyo (high-density opening-hours test). Confirm `data/places-cache.json` populates with `openingHours` strings on museums + restaurants and that `[places-hours-delta]` lines surface in server logs when LLM and Places hours disagree.
- Re-run a trip with two activities at the same venue (e.g., dinner + bar at the same restaurant complex). Confirm validator does not flag it as overlap.
- Verify a force-failure case still surfaces in the Unplaced panel with the friendlier "Couldn't fit into the day without conflicts" label.

## Constraints
- No database — flat JSON files.
- Same `GOOGLE_MAPS_API_KEY` powers Distance Matrix and Places Text Search; FieldMask widened to include `regularOpeningHours,location` (no new credential).
- 90/90 npm-test suite passes (88 → 90 with two new same-venue validator tests; placesEnrich test rewritten to 10 cases).

## Risks
- Places hours conversion does a union of weekday windows; day-of-week closures (e.g. museum closed Mondays) are NOT modeled — the validator may pass a Monday placement that Places marks closed. Acceptable for Wave 1; deferred to follow-up.
- Same-venue short-circuit relies on `venue_name` / address fallback when lat/lng are null at planning time. Activities without populated `venue_name` (generic "free time", "neighborhood walk") will not match on the lat/lng path and won't trigger the short-circuit — they'll continue to use the 20-min buffer, which is the safe default.

## Next Actions
- User smoke test of Wave 1 changes.
- On approval, proceed to Wave 2: commute-matrix injection into arrange prompt (top-K >25min pairs), Brave cache → 24h file-backed, tighten activity Brave grounding to mirror the restaurant "pick from this list" framing.
- Wave 3 (later): contract test for `/api/arrange` that skips when `ANTHROPIC_API_KEY` is unset.
