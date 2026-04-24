# Repo Cleanup & Modularization Plan

_Last updated: 2026-04-23_
_Branch: `feature/repo-modularization`_
_Status: PROPOSAL — no edits yet_

## Guiding principle

Modularize ONLY where logic is **truly duplicated** AND extraction collapses N call sites into one canonical implementation. The goal: changing one feature = editing one function.

If forcing code through a wrapper adds indirection without removing duplication, leave it alone. Indirection without dedup is just complexity.

## Why phased

Three reasons to execute in ordered phases (not three separate plans, one plan with ordered work):

1. **Regression safety** — Phase 2 (backend split) needs the supertest harness from Phase 1 in place first. Phase 3 (frontend split) is the highest-risk and benefits from a stabilized backend underneath it.
2. **Reviewability** — Each phase produces a coherent set of commits that can be reviewed and reverted independently.
3. **Stop points** — You may decide after Phase 1 or Phase 2 that the gains are sufficient. Each phase leaves the repo in a better, fully-functional state than before.

## Current state (2026-04-23 measurements)

- [src/server.js](src/server.js) — **1844 LOC** (CLAUDE.md says 1611; drift documented)
- [public/app.js](public/app.js) — **8738 LOC** (CLAUDE.md says 7692; drift documented)
- 3 byte-equivalent duplicates between `src/` and `public/js/` (buffers, arrival buffers, activityMigration)
- 3 unused frontend modules ([apiService.js](public/js/apiService.js), [overlayManager.js](public/js/overlayManager.js), [statePersistence.js](public/js/statePersistence.js)) — created in a prior session, never wired
- 0 HTTP integration tests — only unit tests for pure helpers

---

# PHASE 1 — Low-risk dedup + safety net

**Goal:** Eliminate documented duplications, wire (or delete) the dead modules, install a regression net before riskier phases. No structural changes to `server.js` or `app.js`.

## 1.1 Resolve the 3 dead frontend modules

### DELETE [public/js/apiService.js](public/js/apiService.js)
[public/app.js:3286-3292](public/app.js) already defines `apiFetch` doing the exact same thing (Bearer token injection on `fetch`). The module's `requestJson` helper is two lines of value but every existing call site does `const res = await apiFetch(...); const data = await res.json();` inline and works fine. Wiring `apiService` would replace one wrapper with another — zero behavior change, just movement. The duplicate IS `apiService.js`. Delete it.

### KEEP and WIRE [public/js/statePersistence.js](public/js/statePersistence.js)
The pattern `try { JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }` repeats verbatim at:
- [public/app.js:244-251](public/app.js) `loadGeocodeCache`
- [public/app.js:372-378](public/app.js) (places cache)
- [public/app.js:6820-6826](public/app.js) `getMinimalOfflineStore`
- [public/app.js:7591-7593](public/app.js) `loadChatSessionMap`
- [public/app.js:7740-7745](public/app.js) (snapshot load)

Replace each load+save pair with `persist.loadJson(KEY, {})` / `persist.saveJson(KEY, value)`. Five sites collapse to one canonical implementation.

**Do NOT touch** the ~10 raw-string `getItem`/`setItem` calls (`USER_ID_KEY`, `VIEW_MODE_KEY`, `chat_session_id`, etc.) — they aren't JSON, the wrapper doesn't apply.

