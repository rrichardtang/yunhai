# Current State

_Last updated: 2026-05-12_

## Objective
Distance Matrix cost cut from ~$9 → ~$2 per first-arrange of a 60-activity trip via Haversine pre-filter (<1.5 km skip), geographic clustering with centroid pairs (~2 km radius), 1-year cache TTL, and per-leg pills re-enabled live during drafting. Sonnet keeps real commute data flowing into the arrange prompt.

## Active Workstream
Smoke test the new matrix on a fresh 60-activity Tokyo trip. Expected:
- First arrange: ~300 matrix calls + ~150 per-leg = ~450 total (~$2)
- Repeat arrange: ~0 (cache hits)
- 20 drags on finalized schedule: ≤60 new calls

User-side ops still pending:
1. Distance Matrix API → Quotas → Elements/day ~5000 (hard 429 stop)
2. Billing → Budgets & alerts → $20/month with 50/90/100% emails

## Constraints
- Distance Matrix per-call billing active (free tier exhausted).
- Inner ring: `MAX_PAIRS_PER_REQUEST = 2000` now applied to combined intra + inter cluster pair count.
- 91/91 tests passing.

## Risks
- Greedy first-fit clustering is order-dependent. If activities arrive in a weird order the clusters may be slightly suboptimal; cost still bounded, quality impact minor.
- Inter-cluster pair uses first member as representative — if first member is at the edge of its cluster the centroid estimate skews. Acceptable for the cost savings.
- Per-leg pills fire on every drag/drop; cache hit rate observed in production will determine real cost.

## Next Actions
- Smoke test arrange on Tokyo trip; capture clusters count, intra/inter pair counts, total call count.
- Confirm `🚶 walk` pill renders for sub-1.5 km pairs with zero API calls.
- Set Console quota cap and budget alarm.
