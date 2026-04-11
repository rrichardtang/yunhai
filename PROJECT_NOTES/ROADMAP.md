# ROADMAP

## Now
- Shipping the **Robust Calendar & Sync Mode MVP** for low-noise calendar export.
- Active build focus:
  - Metadata toggle support (compact/full) in calendar export flow.
  - ICS export metadata mode via `?metadata=compact|full`.
  - Google Calendar one-way sync with OAuth endpoints and token persistence.
  - Pre-sync conflict detection against existing Google events.
  - Dedupe-safe sync mapping to prevent duplicate event creation per itinerary item fingerprint.

## Next
- Add refresh-token flow and graceful retry handling for expired Google access tokens.
- Add selective sync scope controls (city/date filters).
- Add per-item conflict resolution UI in sync flow.
- Add tests for calendar item fingerprint stability and sync dedupe behavior.

## Hosting & Infrastructure
- **Current:** Self-hosted VPS with Docker + Traefik, env vars via `.env` file.
- **Next:** Migrate to Railway — deploys from GitHub, env vars in dashboard, persistent volume at `/app/data`, no PM2 needed. ~$5/mo. Render is fallback (free tier but spins down).
- **Later:** Replace flat-file `data/` storage with a real DB. Options in order of effort:
  1. **Turso** — SQLite over the network, closest to current flat JSON semantics, minimal code change.
  2. **Supabase** — Postgres with dashboard, more powerful, slightly more setup.
- **Eventually:** Custom domain behind Cloudflare (free SSL, CDN, DDoS protection). Move Google Calendar token storage into DB.

## Auth
- **Current:** Clerk (`@clerk/express`) with Google social sign-in via shared Clerk OAuth credentials.
- **Later:** Switch to custom Google OAuth credentials in Clerk dashboard for production (create OAuth 2.0 Client ID in Google Cloud Console, set redirect URI to Clerk's callback URL).
- Add token refresh flow for Google Calendar OAuth (expired tokens currently require full reconnect).

## Calendar Sync
- **Current:** One-way sync, conflict pre-check (warns, doesn't block), dedupe-safe fingerprinting.
- **Planned:** Token auto-refresh, selective sync by city/date, per-item conflict resolution UI.

## Later
> **Group & Family Collaboration Suite**
> Multi-user collaboration: editable itineraries, family templates (pacing/kid-friendly POIs), cost-splitting, and read-only public share links that don't require sign-up. Role-based permissions (owner/editor/viewer).
> Hold: complexity in conflict resolution, permission scoping, and public link security. Revisit once core product is solid.

> **Shared Knowledge Store (cache layer for Brave search)**
> A flat-JSON cache (`data/knowledge/{city}.json`) that accumulates city activity data across requests. Sits between `planCity()`/chat concierge and Brave — serves cached results when fresh, calls Brave when stale. ~100 lines in `src/knowledgeStore.js`, follows atomic write pattern from `itineraryStore.js`. Freshness TTL (60 days) controls Brave re-calls; prune TTL (180 days) deletes unused files.
> Revisit when: Brave free tier cap (2000/month) is regularly hit, city overlap is common enough that cache hits improve results, or Brave latency (~500ms/call) becomes a UX problem.

> **Other longer-term features**
> - Mobile app — React Native or PWA promotion (service worker already in place)
> - Richer booking ingest — improve heuristic email parser for edge-case confirmation formats
> - Export to PDF — printable trip summary beyond ICS
