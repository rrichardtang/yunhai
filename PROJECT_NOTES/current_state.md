# Current State

_Last updated: 2026-04-27_

## Objective
On `feature/arrange-polish`: deterministic surface in arrange/activity-generation has been pruned to physics-only. The validator is the only deterministic gate; broken-day activities surface as `unplaced` for manual fix instead of being auto-placed by stale rules.

## Active Workstream
Pending user smoke test:
- Re-plan a Madrid (or similar non-American meal-custom city) trip; confirm the LLM picks dinner times that match local custom (e.g. 21:00–22:30 in Spain) rather than being forced into 18:30–22:30.
- Force a validator failure (e.g. craft two 8pm dinners on the same day, manually). Verify validator catches it, repair pass tries to fix, and on persistent failure the broken activities show in the `unplaced` panel rather than being auto-assigned by a fallback.
- Confirm `data/places-cache.json` populates with `$`–`$$$$` symbols rendering on food cards.

## Constraints
- No database — flat JSON files.
- Same `GOOGLE_MAPS_API_KEY` powers Distance Matrix and Places Text Search.
- 88/88 npm-test suite passes (down from 99 — 11 assigner tests deleted).

## Risks
- Removing the deterministic fallback means a small fraction of trips may surface activities as `unplaced` that previously got auto-placed (possibly badly). The UI handles unplaced via the existing chip/panel.
- `inferCategory` now trusts arbitrary LLM-provided category strings. Downstream consumers were checked: `placesEnrich.js` (Set membership — unknown categories silently skip enrichment, fine) and `arrangeValidator.js` (no longer reads category at all after the meal_cap/category_cap removal).
- 20-min `MIN_BUFFER_BETWEEN` retained — back-to-back same-venue activities may still flag as overlap. Acceptable for now.

## Next Actions
- User smoke test of the pruned arrange flow.
- Phase 4 cleanup item still open: delete unused `src/services/arrangePrompt.js` (dead code; no importers).
- Decide whether existing itineraries need a one-shot enrichment job to backfill price tiers.
