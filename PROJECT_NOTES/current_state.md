# Current State

_Last updated: 2026-04-12_

## Objective
Improve API throughput and scalability for multi-user load.

## Active Workstream
Shipped LLM concurrency improvements:
- City planning now runs up to 3 cities in parallel per request (was sequential)
- Global semaphore caps total in-flight Anthropic calls at 10 across all users
- ROADMAP.md updated with job queue plan (BullMQ + Redis) for 100+ user scale

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access

## Risks
- Concurrent writes from two devices could overwrite each other (last-write-wins)
- Brave price parsing relies on regex against snippets — may miss prices in non-standard formats
- Global semaphore is in-memory — resets on server restart, no cross-process coordination if multi-instance

## Next Actions
- Test on VPS: verify parallel city generation works correctly end-to-end
- Add token refresh flow and graceful retry on expired Google access tokens
- Consider caching Brave search results to stay within free tier (2000 req/month)
