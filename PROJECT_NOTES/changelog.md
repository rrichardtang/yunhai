# Changelog

Append-only. Factual log of completed work. Entries older than 30 days may be summarized but never fully deleted.

---

## [2026-04-14] Fix budget/travelers lost on reload for existing trips

- Root cause: snapshot saved budget/travelers locally but the page reload showed the My Trips list instead of auto-resuming — user had to click "Open" which loaded stale server data
- Fix 1: `saveSnapshot()` now PUTs trip metadata to the server when `currentItineraryId` exists
- Fix 2: `renderMyTrips()` now auto-hydrates from the snapshot when it matches a saved itinerary, immediately restoring the user's edits instead of showing the trip list
- File: `public/app.js`

## [2026-04-14] Fix budget/travelers lost on reload for existing trips

- Root cause: when snapshot matched a saved itinerary, the draft was suppressed from My Trips — user had to click "Open" which loaded stale server data, losing edits
- Fix 1: `saveSnapshot()` now PUTs trip metadata to the server when `currentItineraryId` exists
- Fix 2: `renderMyTrips()` auto-hydrates from the snapshot when it matches a saved itinerary, restoring the user's in-progress edits (including the step they were on) instead of forcing them through the trip list
- File: `public/app.js`

## [2026-04-14] Fix snapshot causing duplicate trip on My Trips after editing existing trip

- Root cause: `saveSnapshot()` didn't include `currentItineraryId` in the payload, so a snapshot saved while viewing an existing trip appeared as an orphaned draft — `renderMyTrips` showed it as a separate "Draft" entry alongside the real saved itinerary
- Fix 1: added `currentItineraryId` to snapshot payload in `saveSnapshot()`
- Fix 2: `renderMyTrips()` now suppresses the draft entry when `snapshot.currentItineraryId` matches an already-saved itinerary
- Fix 3: `hydrateFromSnapshot()` now restores `currentItineraryId` from the snapshot so resuming a draft re-links it to the saved trip (enabling PUT instead of POST on next save)
- File: `public/app.js`

## [2026-04-14] Fix transit pills lost on Arrange step re-entry

- Root cause: `state.commutes = {}` on every step 2→3 transition wiped all commute data, including user-selected transit modes and previously fetched pills
- Fix: removed the unconditional `state.commutes = {}` from the step 2→3 path in `goToNextStep()` — commutes are preserved across Review↔Arrange navigation; full resets still occur in `resetToFresh()` and `clearPlannedResultsKeepSetup()`
- File: `public/app.js`

## [2026-04-14] Fix budget and traveler count not saved correctly

- Root cause: `state.tripBudget`/`numTravelers`/`numChildren` were only read from DOM inputs inside `planTrip()` and `saveSnapshot()`. Two paths in `goToNextStep()` that skip replanning (no-change shortcut, user declines regeneration) went directly to `setStep(2)` without syncing state. `generateItinerary()` then used stale state values.
- Fix: extracted `syncTripMetaFromInputs()` helper; called at start of all step-advance paths (both shortcut branches, `planTrip`, `generateItinerary`, `saveSnapshot`)
- File: `public/app.js`

## [2026-04-13] Replace profile sliders with dot scale in My Profile

- Replaced `<input type="range">` sliders in My Profile with a 5-dot clickable scale (`public/app.js`)
- Added dot-scale CSS (`.dot-scale-wrap`, `.dot-scale`, `.dot-scale-dot`, `.dot-scale-label`, `.dot-scale-end-label`) to `public/styles.css`
- Removed old `.rating-slider`, `.rating-slider-wrap`, `.rating-meta`, `.rating-value`, `.rating-label` styles
- Dot scale shows low-end label on left, current value label on right; supports click and keyboard (Enter/Space)

## [2026-04-11] Replace Leaflet with Google Maps on activity cards

