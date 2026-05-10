# Current State

_Last updated: 2026-05-10_

## Objective
Auto-arrange Distance Matrix usage cut by ~5.7× via single-mode-with-fallback + symmetric pair dedup. Hard 2000-pair circuit breaker prevents another runaway request day. The user must still set Console-side quota caps and budget alarms — code can't enforce those.

## Active Workstream
Pending user-side operational steps in Google Cloud Console:
1. Distance Matrix API → Quotas → set Elements/day to ~5000 (hard stop; requests beyond return 429 instead of charging).
2. Billing → Budgets & alerts → $20/month threshold with 50/90/100% email alerts.

Also pending: smoke test of the slimmer matrix on the same 60-activity Tokyo trip. Expected first-run Distance Matrix calls ≤1900; second run on same trip ~0 (cache hits).

## Constraints
- Distance Matrix free tier exhausted; per-call billing is now active. Code cap (`MAX_PAIRS_PER_REQUEST = 2000`) is the inner ring; Console quota cap is the outer ring.
- 91/91 tests passing.

## Risks
- Per-leg `/api/commute` endpoint still uses 3-mode call; UI commute pills could rack up calls if a user opens many trips. Lower volume than the matrix endpoint but worth watching.
- If transit returns no result for many pairs in a low-coverage city, the driving fallback fires and undoes some of the savings. Average-case still 1× per pair; worst case 2×.
- Single-mode means Sonnet may get transit time when driving would have been faster (suburban late-night). Buffer over-allocation is benign; revisit if schedule quality drops.

## Next Actions
- Set Console quota cap and budget alarm.
- Smoke test arrange on Tokyo trip; confirm call count ≤1900 on first run.
- Long-term consideration: activity-ID-based memoization layer if cache hit rate observed to be low.
