# Current State

_Last updated: 2026-04-09_

## Objective
Continue local development of TravelPlanner and push changes to git for VPS deployment.

## Active Workstream
Auth + privacy-first booking ingestion:
- Clerk auth integrated (frontend + backend protected APIs)
- Itinerary storage now user-scoped by authenticated Clerk user ID
- Per-user forwarding inbox address + webhook-based forwarded-email parser

## Constraints
- Clerk + Resend + webhook envs must be configured on VPS (`CLERK_*`, `FORWARDING_EMAIL_DOMAIN`, `EMAIL_WEBHOOK_SECRET`, optional `RESEND_*`)
- Local runtime currently has a `.git/objects` ownership mismatch from earlier root operations, which blocks additional commits until ownership is repaired

## Risks
- Booking email parser is heuristic MVP and may miss edge-case confirmation formats
- Existing legacy itineraries without `userId` are intentionally not visible under new auth-scoped reads

## Next Actions
- Configure Clerk (Google + email magic link) and verify sign-in/sign-out + persisted sessions across devices
- Configure forwarding domain + webhook to `/api/email/inbound` and test end-to-end parsing into itinerary bookings
- Repair git ownership (`.git/objects`) so remaining code changes can be committed cleanly
