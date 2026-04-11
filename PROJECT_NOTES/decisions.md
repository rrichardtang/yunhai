# Decisions

Append-only. Records permanent architectural and design decisions.

---

## [2026-04-11] Cross-device sync via server-side user data store

**Decision:** Keep localStorage as a fast local cache and dual-write all user data (profiles, snapshots, view mode, chat session map) to a server-side flat JSON store keyed by Clerk userId. On sign-in, pull from server to hydrate localStorage if local is empty or stale.
**Reasoning:** localStorage is device-local by design. Signing into the same Clerk account on a different device showed no profiles, snapshots, or planning state. Server-side persistence with sync-on-auth is the minimal path to cross-device consistency without adding a database.
**Alternatives rejected:** Full database (Postgres/SQLite) — rejected because the existing architecture is flat-file JSON and this is consistent. Real-time sync (WebSocket) — rejected as premature; pull-on-auth is sufficient for current usage patterns.
**Tradeoffs:** Last-write-wins conflict resolution; concurrent edits from two devices can overwrite. Single `userdata.json` file for all users could grow large at scale. Acceptable given current user base and flat-file architecture.

## [2026-04-09] Clerk auth + user-scoped itinerary store + forwarded-email ingest

**Decision:** Integrate Clerk at both frontend and backend API layers, require auth for planner data APIs, and scope all itinerary reads/writes by `req.auth.userId`. Add privacy-first email forwarding via per-user forwarding addresses and webhook-based ingest into itinerary bookings.
**Reasoning:** Product research favors explicit forwarding over broad mailbox access. Clerk gives low-friction Google + magic-link auth and durable sessions across devices. User-scoped persistence is required to prevent cross-user data leakage.
**Alternatives rejected:** Continue anonymous local `userId` in localStorage (not portable and not secure). OAuth mailbox sync (violates privacy preference and increases consent/security complexity).
**Tradeoffs:** Requires Clerk and webhook env setup in each deployment. Booking parser is heuristic initially and may miss edge-case confirmations.


## [2026-04-08] Remove hardcoded post-processing from auto-arrange; trust LLM scheduling

**Decision:** Deleted `applyCommuteTimeAdjustments` and removed `enforceDayTimeBoundaries` from the auto-arrange flow. The LLM's scheduled times are applied directly with no code-side shifting or clamping. Instead, the LLM is given accurate inputs: fixedStart/fixedEnd times pre-offset by real Google Maps transit durations, and activity locations for geographic reasoning.
**Reasoning:** The post-processing was fighting the LLM — it hardcoded assumptions (shift forward by commute, clamp to window) that produced wrong results (0 min commute shown on arrival/departure, activities pushed to wrong times). The architecture should give the LLM correct context and trust its output, not bolt on brittle corrections afterward.
**Alternatives rejected:** Patching `applyCommuteTimeAdjustments` to also handle logistics pseudo-activities — rejected because it added more hardcoded logic on top of an already convoluted system. Pre-fetching all N² inter-activity commutes before arrangement — rejected as too expensive and impossible before the order is known.
**Tradeoffs:** The LLM estimates inter-activity travel time rather than using exact Google Maps durations at scheduling time. Exact commutes are still fetched afterward for display. In practice the LLM's estimates are good enough for initial placement; users can manually adjust.

## [2026-04-07] Per-trip chat sessions keyed by itinerary ID

**Decision:** Chat sessions are now mapped to itinerary IDs in a localStorage `chat_sessions` object. A global fallback `chat_session_id` is used for trips not yet saved.
**Reasoning:** Each saved trip should have its own conversation thread so context doesn't bleed between trips. Loading a saved itinerary should restore its chat history.
**Alternatives rejected:** Single global session with manual context injection — rejected because it loses conversational continuity when switching trips.
**Tradeoffs:** localStorage map grows with saved itineraries. Server-side sessions are still in-memory and lost on restart — acceptable given existing architecture.

## [2026-04-07] Load user preferences server-side for chat

**Decision:** The chat endpoint now loads the user's learned preference summary via `getPreferenceSummary()` rather than relying solely on frontend-sent context.
**Reasoning:** Ensures the chatbot always has the traveler's profile and learned preferences even if the frontend omits them. Single source of truth on the server.
**Alternatives rejected:** Sending the full preference object from the frontend — rejected because it duplicates server-side data and increases payload size.
**Tradeoffs:** Adds one synchronous file read per chat message (user preference JSON). Negligible given file sizes.

## [2026-04-07] Replace time-of-day presets with direct time picker

**Decision:** Removed the Morning/Afternoon/Evening/Custom dropdown for arrival and departure times, replaced with a single `<input type="time">`.
**Reasoning:** User found the dropdown unintuitive. A time picker is consistent with how dates are selected and gives precise control.
**Alternatives rejected:** Keeping the dropdown with better labels — rejected because the user explicitly wanted a time input consistent with the date picker.
**Tradeoffs:** Users no longer get preset shortcuts (Morning = 09:00, etc.) — they must always pick an exact time. Defaults to 09:00 arrival and 18:00 departure.

## [2026-04-07] Replace Auto Arrange heuristic scheduler with LLM call

**Decision:** Deleted the hard-coded scheduling loop (cursor tracking, opening hours window guards, meal category overrides) and replaced it with a `POST /api/arrange` endpoint that sends day windows + activity constraints to claude-haiku-4-5, which returns placements directly.
**Reasoning:** The heuristic tree kept breaking in edge cases (meals at wrong times, all activities on one day) and required ongoing maintenance. Claude can reason about all constraints holistically — arrival windows, meal timing, activity distribution, opening hours — without brittle if/else logic.
**Alternatives rejected:** Continuing to patch the heuristic scheduler — rejected after two regressions in the same session showed the approach wasn't scaling.
**Tradeoffs:** Auto Arrange now requires the Anthropic API key and adds ~1-2s latency. Failures fall back to a toast error rather than a silent partial arrangement.

## [2026-04-07] Enforce category opening hours for meal types in Auto Arrange

**Decision:** Meal categories (breakfast, lunch, dinner, nightlife, sunset) always use hardcoded category default opening hours in `normalizeActivityMetadata`, ignoring Claude's generated `opening_hours`.
**Reasoning:** Claude frequently generates wide opening windows for restaurants (e.g. `08:00-22:00`) that defeat the scheduling logic. Meal service windows are predictable and don't vary meaningfully by venue.
**Alternatives rejected:** Trusting Claude's output and adding smarter fallback logic — rejected because the root cause is upstream data quality, not the scheduler.
**Tradeoffs:** A breakfast spot that genuinely serves until midnight would be constrained to `07:30-10:30`. Acceptable given the scheduling correctness benefit.

## [2026-04-07] Add date range to city main row with auto-population

**Decision:** Start/end dates are now set at the city row level and auto-populate accommodation check-in/check-out, arrival date, and departure date.
**Reasoning:** User wanted a single source of truth for dates rather than filling in the same dates across three sections.
**Alternatives rejected:** Keeping dates only in the expandable drawer — rejected because it required too many clicks and redundant input.
**Tradeoffs:** Accommodation dates are now tied to arrival/departure by default. Users can still override them in the drawer, but the initial values are driven by the city-level date range.