- Removed Leaflet CSS/JS CDN from `public/planner.html`
- Updated Google Maps SDK loading to include `marker` library (`public/app.js`, `public/planner.html`)
- Replaced `ensureMiniMapForCard()` with Google Maps implementation using `AdvancedMarkerElement`
- Replaced `openActivityMapOverlay()` with Google Maps, `AdvancedMarkerElement`, `InfoWindow`, `LatLngBounds`
- Renamed `markerIcon()` to `markerContent()` returning DOM element for AdvancedMarkerElement
- Simplified `destroyMiniMaps()` (Google Maps doesn't need explicit removal)
- Added `isGoogleMapsReady()` helper

## [2026-04-13] Polish Confidence Check checklist UI

- Checklist sections reordered: Transportation → Accommodation → Cities (for activity items)
- "General" section eliminated — items with no city fall under their type section or "Other" city group
- Only activities with `booking_type` of `tour` or `attraction` auto-added (restaurants/none excluded)
- Items sorted by date/time ascending within each section
- Each section has its own "+ Add item" button; pre-fills type and city for the section
- "Conflicts found" card at top lists each issue message; shows "No conflicts found" when clean
- Removed "Live issues" panel from `planner.html` and all dead references (`confidenceIssuesList`)
- Files: `public/app.js`, `public/planner.html`

## [2026-04-13] Simplify checklist editor: 4 fields, auto-populate from itinerary, city-only grouping

- Replaced 9-type / 5-state checklist model with 5 types (transportation, accommodation, dining, activity, other) and 2 statuses (open, finalized)
- New `buildChecklistFromState()` auto-populates checklist from approved activities, city accommodations, and travel entries — no placeholder seeding, no manual re-entry
- Checklist now grouped by city only (removed category→city nesting)
- Editor row trimmed to 4 fields: Type, Date/Time (native `<input type="date">` + `<input type="time">`), Notes (freeform), Status
- Migration logic in `normalizeChecklistItem` maps old types/states and merges name/bookingReference/notes into single notes field for backward compatibility
- Updated `src/confidenceCheck.js`: same simplified model server-side; `groupChecklistByCity` replaces `groupChecklist`; `deriveChecklistSummary` uses open/finalized counts
- Updated `public/confidence.css`: 5-column grid, city-level `<h4>` as top-level section header, `confidence-datetime-inputs` flex pair
- Updated and expanded `src/confidenceCheck.test.js` (8/8 passing): covers migration, empty state, ready state
- Files: `public/app.js`, `src/confidenceCheck.js`, `public/confidence.css`, `src/confidenceCheck.test.js`

## [2026-04-13] Fix duplicate trips on reload

- Root cause: `generateItinerary()` always called `POST /api/itinerary`, which always created a new record — even when `state.currentItineraryId` was already set (e.g. after loading a saved trip and navigating back to step 3)
- Fix: `generateItinerary()` now uses `PUT /api/itinerary/:id` when `state.currentItineraryId` exists, falling back to `POST` for new trips
- Added `updateItinerary(id, payload, userId)` to `src/itineraryStore.js` — overwrites existing item in-place, preserves `bookings`/`generatedAt`
- Added `PUT /api/itinerary/:id` route in `src/server.js`
- Files: `src/itineraryStore.js`, `src/server.js`, `public/app.js`

## [2026-04-13] Fix step 5 Save Progress creating a new trip instead of updating

- Root cause: all Save Progress buttons shared `saveSnapshot()` which only writes to localStorage — no server call. By step 5, the itinerary already exists on the server (created in step 4), so the handler was effectively creating a new record.
- Fix: gave step 5 button a distinct id (`saveConfidenceBtn`) in `public/planner.html` and wired it to `PUT /api/itinerary/:id/confidence` in `public/app.js`; falls back to `saveSnapshot()` if no `currentItineraryId` exists
- Files: `public/planner.html`, `public/app.js`

## [2026-04-13] Fix Confidence Check checklist hidden by `.panel` CSS rule

- Root cause: inner `<section class="panel confidence-checklist-panel">` and `<section class="panel confidence-issues-panel">` inside step 5 were invisible because `.panel { display: none }` applies globally — `setStep` only adds `.active` to top-level step panels, never nested ones
- Fix: replaced `class="panel"` on both inner sections with `class="card-panel"` in `public/planner.html`
- Added `.card-panel` to `public/styles.css` — same visual style as `.panel` but always visible
- Files: `public/planner.html`, `public/styles.css`

## [2026-04-13] Strengthen Confidence Check checklist and checklist-driven summary

- Verified existing checklist existed, but it was too shallow (title/status/notes/details only) and summary was mostly a status card
- Upgraded confidence checklist schema in `src/confidenceCheck.js` to support: `type`, `name`, `dateTime`, `state`/verified, `source`, `notes`, optional `bookingReference`
- Auto-seeded checklist with critical booking types (flight, hotel, car rental, train, attraction, restaurant, tour, transfer) when missing
- Added checklist-aware issue detection (`missing_details`, `booking_problem`) and booking summary buckets: needs booking / confirmed / broken / can fix now
- Updated Confidence Check UI (`public/app.js`, `public/confidence.css`, `public/planner.html`) to keep checklist as a core visible section and drive summary cards/actions from checklist + issues
- Expanded confidence tests (`src/confidenceCheck.test.js`) for new checklist shape and critical-type seeding

## [2026-04-13] Build Confidence Check Mode MVP

- Added `src/confidenceCheck.js` with always-on validation for overlapping dates/activities, missing date-time fields, conflicting reservations, and suspicious gaps/impossible timing
- Added persistent confidence checklist + notification preference persistence to itinerary records (`updateItineraryConfidence` in `src/itineraryStore.js`)
- Added confidence API endpoints in `src/server.js`:
  - `GET /api/itinerary/:id/confidence`
  - `PUT /api/itinerary/:id/confidence`
  - `POST /api/itinerary/:id/confidence/email-summary`
- Added optional email summary sender via Resend for unresolved confidence issues
- Added UI confidence surfaces in `public/planner.html` + `public/app.js`:
  - Step 5 workflow panel (“Confidence Check Mode”)
  - global confidence status badge and compact popover with CTA
  - editable checklist rows (status/notes/details + add/delete)
  - immediate in-app warnings when new issues appear
- Added dedicated styles in `public/confidence.css`
- Added tests in `src/confidenceCheck.test.js`

## [2026-04-12] Fix geocoding rate limits causing "Location unavailable" on last city

- Added server-side Nominatim queue (`nominatimFetch`) enforcing 1.1s spacing between requests — prevents 429s when geocoding all activities across multiple cities
- Removed redundant 500ms client-side delay in `geocodeQueryQueued` (server now owns rate limiting)
- Files: `src/server.js`, `public/app.js`

## [2026-04-12] Fix map overlay blank screen — proxy Nominatim geocoding through server

- Added `GET /api/geocode?q=...` proxy endpoint in `src/server.js` to forward Nominatim requests server-side (fixes CORS block on VPS domain + 429 rate limit from browser IP)
- Updated `geocodeQueryQueued` in `public/app.js` to call `/api/geocode` instead of Nominatim directly
- Files: `src/server.js`, `public/app.js`

## [2026-04-12] Parallel city planning with global LLM semaphore

- `/api/plan` now processes cities in parallel batches of 3 (was sequential)
- Added global semaphore (`MAX_CONCURRENT_LLM_CALLS = 10`) in `server.js` to cap total in-flight Anthropic calls across all users
- `releaseLlmSlot()` called in `finally` block to prevent slot leaks on error
- Added Scalability section to `PROJECT_NOTES/ROADMAP.md` documenting job queue path for 100+ users
- Files: `src/server.js`, `PROJECT_NOTES/ROADMAP.md`

## [2026-04-12] Decline with feedback and activity replacement

- Decline button now shows inline feedback form instead of immediately declining; textarea capped at 200 chars
- New `POST /api/activity/replace` endpoint: generates one replacement activity for the same city based on the decline reason
- LLM response includes `signals[]` array (same schema as concierge): `{type,verdict}` / `{preference}` / `{constraint}`; processed via existing `processChatSignals()` — non-learnable reasons produce empty signals array
- `normalizeActivity` and `SYSTEM_PROMPT` exported from `src/claude.js` for reuse
- `postPreferenceSignal()` updated to accept optional `reason` field
- Files: `src/claude.js`, `src/server.js`, `public/app.js`, `public/styles.css`

## [2026-04-12] Fix booking type taxonomy and add children traveler support

- Replaced `is_bookable` boolean with `booking_type` enum in LLM schema: `tour` (GetYourGuide+Viator), `attraction` (Google tickets search), `restaurant` (Google Maps), `none` (no links)
- Strengthened `cost_type` prompt with explicit per_person/per_group examples to fix misclassifications (e.g. teamLab, theme parks)
- Added Children input to Step 1 alongside Adults; children cost estimated at 60% of adult price
- `computeApprovedCost()` applies children discount; card display shows adult + child breakdown
- `numChildren` threaded through plan/arrange API payloads, LLM budget context, and GetYourGuide/Viator booking link params
- Files: `src/claude.js`, `src/server.js`, `src/braveSearch.js`, `public/planner.html`, `public/app.js`

## [2026-04-12] Add regenerate confirmation dialog on step 1 changes

- `step1Fingerprint()` expanded to include `budget` and `travelers` (read from DOM inputs)
- `goToNextStep()` step 1 branch: shows `showRegenerateConfirmDialog()` when fingerprint changed and activities exist
- "No, keep existing" skips to step 2; "Yes, regenerate" proceeds with re-plan
- `showRegenerateConfirmDialog()`: promise-based modal, backdrop-click dismisses as "No"
- Files: `public/app.js`

## [2026-04-12] Add budget feature with per-activity costs and booking links

- Added Total Budget (USD) and Number of Travelers inputs to Step 1 (`public/planner.html`, `public/app.js`)
- LLM (`src/claude.js`) now returns 3 new fields per activity: `estimated_cost_usd`, `cost_type` (per_person/per_group), `is_bookable`; with explicit examples in prompt to prevent weak-model misclassification
- Added `searchActivityPrice()` and `searchActivityPricesBatch()` to `src/braveSearch.js` with multi-currency regex parsing (USD/EUR/GBP/JPY → USD) and range support (takes higher end)
- `/api/plan` (`src/server.js`): extracts budget/numTravelers, passes to `planCity()`; runs parallel Brave price batch post-generation; overrides LLM cost with Brave if higher; constructs booking links (GetYourGuide + Viator for tours, Google Maps for named restaurants) using `is_bookable` flag
- `/api/activity/refine` (`src/server.js`): refine prompt includes cost fields; re-runs Brave price search and reconstructs booking links after customize
- `/api/arrange` (`src/server.js`): includes cost info in activities text and budget context rule
- `public/app.js`: `computeApprovedCost()` helper; `renderBudgetTracker()` sticky bar with green/yellow/red states; cost display on cards with per-person multiplication; booking link pills; post-arrange date refresh on booking links
- `public/styles.css`: budget tracker styles, booking link pills, trip meta row layout
- Files: `src/braveSearch.js`, `src/claude.js`, `src/server.js`, `public/planner.html`, `public/app.js`, `public/styles.css`

## [2026-04-11] Tighten concierge chat prompt and add hyperlink rendering

- Concierge system prompt: capped at 2-3 sentences, banned hedging phrases, added CRITICAL instruction to use markdown links instead of raw URLs inside JSON reply
- Frontend `renderChatMessages`: converts markdown `[text](url)` to `<a>` tags, plus fallback auto-linking for raw URLs
- Files: `src/server.js`, `public/app.js`

## [2026-04-11] Replace resume popup with "My Trips" section on Step 1

- Removed `resumeModal` dialog from `planner.html`
- Added `#myTripsPanel` section inside Step 1 showing drafts + saved itineraries
- Replaced `maybePromptSnapshot()` with `renderMyTrips()` in `app.js`
- Draft trips shown with yellow badge; saved itineraries with Open/Delete actions
- Panel auto-hides when no trips exist
- Removed unused `.resume-card` / `.resume-actions` CSS
- Files: `public/planner.html`, `public/app.js`, `public/styles.css`

## [2026-04-11] Add cross-device data sync for localStorage-only data

- Created `src/userDataStore.js` — flat JSON store at `data/userdata.json` keyed by Clerk userId
- Added REST endpoints in `src/server.js`: `GET/PUT /api/userdata`, `GET/PUT /api/userdata/:field`
- Updated `public/app.js`:
  - `syncToServer()` pushes to server on every local save (profiles, snapshot, viewMode, chatSessions)
  - `syncFromServer()` hydrates localStorage from server after Clerk auth completes
  - Updated `saveProfiles`, `saveSnapshot`, `clearSnapshot`, `setViewMode`, `saveChatSessionMap` to dual-write
- Files: `src/userDataStore.js` (new), `src/server.js`, `public/app.js`

## [2026-04-11] Add map-first activity review UX (Step 2 card flip + full-screen map)

- Added Leaflet + OpenStreetMap to planner UI (CDN) for map rendering with no API key
- Reworked Step 2 activity cards into a 3D flip-card layout:
  - Front keeps existing activity details/approve-decline/notes controls
  - Back adds mini-map with pinned activity location and full-map launch action
- Implemented client-side Nominatim geocoding (`https://nominatim.openstreetmap.org/search`) with:
  - query candidate fallback (`start_location`, `end_location`, activity+city)
  - localStorage cache (`travelplanner_geo_cache_v1`)
  - serialized request queue + spacing to reduce API hammering
- Added full-screen map overlay showing all activities in the current itinerary:
  - numbered marker labels by city/order
  - selected activity highlighted using star marker
  - clickable pins that scroll/highlight corresponding activity card
- Added supporting styles for smooth CSS 3D transforms and map UI overlays
- Files: `public/app.js`, `public/styles.css`, `public/planner.html`, `PROJECT_NOTES/current_state.md`, `PROJECT_NOTES/ROADMAP.md`, `PROJECT_NOTES/changelog.md`

## [2026-04-11] Wire up Brave Web Search API for planning agent + chat concierge

- Created `src/braveSearch.js` — thin wrapper around Brave Web Search API with `search()`, `searchCityActivities()`, `searchForChat()` helpers; graceful no-op when key missing
- Wired into `src/claude.js` `planCity()` — fetches web research for the city before LLM call, injected as supplementary context in the user prompt
- Wired into `src/server.js` chat endpoint — every chat message triggers a Brave search, results appended to system prompt so the concierge can cite real-time info
- Added `BRAVE_API_KEY` to `.env.example` with comment (free tier: 2000/month)
- Updated `CLAUDE.md` with new module and updated request flow
- Files: `src/braveSearch.js` (new), `src/claude.js`, `src/server.js`, `.env.example`, `CLAUDE.md`

## [2026-04-10] Add Robust Calendar & Sync Mode MVP (Proposal A)

- Added calendar metadata mode toggle (compact/full) in step 4 itinerary actions
- Upgraded ICS export to accept `metadata` query param and conditionally include full notes fields
- Added Google Calendar OAuth scaffolding endpoints using env credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `GOOGLE_REDIRECT_URI`)
- Added Google Calendar connection status endpoint
- Added pre-export conflict detection endpoint that checks overlap against existing Google calendar events
- Added one-way Google sync endpoint with dedupe-safe fingerprint mapping to avoid duplicate event creation
- Added local persistence for Google tokens + sync fingerprints (`data/google-calendar-tokens.json`, `data/calendar-sync-state.json`)
- Added UI controls: Connect Google, Sync Google, conflict warning/continue prompt, sync status message
- Files: `src/server.js`, `src/calendarSync.js`, `public/planner.html`, `public/app.js`, `public/styles.css`, `PROJECT_NOTES/architecture.md`, `PROJECT_NOTES/current_state.md`, `PROJECT_NOTES/changelog.md`

