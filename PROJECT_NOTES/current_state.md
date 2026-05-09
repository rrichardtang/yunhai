# Current State

_Last updated: 2026-05-08_

## Objective
Right-size activity generation count and audit both the generation and arrange prompts. Generation now targets ~63 activities for a 9-day pace-4 trip (was 72 floor with no ceiling) with lunch + dinner as the only generated meals. Both prompts stripped of legacy noise (Decision Framework table, `verdict`/`start_location`/`end_location`/`duration` string/`dedicated_time_block` fields, "look harder for a fit" overcorrection).

## Active Workstream
Pending user smoke test on a fresh trip:
- Plan 9-day Tokyo, pace=4, shopping=4. Expect activity count in 60–75 range, no `type: "breakfast"` items, shopping activities counted within (not on top of) the non-meal target.
- Auto-arrange the result. Expect placements non-empty, >85% of activities placed, unplaced reasons constrained to the closed enum.
- Visual check: activity cards no longer show LLM verdict badge; placed-card tooltip drops Verdict/Start/End rows.

## Constraints
- No database — flat JSON files.
- Brave free-tier quota; no new always-on calls in this wave.
- 90/90 tests still green; no test changes required (counts are config values, not asserted).

## Risks
- Sonnet may occasionally still emit `start_location`/`end_location`/`verdict` from prompt-cache momentum on cached system prompts. The read-side `normalizeActivity` tolerates them gracefully but they'll be dropped in the v2 normalized output.
- Calendar export for old itineraries now reads `location.address || venue_name` first; if those are empty (very old data), still falls through to legacy fields.

## Next Actions
- User smoke test of the slimmer plan + arrange flow.
- On approval, commit and push.
