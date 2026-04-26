# Current State

_Last updated: 2026-04-26_

## Objective
Phase 5 (arrange polish) implemented on `feature/arrange-polish`: intensity alternation prompt rule, repair-pass telemetry + admin stats endpoint, Distance Matrix file-backed cache, unplaced-activity recovery chip/panel UI.

## Active Workstream
Pending user smoke test of Phase 5 changes:
- Run auto-arrange on a multi-activity city and confirm that `data/commute-cache.json` is created and a re-run is noticeably faster.
- Trigger an unplaceable scenario (e.g. too many of one category) and verify the "Unplaced (N)" chip appears, opens to a panel, and clicking an item scrolls + flashes the staging card.
- Verify `logs/arrange.jsonl` accrues per-call entries; if `ADMIN_TOKEN` is set, `GET /api/admin/arrange-stats?token=...` returns a summary.

## Constraints
- No database — flat JSON files (cache uses same pattern)
- All `/api/*` route paths preserved; arrange request/response shape unchanged
- 99/99 tests passing

## Risks
- Commute cache is keyed by the resolved origin/destination string (coords or text). If activity location text changes, the old key becomes orphaned but TTL-expires harmlessly.
- Telemetry log grows unbounded — `readRecent` reads the whole file. Acceptable for low traffic; rotate if it grows >5MB.

## Next Actions
- User smoke test of Phase 5.
- If green, merge `feature/arrange-polish` to main.
- Phase 4 cleanup item still open: delete unused `src/services/arrangePrompt.js` after Phase 4 smoke test confirmation.
