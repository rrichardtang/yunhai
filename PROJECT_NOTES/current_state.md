# Current State

_Last updated: 2026-04-12_

## Objective
Improve the Decline button UX — require feedback before declining, generate a replacement activity, and capture learnable preference signals.

## Active Workstream
Shipped decline-with-feedback feature:
- Decline button now reveals an inline feedback form (textarea, maxlength 200, Cancel + Replace Activity)
- On submit: calls new `/api/activity/replace` → generates one replacement activity via claude-haiku-4-5
- LLM response includes `signals[]` array (same schema as concierge bot) — learnable signals written via `processChatSignals()`
- Non-learnable decline reasons (one-off/situational) produce empty signals array — not persisted
- `normalizeActivity` and `SYSTEM_PROMPT` exported from `src/claude.js` for reuse in new endpoint

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access

## Risks
- Concurrent writes from two devices could overwrite each other (last-write-wins)
- Brave price parsing relies on regex against snippets — may miss prices in non-standard formats
- LLM cost estimates are rough; Brave validation helps but neither source is authoritative

## Next Actions
- Test on VPS: verify replacement activities generate correctly, signals persist to user profile
- Add token refresh flow and graceful retry on expired Google access tokens
- Consider caching Brave search results to stay within free tier (2000 req/month)
