# Architecture

_Last updated: 2026-04-09_

## Feature Contract: Auth + Privacy-First Email Forwarding

### Objective
Add Clerk authentication and per-user email forwarding so each traveler has private account access and can ingest booking confirmations by forwarding emails (no mailbox OAuth/scanning).

### Acceptance Criteria
1. Users can sign up/log in with Clerk (Google + email magic link enabled in Clerk dashboard).
2. Planner app requires auth before loading trip data/features.
3. Itinerary APIs are user-scoped: list/load/delete only return records owned by `clerkUserId`.
4. Each authenticated user can fetch a stable unique forwarding inbox address.
5. Inbound forwarded emails (webhook) are parsed into booking records (flight/hotel/car/rental/transport) and attached to that user’s itinerary.
6. Optional outbound confirmation email is sent via Resend after successful ingest (when configured).
7. Minimal retention: only parsed booking fields + compact source metadata are persisted.

### Non-goals
- Full mailbox access (Gmail/Outlook OAuth) or background scanning.
- High-accuracy NLP over every airline/hotel format (MVP parser is rule-based).
- Multi-tenant org roles/admin.

## Design

### Auth boundary
- Frontend initializes Clerk JS and blocks planner UI until session is active.
- Frontend sends `Authorization: Bearer <Clerk session token>` with API requests.
- Express uses `clerkMiddleware()` + `requireAuth()` for protected routes.

### Data ownership
- `itineraries.json` items get `userId` from Clerk `req.auth.userId`.
- Store functions become user-scoped:
  - `saveItinerary(payload, userId)`
  - `listItineraries(userId)`
  - `getItineraryById(id, userId)`
  - `deleteItinerary(id, userId)`
  - `getLatestItinerary(userId)`

### Forwarding addresses
- Deterministic local part from hashed Clerk user id.
- Domain from `FORWARDING_EMAIL_DOMAIN` env.
- Mapping persisted in `data/email-routing.json` for webhook reverse lookup.

### Inbound email ingest
- Webhook endpoint (no Clerk auth): `/api/email/inbound`.
- Guarded by shared secret header `x-travelplanner-email-secret`.
- Parse payload fields from Resend inbound format (`to`, `from`, `subject`, `text`/`html`).
- Extract booking candidates with regex heuristics:
  - Flight: airline, flight number, confirmation code, dates
  - Hotel: property, check-in/out, confirmation
  - Car rental: provider, pickup/dropoff, confirmation
- Store normalized booking objects on latest itinerary for user (or requested itinerary when supplied).

### Privacy controls
- No external mailbox tokens.
- Save compact parsed artifacts only (and short source summary), not full raw message body by default.
- User-triggered flow: only forwarded emails are processed.

### Outbound notifications
- Use Resend (`resend` SDK) for optional “booking received” confirmation emails.
- If missing API key or user email, ingest still succeeds without outbound send.

## Rollout / env
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `FORWARDING_EMAIL_DOMAIN` (e.g., `inbox.travelplanner.app`)
- `EMAIL_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