### KEEP and WIRE [public/js/overlayManager.js](public/js/overlayManager.js) — true modals only
Today no code sets `body.overlay-active`, so background scroll is uncontrolled when modals are open (latent UX bug). Wire ONLY backdrop modals (8 sites):
- `prefsModal`, `checklistModal`, `budgetOptOverlay`, `addActivityModal`, `activityMapOverlay`, `attachmentViewerModal`, `expandModal`, `myTripsPanel` (debatable; it's a slide-out — leave for now if uncertain).

Add a CSS rule `body.overlay-active { overflow: hidden }` to [public/styles.css](public/styles.css).

**Do NOT touch** the ~30 inline visibility toggles for non-modal elements (banners, dropdowns, validation messages, autocomplete lists, AI-summary collapse, tripHealthPopover, profileMenuDropdown, apiBanner). Forcing them through `overlayManager` is overhead — they don't need scroll lock.

## 1.2 Consolidate client/server duplicates into `shared/`

[CLAUDE.md](CLAUDE.md) and [PROJECT_NOTES/current_state.md](PROJECT_NOTES/current_state.md) both flag: **"Buffer tables duplicated in src/ and public/js/ — must stay in sync."** Three files are byte-equivalent (modulo wrapping):

| Server | Client |
|---|---|
| [src/arrangeBuffers.js](src/arrangeBuffers.js) | [public/js/arrangeBuffers.js](public/js/arrangeBuffers.js) |
| [src/arrangeArrivalBuffers.js](src/arrangeArrivalBuffers.js) | [public/js/arrangeArrivalBuffers.js](public/js/arrangeArrivalBuffers.js) |
| [src/activityMigration.js](src/activityMigration.js) | [public/js/activityMigration.js](public/js/activityMigration.js) |

### Plan
1. Create `shared/` at repo root.
2. Move each file in once, with a dual-format export footer:
   ```js
   if (typeof module !== 'undefined' && module.exports) module.exports = exportsObj;
   else if (typeof window !== 'undefined') Object.assign(window, exportsObj);  // preserve existing global names
   ```
3. **Audit existing global names first** — `arrangeBuffers.js` currently exposes `arrivalBufferMins`, `departureBufferMins` etc. as bare top-level functions that become `window.*`. The new module must keep those exact names alive or app.js breaks.
4. [src/server.js](src/server.js): change `require('./arrangeBuffers')` → `require('../shared/arrangeBuffers')` (and same for the other two).
5. [src/server.js](src/server.js): add `app.use('/shared', express.static(path.join(__dirname, '..', 'shared')))`.
6. [public/planner.html](public/planner.html): change script srcs from `/js/...` to `/shared/...`.
7. Update tests: [src/arrangeBuffers.test.js](src/arrangeBuffers.test.js), [src/arrangeArrivalBuffers.test.js](src/arrangeArrivalBuffers.test.js), [src/activityMigration.test.js](src/activityMigration.test.js) — change require path.
8. Delete the 6 old files.

### Out of scope (deferred to Phase 2)
Time helpers (`parseTimeString`, `parseTimeTo24`, `minutesFromTime`, `timeFromMinutes`, `extractTimeFromDateTime`) and `tripHealth` are also duplicated client/server but the implementations have **diverged** subtly. Consolidating requires diffing both versions and choosing canonical behavior — riskier, belongs in Phase 2 alongside the broader backend services extraction.

## 1.3 Small backend dedups (groundwork for Phase 2)

### Collapse `pickFirstAccommodation` / `pickLastAccommodation` ([src/server.js:271-277](src/server.js))
Two functions with identical bodies except first/last selection. Combine into `pickAccommodation(itinerary, position)`. Saves ~6 LOC and one stale-divergence risk.

### Extract booking-link URL builder
The same GetYourGuide / Viator / Tickets / Maps URL construction lives at [src/server.js:961-985](src/server.js) AND [src/server.js:1236-1251](src/server.js). Extract to `src/services/bookingLinks.js` with one function `buildBookingLinks(activity, city)`. Both call sites import from there. This seeds the `services/` directory used heavily in Phase 2.

## 1.4 Supertest smoke harness (regression net for Phase 2)

**Why now:** Zero HTTP integration tests today. Phase 2 will move every route definition — without a smoke net, breakage is silent.

**Scope:** One new file [src/server.smoke.test.js](src/server.smoke.test.js):
- Boots Express app with mocked LLM SDKs (canned JSON responses)
- Asserts every `/api/*` route is mounted: 401 unauthed, 200/4xx authed
- Asserts response **status only**, not body content. The point is reachability.

**Dep:** Add `supertest` as a devDependency. Standard tool, ~50KB.

## 1.5 Phase 1 commit sequence

1. `refactor: consolidate buffer + migration constants into shared/` (1.2)
2. `refactor: route localStorage JSON access through statePersistence` (1.1b)
3. `refactor: route modal show/hide through overlayManager` (1.1c)
4. `chore: remove unused apiService wrapper (apiFetch is canonical)` (1.1a)
5. `refactor: dedupe accommodation picker and booking-link builder` (1.3)
6. `test: add smoke harness covering all /api routes` (1.4)

After each commit: `npm test` + manual smoke (load planner page, generate itinerary, open each modal).

---

# PHASE 2 — Backend modularization

**Goal:** Split [src/server.js](src/server.js) (1844 LOC) into a thin entry + route modules + service modules + middleware. Final `server.js` ≈ 5 lines. Each route file 60-180 LOC. Behavior preserved exactly.

## 2.1 Target layout

```
src/
  server.js                   # entry: require('./app'), app.listen
  app.js                      # express app builder, mounts middleware + routes
  config/
    env.js                    # centralize process.env reads
  middleware/
    auth.js                   # requireConfiguredAuth, attachUserId
    llmSemaphore.js           # acquireLlmSlot, releaseLlmSlot
    nominatim.js              # nominatimFetch queue
    attachmentUpload.js       # multer config
  routes/
    status.js                 # /api/status, /api/auth/session
    geocode.js                # /api/geocode, /api/places/resolve
    activities.js             # /api/activity/refine, /api/activity/replace, /api/arrange-config, /api/arrange
    plan.js                   # /api/plan SSE
    image.js                  # /api/image
    commute.js                # /api/commute
    preferences.js            # /api/preferences*, /api/profile/enrich
    userdata.js               # /api/userdata*
    chat.js                   # /api/chat/*
    itinerary.js              # CRUD + trip-health get/put + email-summary
    calendar.js               # Google OAuth + sync + ICS download
    email.js                  # /api/email/inbound
    attachments.js            # /api/itinerary/.../attachments
  services/
    bookingLinks.js           # (already created in Phase 1)
    distanceMatrix.js         # fetchDistanceMatrixLeg, getCommuteBetweenActivities, etc.
    chatPrompt.js             # buildChatSystemPrompt, parseChatResponse, processChatSignals
    profilePrompt.js          # formatProfileForEnrichment, sliderInterestLabel
    imageQuery.js             # extractImageKeywords, buildImageSearchQuery
    arrangePrompt.js          # auto-arrange prompt template
    calendarIcs.js            # buildItineraryIcs, escapeIcsText, toIcsDate
    tripHealthEmail.js        # sendTripHealthSummaryEmail
```

## 2.2 What stays in `server.js`

```js
require('dotenv').config();
const app = require('./app');
const PORT = Number(process.env.PORT || 3457);
app.listen(PORT, () => console.log(`TravelPlanner listening on http://localhost:${PORT}`));
```

## 2.3 What `app.js` (new) holds

- `express.json({ limit: '1mb' })`
- `clerkMiddleware()`
- The dynamic `/planner.html` Clerk-key injection block ([src/server.js:105-112](src/server.js))
- `express.static(public)` and `express.static(shared)`
- Public routes: `/api/status`, `/api/auth/session`, `/api/email/inbound`, `/api/geocode` (these run BEFORE the auth gate — preserve order)
- The auth gate: `app.use('/api', requireConfiguredAuth)`
- All authed route mounts: `app.use('/api/itinerary', require('./routes/itinerary'))`, etc.
- SPA catch-all: `app.get('*', ...)`

## 2.4 Migration sequence

**Pure helpers first** (no Express dep): create `services/calendarIcs.js`, `services/imageQuery.js`, `services/profilePrompt.js`, `services/chatPrompt.js`, `services/distanceMatrix.js`, `services/arrangePrompt.js`. Move functions verbatim, add `module.exports`. Update server.js to require from new location.

**Then middleware**: `middleware/llmSemaphore.js` (export `{ acquire, release }`), `middleware/auth.js` (export `requireConfiguredAuth`, `getAuthedUserId`, plus a new `attachUserId` middleware that resolves once per request — this eliminates the `parseUserId(getAuthedUserId(req))` repetition that occurs ~10 times).

**Then routes**: one per file. Each exports `function register(router)` mounting handlers on a passed-in `Router()`. The auth gate stays at app level.

**Don't touch handler bodies during the split** — only relocate. Diff each new file against the old `server.js` to confirm byte-for-byte logic preservation. The smoke harness from Phase 1 catches mounting mistakes.

## 2.5 Ordering hazards (must respect)

- Public routes (`/api/status`, `/api/auth/session`, `/api/email/inbound`, `/api/geocode`) MUST mount BEFORE `app.use('/api', requireConfiguredAuth)`. Move the gate first; verify the four public routes return 200/expected-error and all other `/api/*` return 401.
- The semaphore (`acquireLlmSlot`) is used by the SSE `/api/plan` route — extract first, re-import in same place; do not let the extraction reorder `acquire`/`release` around the existing `try/finally`.
- `app.use(express.static(...))` (currently [src/server.js:114](src/server.js)) MUST remain before all `/api/*` routes or static assets stop loading.

## 2.6 Time-helper consolidation (deferred from Phase 1)

Now that `services/` exists and is wired both ways, create `shared/timeHelpers.js` with the canonical implementations of:
- `parseTimeString`, `parseTimeTo24` (currently in [public/app.js:5020](public/app.js) AND [public/js/activityMigration.js](public/js/activityMigration.js))
- `minutesFromTime` / `parseMinutesFromTime` (server [src/server.js:249-263](src/server.js), client [public/app.js:5035-5045](public/app.js))
- `timeFromMinutes` (both sides)
- `extractTimeFromDateTime` (server [src/server.js:265-269](src/server.js), client [public/app.js:2814](public/app.js))

Diff client and server implementations first. Document any behavior differences as a decision in [PROJECT_NOTES/decisions.md](PROJECT_NOTES/decisions.md) before choosing canonical.

## 2.7 Phase 2 commit sequence (one per file/module)

1. `refactor: extract calendarIcs service from server.js`
2. `refactor: extract imageQuery service from server.js`
3. `refactor: extract profilePrompt service from server.js`
4. `refactor: extract chatPrompt service from server.js`
5. `refactor: extract distanceMatrix service from server.js`
6. `refactor: extract arrangePrompt service from server.js`
7. `refactor: extract llmSemaphore middleware from server.js`
8. `refactor: extract auth middleware from server.js`
9. `refactor: split server.js into app.js entry + status/geocode routes`
10. `refactor: extract /api/itinerary routes`
11. `refactor: extract /api/plan, /api/activity, /api/arrange routes`
12. `refactor: extract /api/chat routes`
13. `refactor: extract /api/preferences, /api/userdata, /api/profile routes`
14. `refactor: extract /api/calendar, /api/image, /api/commute routes`
15. `refactor: extract /api/email, /api/attachments routes`
16. `refactor: consolidate time helpers into shared/timeHelpers.js`

After each commit: `npm test` (smoke + units) + manual click-through.

---

# PHASE 3 — Frontend modularization

**Goal:** Override the existing "keep app.js monolithic" decision (per user 2026-04-23). Split [public/app.js](public/app.js) (8738 LOC) into self-contained feature modules following the existing IIFE pattern. After this, "change the activity card format" = edit one function in one file.

## 3.1 Architectural pattern

Each module:
- Lives in `public/js/` (existing convention)
- IIFE registers a factory on `window.TravelPlanner<Name>`:
  ```js
  (function init(global) {
    function create<Name>({ state, ...deps }) {
      function render() { /* ... */ }
      return { render, /* narrow public API */ };
    }
    global.TravelPlanner<Name> = { create<Name> };
  })(window);
  ```
- Receives mutable `state` by reference (single global object remains shared — refactoring to immutable state is out of scope)
- Owns ONE DOM root and a self-contained slice of state
- Exports a narrow surface (5-10 functions max)

## 3.2 Hard rule for extraction safety

A function may be extracted only if it touches **one self-contained state slice**. If a function reads `state.cities` AND writes `state.activities`, it stays in `app.js` as orchestration glue. The modules below were chosen because each owns a coherent slice.

## 3.3 Modules to extract (in this order)

### 3.3.1 [public/js/activityCard.js](public/js/activityCard.js) — FIRST, highest payoff

**Owns:** activity card DOM template, all cost/badge/link rendering.
**Moves in (from [public/app.js:200-370](public/app.js)):** `headerPriceBadgeHtml`, `renderActivityCostCell`, `priceLevelBadge`, `representativeCostUsd`, `getGetYourGuideLink`, `googleMapsLinkHtml`, `stripMealPrefix`, `actDurationHours`, `actPreferredTime`, `actAddress`, `actCostUsd`, `actCostType`, `actBookingType`, `actBookingLinks`, `actOpeningHours`.
**Exports:** `{ render(activity, ctx), priceBadge(activity), costCell(activity) }`.
**Stays in app.js:** the activity list state and `renderActivities()` orchestration.
**Direct user benefit:** "I want to change the activity card format" → edit [public/js/activityCard.js](public/js/activityCard.js). One file.

### 3.3.2 [public/js/bookingChecklist.js](public/js/bookingChecklist.js)

**Owns:** checklist modal, expanded/collapsed rows, activity↔checklist sync.
**Moves in (from [public/app.js:1346-2552](public/app.js)):** `migrateChecklistType`, `mapActivityTypeToChecklist`, `normalizeChecklistItem`, `checklistItemSortKey`, `sortChecklistByDateAsc`, `groupChecklist`, `formatChecklistDate`, `checklistActivityEndTime`, `truncateLocation`, `collapsedRowText`, `buildChecklistFromState`, `syncActivityNotesToChecklist`, `syncChecklistNotesToActivity`, `syncChecklistDateTimeToPlacement`, `syncChecklistBookingRequirementToActivity`, `renderChecklistItemExpanded`, `renderChecklistContainer`, `renderChecklistModal`, `bindChecklistEvents`, `syncItemFromExpanded`, `openChecklistModal`, `closeChecklistModal`.
**Exports:** `{ open, close, render, build, syncFromActivity, syncToActivity }`.
**Stays in app.js:** the activity-mutation triggers that call sync functions.

### 3.3.3 [public/js/tripHealthView.js](public/js/tripHealthView.js)

**Owns:** trip-health badge, popover, modal.
**Moves in (from [public/app.js:1723-2700](public/app.js)):** `renderTripHealthBadge`, `renderTripHealth`, `computeTripHealthLocal` (or delete this and use `shared/tripHealth.js` from Phase 2.6).
**Exports:** `{ render, refresh }`.

### 3.3.4 [public/js/cityPlanner.js](public/js/cityPlanner.js)

**Owns:** `#cityList`, city autocomplete dropdown.
**Moves in (from [public/app.js:479-1248](public/app.js)):** `addCityRow`, `renderCities`, `sortCitiesByDate`, `cityVariants`, `cityMatches`, `canonicalizeActivityCity`, `formatCitySuggestion`, `renderCitySuggestions`, `fetchCitySuggestions`, `closeCityAutocomplete`, `bindCityAutocompleteOutsideClick`, `validateCityTimeline`, `syncCityLegacyDates`, `normalizeCityLogistics`, `refreshCityTimelineUI`.
**Exports:** `{ render, addCity, sortByDate, validate }`.

