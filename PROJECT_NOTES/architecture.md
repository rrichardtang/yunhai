# Architecture

_Last updated: 2026-04-14_

## Feature Contract: Trip Health refresh (Confidence Check reposition)

### Objective
Reframe existing Confidence Check Mode into a standalone Trip Health workspace that remains always accessible, while preserving existing reliability logic and persistence.

### Acceptance Criteria
1. Top bar replaces text badge with a clean Phosphor icon entrypoint (heartbeat icon) and status tinting.
2. Step 5 is renamed/reframed as Trip Health and is directly reachable from any planning stage via the topbar entry.
3. Trip Health page layout is split into: Health summary, Budget summary, editable checklist, issue review area.
4. Checklist is visibly interactive with direct-edit fields for type, location, reservation title, date/time, status, verified state, notes, booking ref, and budget.
5. Budget summary live-rolls checklist budgets and compares against trip budget when present.
6. Issue review exposes explicit actions per issue: fix, verify, dismiss, and add note.

### Non-goals
- Rebuilding confidence detection logic from scratch
- Adding new backend services or DB layers

### Design Notes
- Keep existing `confidence` persistence surface and APIs; extend checklist normalization to preserve richer UI fields.
- Keep compute logic lightweight and local for immediate feedback while retaining server compatibility.
- Persist issue review annotations under `confidence.issueMeta` so issue triage survives reload/save.

## Feature Contract: Confidence Check Mode (MVP)

### Objective
Add an always-on trip reliability layer that continuously validates itinerary consistency, tracks reservation readiness with an editable checklist, and surfaces a simple confidence state everywhere in the trip workspace.

### Acceptance Criteria
1. Live validation runs whenever trip data changes and flags: overlapping dates, overlapping activities, missing date/time fields, conflicting reservations, and suspicious timing gaps.
2. Users can manage a persistent checklist (add/edit/delete) for trip-critical reservations with fields: type, name, date/time, verified state, source, notes, optional booking reference.
3. Confidence status is always visible as a top-level badge and as a full review workflow step.
4. Badge click opens compact popover with status, issue count, top issue, checklist progress, and CTA to full review.
5. Full review page keeps checklist as a core visible block and clearly answers: what still needs booking, what is confirmed, what is broken, and what can be fixed now.
6. In-app warnings appear immediately when new conflicts are detected.

### Non-goals
- Full automatic ingestion/verification for every booking source
- AI-heavy verification heuristics
- Complex scheduling engine for reminders

### Design
- New shared confidence engine (`src/confidenceCheck.js`) computes issues, checklist progress, status, and booking-summary buckets driven by checklist state.
- Server endpoints:
  - `GET /api/itinerary/:id/confidence`
  - `PUT /api/itinerary/:id/confidence`
  - `POST /api/itinerary/:id/confidence/email-summary`
- `itineraryStore` persists confidence payload under itinerary records (`confidence.checklist`, `confidence.notificationPrefs`).
- UI embeds confidence in two places:
  - Workflow Step 5: dedicated “Confidence Check Mode” page
  - Global topbar badge + popover available from any step
- Client-side live checks run on state updates and show toasts for newly introduced issues.


## Feature Contract: Robust Calendar & Sync Mode (MVP)

### Objective
Provide reliable, low-noise calendar export/sync so each itinerary activity maps to one clean calendar event with optional metadata depth.

### Acceptance Criteria
1. One event per itinerary activity, no duplicate event creation during repeated sync runs.
2. Metadata mode toggle supported:
   - Compact: title, time, location only
   - Full: includes notes/booking guidance/confirmation context
3. Google Calendar one-way export (TravelPlanner → Google) via OAuth 2.0 using env-backed credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
4. Pre-sync conflict detection against existing Google events warns about overlaps before export.
5. ICS export remains available as universal fallback and supports compact/full metadata modes.

### Non-goals
- Two-way sync
- Apple Calendar API integration

### Design
- New server-side `calendarSync` module handles:
  - itinerary activity normalization into calendar items
  - Google OAuth config + token persistence
  - Google Calendar API calls
  - overlap precheck against calendar event windows
  - sync state fingerprint mapping to avoid duplicate creates
- Sync dedupe strategy:
  - deterministic item fingerprint keyed by itinerary/activity/time/location/description+mode
  - on sync, PATCH existing mapped Google event when fingerprint already seen; otherwise POST new event
- API surface:
  - `GET /api/calendar/google/status`
  - `GET /api/calendar/google/auth-url`
  - `GET /api/calendar/google/oauth/callback`
  - `POST /api/itinerary/:id/calendar/google/precheck`
  - `POST /api/itinerary/:id/calendar/google/sync`
  - `GET /api/itinerary/:id/calendar.ics?metadata=compact|full`
- UI integration in existing step 4 itinerary panel (no parallel view): metadata selector + Google connect/sync actions + conflict/sync status messaging.

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
