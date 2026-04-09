# Changelog

Append-only. Factual log of completed work. Entries older than 30 days may be summarized but never fully deleted.

---

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