## [2026-04-09] Add Clerk auth + user-scoped itineraries + email forwarding ingest

- Integrated Clerk auth boundary in planner app (frontend sign-in gate + Bearer token API calls)
- Added server-side Clerk middleware and protected `/api/*` routes (except status + inbound webhook)
- Converted itinerary persistence to authenticated user ownership (`userId`) for save/list/load/delete/ICS
- Added per-user forwarding inbox generation using hashed alias + configurable forwarding domain
- Added `/api/auth/session` to return user auth context + forwarding address
- Added `/api/email/inbound` webhook with shared-secret verification for forwarded booking emails
- Implemented booking parser (flight/hotel/car/other heuristics) and itinerary attachment flow
- Added optional Resend outbound confirmation email after successful ingest
- Relaxed userId validator to accept Clerk-style IDs
- Files: `src/server.js`, `src/itineraryStore.js`, `src/emailForwarding.js`, `src/preferences.js`, `public/planner.html`, `public/app.js`, `public/styles.css`, `package.json`

## [2026-04-09] Build Smart Minimal Itinerary extension on top of Execution Mode

- Extended existing Execution Mode (not a parallel view) into a "Smart Minimal Itinerary" surface
- Added mobile-friendly execution toolbar actions: Share link, Copy text, Save Offline, Print
- Added compact trip summary cards (trip/date range/cities/item count)
- Added "Consolidated Confirmations" block (accommodation + arrival/departure details per city)
- Grouped execution schedule by day/city for lightweight on-trip scanning
- Added URL-share flow via `?itinerary=<id>&mode=execution`
- Added offline fallback pack in localStorage for shared links and service worker shell caching (`public/sw.js`)
- Files: `public/planner.html`, `public/styles.css`, `public/app.js`, `public/sw.js`