### 3.3.5 [public/js/profileWizard.js](public/js/profileWizard.js)

**Owns:** preferences/profile modal.
**Moves in:** profile-related functions at [public/app.js:78-200, 1018-1212, 3295-3673](public/app.js).
**Exports:** `{ open, close, getActive, switchTo, save }`.

### 3.3.6 [public/js/arrangeView.js](public/js/arrangeView.js) — LAST, highest risk

**Owns:** `#arrangeGrid`, day columns, commute pills, drag/drop.
**Moves in (from [public/app.js:4912-6334](public/app.js)):** ~50 functions including `renderArrange`, `makeStagingCard`, `makePlacedCard`, `renderCommuteSelector`, `bindPlacedCardInteractions`, `autoArrangeActiveCity`, `openFinalizeModal`, etc.
**Exports:** `{ render, autoArrange, openFinalize, getPlacements }`.
**Why last:** densest state coupling, drag/drop event handlers, performance-sensitive. Extract only after the simpler modules have proven the pattern.

## 3.4 Optional secondary extractions (decide after 3.3 is done)

- `public/js/itineraryView.js` — view-mode rendering ([public/app.js:6588-7016](public/app.js))
- `public/js/chatPanel.js` — chat UI + session handling ([public/app.js:7591-7716](public/app.js))
- `public/js/savedTrips.js` — my-trips list + load/save ([public/app.js:7192-7313, 8053-8170](public/app.js))

