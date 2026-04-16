# Changelog

Append-only. Factual log of completed work. Entries older than 30 days may be summarized but never fully deleted.

---

## [2026-04-16] Fix Budget Lens and Booking Checklist population

- `buildChecklistFromState`: removed `booking_type` filter (was `tour`/`attraction` only) and placement gate — all approved activities now enter the checklist regardless of type or whether they've been arranged
- `buildChecklistFromState`: placement is now optional — falls back to `a.city` for location and empty string for date when no placement exists yet
- `buildChecklistFromState`: merge now always overwrites `budgetUsd` from live `activityEstimatedCost` (was `??` which kept stale prices after activity refinement)
- Activity cards: per-person cost rendered as inline editable `<input>` — blur/Enter commits new value to `state.activities`, updates `= $total` display, and refreshes Budget Lens
- Approve/decline card handlers now call `renderBudgetTracker()` so Budget Lens updates on single-card toggles
- Files: `public/app.js`, `public/styles.css`

## [2026-04-16] Modify vs Replace split on activity cards

- `/api/activity/refine` upgraded: switched from `claude-haiku-4-5` to `gpt-5.4-mini` (via OpenAI SDK); terse reasoning-reliant prompt; unconditional `search()` grounding when Brave is configured; accepts optional `budget_target` for budget-optimization path; `ACTIVITY_REFINE_MODEL` constant added
- Frontend card markup: single shared textarea placeholder updated to "Tweak or replace this activity…"; single `confirm-decline` button replaced with `confirm-modify` (pencil icon, Modify) + `confirm-replace` (arrows icon, Replace)
- `confirmModify` handler: POSTs to `/api/activity/refine`, merges `{ updates }` into existing activity preserving `id`, calls `renderActivities()`
- `confirmReplace` handler: renamed from `confirmDecline`, unchanged behavior → `/api/activity/replace`
- Expanded modal (`openCardExpand`) updated identically — picks up new markup via innerHTML clone, handlers re-wired
- All 11 existing tests pass
- Files: `src/server.js`, `public/app.js`

## [2026-04-16] Fix AI-generated summary disappearing in My Profile

- Bug 1: `profileChanged` always false — slider dot-click handler mutates `state.profile` live, so by save time `prev === state.profile` already had new values, skipping enrich. Fix: capture `profileSnapshot = JSON.stringify(state.profile)` when modal opens; compare `next` against parsed snapshot in save handler; update snapshot after each save.
- Bug 2: `GET /api/preferences` on every modal open could silently overwrite in-memory `profileInstruction` with empty string (server returned `profileInstruction: ''` for unknown reason — likely race or stale write). Fix: merge incoming prefs, keeping existing `state.learnedPrefs?.profileInstruction` if server returns empty.
- Files: `public/app.js`

## [2026-04-16] Unified preference system rewrite

- `src/preferences.js` rewritten: removed `signals`, `liked`, `disliked`, `distilledProfile`, `signalsSinceDistill`, `tokenize`, `topFrequent`, `deriveSummaries`, `recordSignal`, `needsDistillation`, `distill`. New shape: `{ profileInstruction, preferences, constraints }`
- `getSummary()` now takes `userId` only — single path, no branching on distillation state
- `src/server.js`: removed `POST /api/preferences/signal` endpoint; removed `recordSignal`, `needsDistillation`, `distillProfile` imports; `PUT /api/preferences` now accepts `profileInstruction`; `/api/profile/enrich` saves generated instruction server-side; `/api/activity/replace` extracts `preferences`/`constraints` arrays from LLM response instead of `signals`; chat system prompt drops approve/decline signal shape; fixed stale `distilledProfile` reference in `/api/arrange`
- `public/app.js`: removed `profileInstruction` from localStorage profile shape and `defaultProfile()`; `renderPreferencesModal` reads AI summary from `state.learnedPrefs.profileInstruction` (server); profile save handler PUTs `profileInstruction` to server after enrich; added `blur` listener on AI summary textarea to save manual edits; enrich only fires when `answers` or `aboutMe` changed; removed `postPreferenceSignal()` function and all 6 call sites

## [2026-04-15] Fix add-activity enrichment returning wrong activity

- Root cause: `userAdded` path on `/api/activity/replace` used `claude-haiku-4-5` + `max_tokens: 600` — insufficient for precise instruction-following on enrichment task; returned unrelated city activities
- Fix: `userAdded` path now uses `claude-sonnet-4-6` + `max_tokens: 1024`; decline/replace path unchanged (Haiku)
- Simplified `userAdded` prompt to positive framing — removed brittle negative constraints that compensated for Haiku's weaker instruction-following
- File: `src/server.js`