## [2026-04-08] Add apply-note button to refine activities from user notes

- New `/api/activity/refine` endpoint: sends activity + user note to Haiku, returns only changed fields
- Checkmark button appears next to notes textarea on approved activities
- On click, merges LLM-returned field updates into the activity in-place, clears note, re-renders
- Refined activity (e.g. specific restaurant) flows into auto-arrange with correct name/location/details
- Files: `public/app.js`, `public/styles.css`, `src/server.js`

## [2026-04-08] Fix chat response showing raw JSON

- `parseChatResponse` now strips markdown code fences before `JSON.parse`
- Matches the same fallback strategy used in `claude.js` for activity generation
- Files: `src/server.js`

## [2026-04-08] Fix pace slider crash (paceLabel collision)

- Renamed new profile pace function to `pacePrefLabel` to avoid collision with existing `paceLabel` at line 3128
- Existing `paceLabel` returns an object `{label, className}` for itinerary insights; later declaration was shadowing it
- Files: `public/app.js`

## [2026-04-08] Add pace preference and LLM-reasoned activity counts

- Added "How packed do you like your days?" slider to user profile (1–5: very relaxed → non-stop)
- Removed hardcoded "6-8 activities" constraint; LLM now reasons from date range + pace
- Pace description injected into activity generation and auto-arrange prompts
- Auto-arrange rule 9 now gives pace-specific scheduling guidance (gaps vs. tight packing)
- Pace flows through `getSummary()`, `formatProfileForEnrichment()`, and arrange API call
- Files: `public/app.js`, `src/claude.js`, `src/preferences.js`, `src/server.js`