## 3.5 Boot wiring

After all extractions, `app.js`'s boot section becomes:
```js
const cityPlanner = TravelPlannerCityPlanner.createCityPlanner({ state, apiFetch, persist });
const activityCard = TravelPlannerActivityCard.createActivityCard({ state });
const checklist = TravelPlannerBookingChecklist.createBookingChecklist({ state, overlayManager });
// ... etc.
```

`app.js` retains: state initialization, step navigation, top-level event listeners, sync-to-server logic, anything that touches multiple modules' state slices.

## 3.6 Phase 3 commit sequence

1. `refactor: extract activityCard module from app.js`
2. `refactor: extract bookingChecklist module from app.js`
3. `refactor: extract tripHealthView module from app.js`
4. `refactor: extract cityPlanner module from app.js`
5. `refactor: extract profileWizard module from app.js`
6. `refactor: extract arrangeView module from app.js`
7. (optional) `refactor: extract itineraryView / chatPanel / savedTrips`

After each commit: hard refresh in browser, full click-through (steps 1-5, chat, checklist, auto-arrange, calendar sync, attachment upload).

## 3.7 Update [PROJECT_NOTES/decisions.md](PROJECT_NOTES/decisions.md)

Append a decision entry overriding the prior "keep app.js monolithic" stance with the new rationale (per-feature edit isolation).