## [2026-04-15] Enrich user-added activities and ground Replace/Modify via Brave search

- `/api/activity/replace` now runs `search("${name} ${city}")` (3 results) before every LLM call, injecting results as grounding context — applies to both replace/modify and user-added flows
- Added `userAdded` flag to `/api/activity/replace`: when true, prompt asks agent to flesh out a real-world match; when false (default), prompt asks for a replacement addressing the decline reason; signals extraction skipped for userAdded
- `search` added to braveSearch import in `src/server.js`
- `submitAddActivity()` in `public/app.js` now pushes an `enriching: true` stub, then calls `/api/activity/replace` with `userAdded: true`; on success swaps stub with enriched activity in-place; on failure removes enriching flag and keeps stub
- `buildActivityCard()` short-circuits to a spinner card when `a.enriching === true`
- Added `.activity-card-enriching` and spinner CSS to `public/styles.css`
- Files: `src/server.js`, `public/app.js`, `public/styles.css`

## [2026-04-15] Add user-initiated "Add Activity" card to review step

- Added blank add-activity card at end of review grid (dashed border, centered `ph-plus-circle` icon, hover accent)
- Added `#addActivityModal` to `public/planner.html` with 4 fields: name, city dropdown, est. cost ($ + per person/group), why it fits
- Added `buildAddActivityCard()`, `openAddActivityModal()`, `closeAddActivityModal()`, `submitAddActivity()` to `public/app.js`
- User-added activities pushed to `state.activities` with `userAdded: true`; grid re-renders on submit; success toast shown
- Added CSS for `.add-activity-card` and all modal field styles to `public/styles.css`
- Files: `public/app.js`, `public/planner.html`, `public/styles.css`

## [2026-04-15] Frontend split: isolate boundary helpers while keeping app.js orchestration

- Extracted overlay/modal concerns to `public/js/overlayManager.js`
- Extracted API/service wrapper concerns to `public/js/apiService.js`
- Extracted top-level state/persistence helpers to `public/js/statePersistence.js`
- Kept core planner orchestration intentionally in `public/app.js` (step flow, render pipeline, review/arrange/finalize logic, chat/maps/checklist integration)
- Scope was intentionally minimal and revertible to reduce risk during active mobile-hardening work
- In current workspace state, `public/planner.html` still loads `/app.js` directly and does not wire helper scripts yet; `app.js` retains fallback paths/defaults when helper globals are absent
- Files: `public/js/overlayManager.js`, `public/js/apiService.js`, `public/js/statePersistence.js`, `public/app.js`, `PROJECT_NOTES/current_state.md`, `PROJECT_NOTES/decisions.md`, `PROJECT_NOTES/changelog.md`

## [2026-04-15] Fix checklist auto-population to rely solely on backend booking_type

- Removed fragile frontend heuristic from `buildChecklistFromState()` that inferred booking requirement from `a.type`/`a.category` when `booking_type` was missing
- Now uses only `['tour', 'attraction'].includes(a.booking_type)` — the authoritative backend field set by Claude at generation time
- File: `public/app.js`

## [2026-04-15] Booking checklist complete overhaul per checklist.md spec

