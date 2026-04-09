# Changelog

Append-only. Factual log of completed work. Entries older than 30 days may be summarized but never fully deleted.

---

## [2026-04-08] Arrival/departure logistics cards and auto-arrange constraints

- Render fixed ✈️ arrival and 🛫 departure cards on arrival/departure days in the arrange view
- Transit arrows shown: arrival location → accommodation, accommodation → departure location
- `/api/arrange` prompt now includes FIXED FIRST/LAST annotations so Claude schedules no activities before arrival transit or after departure transit
- Fixed Google Places library init: merge `importLibrary('places')` return value into `window.google.maps.places` so `PlaceAutocompleteElement` is found
- Added editable AI-generated summary section in profile modal (hidden until first enrichment, user-editable)
- Files: `public/app.js`, `public/styles.css`, `src/server.js`

## [2026-04-07] Fix activity images not loading at step 2

- Moved `setStep(2)` before `renderActivities()` in the streaming city event handler so `enrichImages` fires on the first city arrival instead of waiting for user interaction
- File: `public/app.js`

## [2026-04-07] Chat-driven preference learning with profile distillation

- Concierge chatbot now returns structured JSON with optional preference signals extracted from user messages
- New signal types: activity preferences (type + verdict) and freeform constraints ("no activities before 9am")
- `recordConstraint()` stores deduplicated scheduling/preference constraints (max 20)
- Profile distillation: every 10 new signals, Haiku synthesizes all data (existing profile + signals + constraints + self-reported answers) into a single evolving profile paragraph (max 1000 tokens)
- After distillation, raw signals pruned to last 10, constraints absorbed into paragraph
- `getSummary()` returns distilled profile as primary output, falls back to derived approach pre-distillation
- Distillation triggered from both chat signals and activity approve/decline endpoint
- `parseChatResponse()` handles JSON with graceful fallback to raw text
- Files: src/preferences.js, src/server.js

## [2026-04-07] Optimize concierge context window for cost efficiency

- Stripped getTripContext(): sends only city name/dates/leaveTime/accommodation addresses, drops raw objects, coordinates, IDs, UI state, travels array, raw profile
- Approved/declined lists omitted when schedule exists (schedule supersedes them); declined list dropped entirely
- Step sent as human-readable label instead of number
- buildChatSystemPrompt() simplified — removed formatProfileBlock, coordinates, checkIn/checkOut timestamps
- System prompt cached per session via getCachedPrompt(), only rebuilt when tripContext changes
- Compaction threshold lowered from 100k tokens to 8k (~40-50 messages)
- Files: public/app.js, src/server.js, src/chat.js

## [2026-04-07] Evolving context window for concierge chatbot

- `getTripContext()` now sends profile, tripName, itineraryId, and scheduledByDay (day-by-day activity placements with times/locations)
- `buildChatSystemPrompt()` refactored into focused helpers (`formatCityLine`, `formatScheduleBlock`, `formatProfileBlock`) and renders structured sections
- Chat endpoint loads user's learned preferences server-side via `getPreferenceSummary()` — chatbot always knows traveler tastes
- Per-trip chat sessions: `ensureChatSessionId()` uses a `chat_sessions` localStorage map keyed by itinerary ID
- Loading a saved itinerary restores its associated chat session and history
- Saving an itinerary binds the current chat session to the new itinerary ID
- Files: `public/app.js`, `src/server.js`

## [2026-04-07] Replace hard-coded Auto Arrange scheduler with LLM call

- Deleted heuristic scheduling loop (opening hours windows, cursor tracking, category guards)
- New `POST /api/arrange` endpoint sends days (with availability windows) + activities to claude-haiku-4-5 and returns `{ placements, unplaced }`
- Frontend maps returned `{ date, time }` placements back to `{ dayId, time }` using activeDays
- Button shows "Arranging…" and disables during the call
- Files: `src/server.js`, `public/app.js`

## [2026-04-07] Trigger fresh plan generation when step 1 data changes

- Added `step1Fingerprint()` — JSON snapshot of `state.cities` + `state.travels`
- Stored as `state.lastPlannedFingerprint` after each successful `planTrip()` run
- `goToNextStep` now compares current fingerprint against stored one — forces regeneration if changed, skips to step 2 if unchanged
- Files: `public/app.js`

## [2026-04-07] Overhaul Auto Arrange logic

- Fixed meal scheduling: meal categories (breakfast, lunch, dinner, nightlife, sunset) now always use category-default opening hours, overriding Claude's generated values — prevents breakfast being placed at 4pm on arrival days
- Auto Arrange now skips opening windows that have already closed by the time a day's available window starts (`openEnd <= dayStart`)
- Fixed `buildCityTravelTiming` (server) to read arrival/departure times from `city.logistics.arrival/departure.customTime` with fallback to legacy `travelEntry`
- Arrival-point → accommodation travel time now computed for all cities (was previously only city index 0)
- Departure location now reads from `city.logistics.departure.{location,latitude,longitude}` with legacy field fallback
- `auto_version_control.md` updated: removed `Claude Code` branch, now always commits/pushes to `main`
- Files: `public/app.js`, `src/server.js`, `.claude/rules/auto_version_control.md`

## [2026-04-07] Fix arrival/departure location autocomplete

- Skip `renderCities()` for `arrivalLocation`/`departureLocation` input events to prevent DOM teardown from destroying the Places widget mid-typing
- Same pattern already used for city name input
- File: `public/app.js`

## [2026-04-07] Add Google Places location inputs for accommodation, arrival, departure

- Replaced accommodation type dropdown (Hotel/Airbnb/None) with a Google Places autocomplete address input
- Added arrival location input with Places autocomplete (e.g. airport)
- Added departure location input with Places autocomplete (e.g. train station)
- Added location/placeId/lat/lng fields to `city.logistics.arrival` and `city.logistics.departure`
- Ensured first accommodation entry auto-created when drawer renders
- Synced accommodation check-in/check-out dates from city-level date range changes
- Files: `public/app.js`, `public/styles.css`

## [2026-04-07] Simplify trip setup date/time UX

- Added start/end date inputs to city main row that auto-populate accommodation check-in/check-out and arrival/departure dates
- Replaced Morning/Afternoon/Evening/Custom dropdown with native `<input type="time">` for arrival and departure
- Fixed `normalizeCityLogistics` to read from `city.logistics` first, preserving state across re-renders
- Files: `public/app.js`, `public/styles.css`

## [2026-04-07] Scaffolded PROJECT_NOTES/

- Created `current_state.md`, `decisions.md`, `open_items.md`, `changelog.md`