## [2026-04-08] Replace time-of-day presets with exact time field

- Removed `TIME_OF_DAY_PRESETS` (morning/afternoon/evening), `normalizeTimeOfDay`, and the `timeOfDay`+`customTime` dual-field system
- Replaced with single `time` field (HH:MM) on `logistics.arrival` and `logistics.departure`
- Time inputs start empty — user must select an exact time before progressing
- Validation blocks "Next" if either arrival or departure time is missing
- Server reads `.time` first with fallback to `.customTime` for old saved data
- Updated `cityDropdownValidation.js` and its tests to match
- Files: `public/app.js`, `src/server.js`, `src/cityDropdownValidation.js`, `src/cityDropdownValidation.test.js`

## [2026-04-08] Bias Google Places autocomplete to selected city

- Added `cityLocationBias()` helper — creates 50km radius circle from city lat/lng
- Passed `locationBias` to `PlaceAutocompleteElement` for accommodation, arrival, departure, and travel entry inputs
- City name input intentionally unbiased (global search)
- Files: `public/app.js`

## [2026-04-08] Improve activity images and clean up review UI

- Frontend now sends activity `type` to `/api/image` for more relevant Unsplash results
- Unsplash fetches 5 candidates per query (was 1); `usedUrls` Set prevents duplicates across activities
- Removed "Clear Visible" button from review toolbar
- Removed "Cultural Time Budget" bar and all related CSS (`.budget`, `.progress` classes)
- Files: `public/app.js`, `public/planner.html`, `public/styles.css`, `src/unsplash.js`

