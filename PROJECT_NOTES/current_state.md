# Current State

_Last updated: 2026-04-12_

## Objective
Polish step 1 UX — trip modification detection and regeneration prompt.

## Active Workstream
Shipped regenerate confirmation popup:
- `step1Fingerprint()` now includes `budget` and `travelers` (read from DOM) alongside cities/travels
- When Next is clicked on step 1 with existing activities and a changed fingerprint, shows "Trip modified — regenerate?" dialog
- "No, keep existing" navigates to step 2 with old results; "Yes, regenerate" proceeds to re-plan
- Dialog is a promise-based modal; backdrop click dismisses as "No"

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access

## Risks
- Concurrent writes from two devices could overwrite each other (last-write-wins)
- Brave price parsing relies on regex against snippets — may miss prices in non-standard formats
- LLM cost estimates are rough; Brave validation helps but neither source is authoritative

## Next Actions
- Test on VPS: verify regenerate dialog fires correctly on budget/travelers/city/date changes
- Add token refresh flow and graceful retry on expired Google access tokens
- Consider caching Brave search results to stay within free tier (2000 req/month)
