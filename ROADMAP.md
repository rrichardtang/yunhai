# Roadmap

Strategic plans and future directions. Not a task list — see `PROJECT_NOTES/open_items.md` for active work.

---

## Hosting & Infrastructure

### Current
- Self-hosted VPS with PM2
- Env vars via `.env` file on server

### Next: Migrate to Railway
- Deploy directly from GitHub (zero config for Express)
- Set env vars in Railway dashboard (no secrets in git or on VPS)
- Mount a persistent volume at `/app/data` to preserve flat JSON storage across deploys
- Drop PM2 — Railway manages the process lifecycle
- Estimated cost: ~$5/mo at this scale
- Render is the fallback option (free tier, but spins down on inactivity)

### Later: Replace flat-file storage
The `data/` directory (itineraries, user prefs, tokens, sync state) is the main blocker for clean cloud hosting. Every redeploy risks data loss without a mounted volume.

Options (in order of migration effort):
1. **Turso** — SQLite over the network. Closest semantics to current flat JSON, minimal code change. Free tier generous.
2. **Supabase** — Postgres with a dashboard. More powerful, slightly more setup. Free tier available.

### Eventually
- Custom domain with Cloudflare in front (free SSL, CDN, DDoS protection)
- Consider moving Google Calendar token storage into the DB rather than `data/google-calendar-tokens.json`

---

## Auth

### Current
- Clerk (`@clerk/express`) with Google social sign-in
- Clerk's shared Google OAuth credentials (fine for dev/testing)

### Later
- Switch to custom Google OAuth credentials in Clerk dashboard for production
  - Create OAuth 2.0 Client ID in Google Cloud Console
  - Set authorized redirect URI to Clerk's callback URL (shown in Clerk dashboard)
  - Paste Client ID + Secret into Clerk → Configure → Social connections → Google
- Add token refresh flow for Google Calendar OAuth (expired tokens currently require reconnect)

---

## Calendar Sync

### Current
- One-way sync to Google Calendar
- Conflict pre-check (warns but doesn't block)
- Dedupe-safe via item fingerprinting

### Planned
- Token refresh flow — auto-renew expired Google access tokens without requiring reconnect
- Selective sync — filter by city or date range before syncing
- Per-item conflict resolution UI — let user choose skip/overwrite per conflict

---

## Features (Longer Term)

- **Collaborative itineraries** — share a trip with another user, co-edit in real time
- **Mobile app** — React Native or PWA promotion (service worker already in place)
- **Richer booking ingest** — improve heuristic email parser for edge-case confirmation formats
- **Export to PDF** — printable trip summary beyond ICS