## [2026-04-08] Overhaul auto-arrange prompt for better scheduling

- Upgraded arrange model from claude-haiku-4-5 to claude-sonnet-4-6, max_tokens 1024→2048
- Injected traveler profile (distilledProfile + constraints) into arrange prompt
- Stripped noise from activity payload: omit empty fields, filter default suggested_time (10:00am)
- Restructured prompt: numbered priority rules, explicit per-day activity target, concrete meal windows
- Removed redundant/aggressive instructions suited for weaker model
- Files: `src/server.js`, `public/app.js`

## [2026-04-08] Fix 0-min logistics commutes; clean up commute system

- Root cause: `buildLogisticsPseudoActivities` set arrival pseudo's end_location to accommodation (not arrival point), so commute pipeline computed accommodation→accommodation = 0 min. Same issue for departure pseudo's start_location.
- Fix: each pseudo-activity now uses its own physical location for both start/end coords
- Extracted `renderCommuteSelector()` — single source for commute dropdown HTML
- Simplified `updateCommutesForCityDays`: merged two fragile cleanup passes into one
- Removed dead `makeLogisticsTransit` function
- Files: `public/app.js`

## [2026-04-08] Simplify auto-arrange: LLM-driven scheduling with commute-aware inputs

- Pre-fetch arrival→accommodation and accommodation→departure commute times via Google Maps before `/api/arrange` call
- fixedStart/fixedEnd times now offset by actual transit duration so LLM receives accurate available windows
- Activity locations sent in arrange payload for LLM geographic clustering
- Prompt updated: LLM estimates inter-activity travel time, groups nearby activities per day
- Deleted `applyCommuteTimeAdjustments` — LLM scheduling trusted, hardcoded post-processing removed
- Files: `public/app.js`, `src/server.js`

## [2026-04-08] Real commute times for arrival/departure logistics legs

- Logistics pseudo-activities injected into commute calculation pipeline
- Google Maps Distance Matrix calculates real transit/driving/walking times for these legs
- Commute mode selector rendered between logistics cards and first/last activities
- Files: `public/app.js`

## [2026-04-08] Arrival/departure logistics cards and auto-arrange constraints

- Render fixed arrival and departure cards on arrival/departure days in the arrange view
- `/api/arrange` prompt includes FIXED FIRST/LAST annotations
- Fixed Google Places library init
- Added editable AI-generated summary section in profile modal
- Files: `public/app.js`, `public/styles.css`, `src/server.js`

## [2026-04-07] Summary of earlier work

- Fix activity images not loading at step 2
- Chat-driven preference learning with profile distillation
- Optimize concierge context window for cost efficiency
- Evolving context window for concierge chatbot
- Replace Auto Arrange heuristic with LLM call
- Trigger fresh plan generation when step 1 data changes
- Overhaul Auto Arrange logic and meal scheduling
- Fix arrival/departure location autocomplete
- Add Google Places location inputs for accommodation, arrival, departure
- Simplify trip setup date/time UX
- Scaffolded PROJECT_NOTES/