- New typed data model in `normalizeChecklistItem`: transportation (startLocation, endLocation, isRoundTrip, departureDate/Time, returnDate/Time), accommodation (accommodationCity, checkInDate, checkOutDate), activity (activityLocation, activityDate/Time) — each type has its own primary fields
- `buildChecklistFromState`: updated to populate new typed fields from state; uses stable type-aware keys to avoid duplicates
- Replaced old `renderConfidence` checklist section with `renderChecklistModal()` — fully self-contained, called only when modal opens
- Category containers (Transportation, Accommodation, City Activities) — always rendered even when empty, with Phosphor empty state icons
- Collapsed rows: single scannable line per item type; location truncation to 28 chars; checked-off items get strikethrough + muted color (no opacity, WCAG AA safe); 200-350ms transition
- Expanded form: click row to expand; primary zone always visible; secondary zone (Reference #, Price, Notes) behind "More details" ghost button; auto-expands if any secondary field has data
- Google Maps autocomplete: reuses existing `attachPlaceAutocompleteElement` for startLocation, endLocation, accommodationCity, activityLocation
- Search bar: pill-shaped, Phosphor magnifying-glass icon, searches item names only, autofill dropdown with category badge, scroll + accent flash on select
- Container collapse/expand: click header collapses to title + item count badge
- Delete: ghost Phosphor trash icon, undo toast (4s) with Undo button
- + Add Item: ghost button, minimum 44px touch target; new item opens expanded in sorted position
- Per-container subtotals + grand total: only visible when prices exist
- CSS: full rewrite of `confidence.css`; modal is now a flex column with fixed header/footer and scrollable body; responsive: compact (<768) stacks all form rows, wide uses 2-col grid
- Old event listeners for `addChecklistItemBtn` (removed from HTML) replaced with modal-level event delegation
- Files: `public/app.js`, `public/confidence.css`, `public/planner.html`

## [2026-04-15] Fix activity notes — separate from decline flow, passed to Replace/Modify LLM call

- Notes textarea (`activity-notes-text`) moved out of `.decline-feedback` into its own `.activity-notes` section — always visible, saves without declining the activity
- "Save Notes" now only writes to `state.reviewed[id].notes`; no longer sets `approved: false`
- Decline flow retains its own `.decline-reason` textarea + "Replace/Modify" button (renamed from "Replace Activity")
- Notes are included in the `/api/activity/replace` payload and injected into the LLM prompt as additional context
- Both inline card and mobile expand overlay handlers updated; notes pre-populated from `state.reviewed` on card build
- Files: `public/app.js`, `public/styles.css`, `src/server.js`

## [2026-04-15] Fix decline button — one-click toggle, mobile ReferenceError, removed Customize section

- Removed `pointer-events: none` from `.btn-decline.inactive` — was blocking all hover and click events (`public/styles.css`)
- Decline button is now a simple one-click toggle matching approve: click to decline, click again to un-decline (`public/app.js`)
- Removed hidden feedback reveal step — `decline-feedback` section always visible, no disable/enable of the button
- Removed the "Customize" section (notes textarea + apply-note button) and all related event wiring — superseded by the feedback section
- Moved `syncVerdictClasses` from inside `buildActivityCard` closure to module scope — it was inaccessible to `openCardExpand`, causing a silent ReferenceError on mobile when decline/approve was tapped in the expanded overlay (`public/app.js`)
- Added "Saved" confirmation flash (1.5s) on Save Notes button — both inline card and expand overlay

## [2026-04-15] Activity card UX — decline flow, mobile map button, mobile card state fix

- Replaced "Cancel" button in decline feedback panel with "Save Notes" — marks card as declined with reason saved, no API call or replacement fetched (`public/app.js`)
- "Replace Activity" button remains as the only path that triggers the replace API
- Switched apply-note checkmark `✔` to Phosphor `ph-floppy-disk` icon (`public/app.js`)
- Showed `flip-btn` (map icon) on mobile so it sits in the same row as type/verdict badges — was `display: none` (`public/styles.css`)
- Map overlay goes full edge-to-edge on mobile (`padding: 0`, `border-radius: 0`) with larger close button tap target (`public/styles.css`)
- Fixed approve/decline in mobile expanded card overlay: buttons now mutate `state` directly instead of delegating to source card DOM clicks — source card is destroyed by `renderActivities()` before delegation could complete (`public/app.js`)
- Full decline flow (Save Notes + Replace Activity) wired in expanded overlay, not just approve/decline

## [2026-04-14] Fix mobile UI scaling — buttons oversized, fields clipped, chat panel cut off

- Root cause: the `@media (max-width: 767px)` block in `styles.css` applied `min-height: 44px` globally to all buttons with no padding reduction, causing them to stack large; drawer grid sections (`accommodation-row`, `arrival-row`, `departure-row`) used `minmax` columns that overflowed on narrow screens; chat panel used `position: absolute` relative to its `position: fixed; right: 24px` parent, causing `left: 0; right: 0` to be offset and clip the panel
- Fix 1: reduced button `min-height` to 40px, `padding` to `7px 12px`, `font-size` to `0.88rem` on mobile; tightened `.setup-actions` gap; gave `.step-nav-split` buttons `width: 100%`
- Fix 2: added `width: 100%; min-width: 0` to `input[type="date"]` inside city rows to prevent grid cell overflow
- Fix 3: changed `#chatPanel` mobile override to `position: fixed; left: 0; right: 0; bottom: 0` — decouples it from the offset parent so it anchors to the full viewport edge
- File: `public/styles.css`

## [2026-04-14] Fix mobile crash when rapidly tapping step header navigation

- Root cause 1: no transition lock on `setStep()` — rapid mobile taps fired multiple concurrent render calls (renderArrange, renderItinerary, renderConfidence) in the same frame, causing DOM thrashing and crash
- Root cause 2: `renderArrange()` created new Sortable instances on every call without destroying previous ones — accumulated orphaned drag handlers corrupted the DOM under rapid navigation
- Root cause 3: step indicator lacked mobile touch CSS — missing `touch-action: manipulation` caused 300ms delay + double-tap zoom; missing `user-select: none` caused text selection flicker
- Fix 1: added `requestAnimationFrame`-based transition lock in `setStep()` — drops any `setStep` call that arrives before the previous frame completes
- Fix 2: introduced `_arrangeSortables` array; all Sortable instances are tracked and `.destroy()`-ed at the start of each `renderArrange()` call
- Fix 3: added `touch-action: manipulation`, `user-select: none`, `-webkit-tap-highlight-color: transparent` to `.step` in `styles.css`
- Files: `public/app.js`, `public/styles.css`

## [2026-04-14] Fix structural navigation bug — setStep() as single source of truth for step rendering

- Root cause: 3 independent navigation systems (Next/Back buttons, step tab clicks, browser back/popstate) each had their own ad-hoc render logic; step tabs and browser back only handled steps 3/4, never step 2 — navigating to Review via tab or browser back showed a blank/stale panel
- Fix: `setStep()` now owns all step-entry rendering (`renderCities` for step 1, `renderActivities` for step 2, `renderArrange` for step 3, `renderItinerary` for step 4) gated on `n !== prev`
- Removed redundant render calls from `goToPreviousStep()`, step tab click handler, and `popstate` handler — all three now just call `setStep()`
- File: `public/app.js`

## [2026-04-14] Fix mobile navigation and layout bugs (iOS WebKit / Brave on iPhone)

- Back button caused full page reload on iOS: added `history.replaceState({ spa: true, step: 1 })` seed at init; `setStep()` now calls `pushState({ spa: true, step: n }, '')` (null URL, no address bar change); `popstate` handler guards on `e.state?.spa` to prevent real navigation
- Header buttons unclickable on mobile: added `position: relative; z-index: 100` to `.topbar`
- Chat concierge panel shifted off-screen: changed mobile `#chatPanel` from `right: -24px` to `right: 0; left: 0`
- City card row layout collapsed to unlabeled stacked fields: replaced `grid-template-columns: 1fr` with explicit `nth-child` grid placement — toggle+city+remove on row 1, dates side-by-side on row 2, notes full-width on row 3
- Files: `public/app.js`, `public/styles.css`

## [2026-04-14] Full UI overhaul — premium light theme per UI.md design system

- Replaced dark theme (navy bg) with egg-shell light base (#F5F0EB) + navy navigation anchors (#0B2545)
- Added Plus Jakarta Sans for headings, kept Inter for body; three-tier shadow system (sm/md/lg)
- Restyled all components per UI.md: pill buttons, outlined secondary buttons, generous card padding, soft shadows, no heavy borders
- Updated landing page (index.html) Tailwind config and all utility classes to light palette
- Updated planner.html inline styles for Trip Health panels to use new tokens
- Rewrote home.css hero gradient for light theme
- Rewrote confidence.css with new palette tokens
- Added three-tier responsive breakpoints: compact (<768), medium (768-1024), wide (>1024)
- 44px min touch targets on compact, bottom-sheet modals on mobile, pill search inputs in chat
- No functional changes — all IDs, JS class references, and core behavior preserved
- Files: `public/styles.css`, `public/styles/home.css`, `public/confidence.css`, `public/index.html`, `public/planner.html`

## [2026-04-14] Trip Health refresh (Confidence Check reposition)

- Reframed Confidence Check UI to Trip Health (same core feature, refreshed IA/UX)
- Replaced topbar text badge with Phosphor heartbeat icon entrypoint and status-tinted state styling
- Renamed step label and page content from Confidence to Trip Health
- Reorganized Trip Health into separate surfaces:
  - health summary (status, open issues, unresolved bookings, verified count, top issue)
  - budget summary (checklist running total, total budget, over/under)
  - editable checklist area
  - issue review area with fix/verify/dismiss/note actions
- Expanded checklist editor fields: type, location, reservation name, date/time, notes, booking reference, budget USD, status, verified
- Added issue triage persistence (`confidence.issueMeta`) through snapshot, itinerary payload, and confidence API save route
- Extended checklist normalization in frontend/server confidence modules to preserve richer fields
- Updated confidence tests for new status migration model (`resolved`) and richer migrated field expectations
- Files: `public/planner.html`, `public/app.js`, `src/confidenceCheck.js`, `src/server.js`, `src/confidenceCheck.test.js`, `PROJECT_NOTES/architecture.md`, `PROJECT_NOTES/current_state.md`

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