---

# Out of scope (entire plan)

- Data file formats (`/data/*.json` schemas untouched)
- ID conventions (`it_*`, `chk_*`, activity IDs unchanged)
- Auth model (Clerk middleware + `req.auth.userId` scoping unchanged)
- Persistence strategy (still flat JSON; no Redis/SQLite)
- LLM models / prompts (Sonnet 4.6, Haiku 4.5, gpt-5.4-mini selections preserved; `SYSTEM_PROMPT` text untouched)
- External API integrations (Brave, Unsplash, Google Maps, Resend, Google Calendar — surface preserved)
- Build pipeline (still no bundler, no TypeScript)
- External `/api/...` URLs (every route path stays exactly where it is)
- Service worker ([public/sw.js](public/sw.js))
- CSS files (separate concern; if you want CSS split later, scope as its own session)
- Adding immutable state / observable patterns to frontend

---

# Risks & rollback

- **Each commit in each phase is independently revertable.** If Phase 2 commit 9 breaks something, `git revert` that commit; commits 1-8 are still wins.
- **Phase 1 is reversible by design** (no structural changes).
- **Phase 2's biggest risk** is reordering middleware around the auth gate. Mitigation: smoke harness from 1.4 catches it immediately.
- **Phase 3's biggest risk** is state-coupling bleed between modules. Mitigation: extract simpler modules first (3.3.1 - 3.3.5) to validate the pattern before touching arrangeView (3.3.6).

---

# Decisions (confirmed 2026-04-23)

1. Delete [public/js/apiService.js](public/js/apiService.js) — `apiFetch` is canonical.
2. Add `supertest` as a devDependency.
3. Wire `myTripsPanel` through overlayManager — user will test and revert if needed.
4. Phase 3.4 secondary extractions (itineraryView / chatPanel / savedTrips) → tracked as open items / optional follow-ups.
5. Execute one phase at a time. Pause for user review at each phase boundary.
