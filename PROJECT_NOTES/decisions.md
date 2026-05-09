# Decisions

Append-only. Records permanent architectural and design decisions.

---

## [2026-05-08] Drop breakfast from generated meal slots; lunch + dinner only

**Decision:** The activity-generation prompt now generates 2 meals per full day (lunch + dinner) instead of 3. The `breakfast` value is removed from the activity `type` enum. Activity-level breakfast picks (specific named cafés) can still appear if Sonnet judges them high-signal, but they come back as `food` type rather than mandated.
**Reasoning:** Breakfast is usually low-effort: hotel buffet, café next door, or skipped. Forcing the LLM to name a specific 7:30am restaurant every day produced low-signal recommendations and ate one of the day's meal slots that the user rarely used meaningfully. Lunch and dinner are the meals worth curating.
**Alternatives rejected:** (1) Keep 3 meals but soften breakfast wording — still produces forced low-signal picks. (2) Make breakfast optional via a profile question — adds a knob nobody will tune.
**Tradeoffs:** Old itineraries with `type: "breakfast"` activities still render correctly (the type tag is descriptive only, and arrange-step CATEGORY_HINTS still maps "breakfast" to its 07:30-10:30 window). New plans will not include breakfast unless Sonnet decides one is genuinely worth recommending.

## [2026-05-08] Activity count is a target with a ceiling, not an unbounded floor

**Decision:** Generation prompt now specifies `target` activities with a `minTotal–maxTotal` acceptable range, where `maxTotal = round(minTotal * 1.15)`. Old prompt only set a hard floor with explicit "you may exceed."
**Reasoning:** Without an upper bound the LLM produces ~50% more activities than fit, the user reviews a maximalist set, and the arrange step receives a payload that physically can't schedule. A 15% ceiling buffer leaves room for review-step decline churn without overproducing.
**Alternatives rejected:** (1) Server-side trim post-generation — generation cost is sunk, and trimming hides regressions. (2) Same floor, no ceiling — the original behavior, which produced this bug.
**Tradeoffs:** Power-user pace-5 trips may feel slightly less stuffed. Acceptable; user can manually add via the "+ Add Activity" card in review if they want more.

## [2026-05-08] Strip `verdict` / `start_location` / `end_location` / `duration` (string) / `dedicated_time_block` from the LLM schema

**Decision:** All five fields removed from the activity-generation schema. `verdict` is gone entirely; `dedicated_time_block` is derived server-side from `durationHours >= 2`; `start_location`/`end_location` are dropped (activities are points, not routes); `duration` (string) is dropped (`duration_hours` is the only source of truth, frontend formats display strings).
**Reasoning:** Sonnet is good at synthesis when given clean primitives; it gets worse when asked to track 3+ overlapping rule systems. The Decision Framework rule says "do not recommend if Fun Factor is LOW," but the schema asked for `verdict: "Skip"` — the model has to satisfy two contradictory framings. `start_location` + `end_location` for a museum makes the model invent routes for stationary venues. `duration_hours` + `duration` is the same data twice, and the string is regex-parsed back to the number downstream.
**Alternatives rejected:** Keeping fields "for backwards compat" — legacy itineraries already have them, and `normalizeActivity`'s read-side fallbacks still handle old data; the LLM just stops producing them.
**Tradeoffs:** Frontend code that rendered the verdict badge is removed (different from the user's approve/decline state, which is unaffected). Calendar exports now prefer `location.address` and fall back to old fields for legacy itineraries.

---

## [2026-05-08] `insider_tips` is a separate field, not appended to `why_it_fits`

**Decision:** Added `insider_tips` as a distinct optional string on the activity schema rather than extending `why_it_fits` or `pitfall`. Rendered with a 💡 accent so users can visually triage it as "extra credit knowledge."
**Reasoning:** `why_it_fits` is the sales pitch ("why this matches you"); `pitfall` is "what to avoid." Insider tips are operational knowledge — peak crowding, best arrival time, neighborhood quirks, destination pricing arbitrage. Mixing these dilutes all three. Keeping them split also lets the LLM rule say "return null when you have no factual tip" without contaminating the always-required pitch copy.
**Alternatives rejected:** (1) Extending `why_it_fits` — would force the LLM to either always include a tip or include hedged filler; rejected. (2) Storing tips in `state.reviewed[id].notes` — that's user-authored space, not LLM output; rejected.
**Tradeoffs:** One extra schema field that legacy itineraries won't have (renders cleanly as nothing). Brave quota cost: one additional always-on `searchInsiderTips` call per planned city.

## [2026-05-08] Shopping is a first-class interest, not a tag on existing categories

**Decision:** Added `shoppingPerson` (1-5 slider) + `shoppingInterests` (freeform text) to the profile wizard, a dedicated `shopping` activity type, and a conditional Brave query (`searchShoppingDistricts`) that fires only when `shoppingPerson >= 3`. Shopping activities require specific stores/districts, tax-free refund + price-comparison guidance in `insider_tips`, and `booking_type: "none"`.
**Reasoning:** Real-trip feedback showed travelers wandering Madrid without recommendations because no profile signal captured shopping interest. The existing 6 sliders covered cultural/food/outdoor/nightlife — retail was invisible to the planner. A dedicated slider + freeform anchor lets the LLM generate category-specific picks (Druni/Primor for fragrance, Zara for US-vs-EU pricing arbitrage, Salamanca for luxury) instead of generic "shopping in city center."
**Alternatives rejected:** (1) Putting "shopping" inside `aboutMe` text — too unstructured for the LLM to weight reliably across cities. (2) Inferring shopping from `budgetStyle` text — silent and inconsistent. (3) Always firing the Brave shopping query — wastes the 2000/month quota for travelers who don't shop; rejected in favor of the `>= 3` gate.
**Tradeoffs:** New profile field requires existing users to re-run wizard for ideal results; default value of 3 means existing users start receiving low-volume shopping recs (acceptable since the floor scales to trip length).

---

## [2026-04-28] Google Places is the source of truth for opening hours; LLM string is fallback only

**Decision:** Widened the existing Places Text Search FieldMask to include `regularOpeningHours` and `location` alongside `priceLevel`. When Places returns hours, we overwrite the LLM-emitted `opening_hours` string in both `activity.timing.opening_hours` and the legacy top-level `activity.opening_hours`. When Places returns no hours, the LLM string is preserved untouched. Applies to a new `VENUE_CATEGORIES` set: food categories ∪ `museum, gallery, landmark, market, show, shopping, spa, sports, cultural`. Tours, walks, parks, sunsets, neighborhoods skip Places lookup entirely (open-air or composite venues).

**Reasoning:** The arrange validator's opening-hours gate ([src/arrangeValidator.js:132](src/arrangeValidator.js#L132)) was the highest-leverage hallucination foot-gun in the system: if Claude's `opening_hours` string was wrong, a perfectly-fine schedule would fail validation and the activity would bounce to `unplaced`. We were already paying for a Places call per food activity for `priceLevel`; adding the hours field to the same FieldMask is a free upgrade in terms of round-trips and stays inside the same Text Search Advanced SKU tier (no billing change). LLM hours can drift weekly; Places hours are first-party current data.

**Alternatives rejected:** (a) Switch to Place Details endpoint for the second call — rejected; doubles the round-trip count for no quality gain. (b) Expand to all activity categories including tours/walks — rejected; tours don't typically have a Places entry of their own (they inherit from the venue), and matching on a tour name would mis-resolve to a random business. (c) Model day-of-week closures (museum closed Mondays) — deferred. The current `parseOpeningHours` reads a single weekly-union string; a Monday placement could pass even if the museum is closed Mondays. Acknowledged as a Wave 2+ improvement.

**Tradeoffs:** Day-of-week closure modeling deferred. The cache value shape changed from `{priceTier}` to `{priceTier, openingHours, location}` — old cached entries continue to work (we read keys defensively) and refresh organically as the 90-day TTL expires. A `[places-hours-delta]` console log fires whenever LLM and Places hours disagree; this is intentionally chatty in the first weeks for observability and can be downgraded later.

## [2026-04-28] Same-venue activity pairs bypass the 20-min walk buffer

**Decision:** `MIN_BUFFER_BETWEEN` (20 minutes between activities) is now skipped when two activities share a venue. Detection uses lat/lng (4-decimal precision, ~10 m), with `venue_name` and address as fallbacks for activities that haven't been geocoded yet at planning time. Implemented in `bufferBetween()` in `src/arrangeValidator.js`.

**Reasoning:** The 20-minute buffer represents walk time between separate locations. When the user (or the LLM) intentionally schedules two activities at the same venue — e.g., dinner then drinks at the bar across the street, or a wine tasting followed by dinner at the same restaurant — the buffer was firing and triggering false-positive overlap failures, pushing legitimate placements into `unplaced`. The buffer was modeling something real; we just had no concept of "no transit needed" in the data model.

**Alternatives rejected:** (a) Reduce the global buffer to 10 minutes — rejected; legitimate cross-city walks really do need ~20. (b) Make the buffer LLM-supplied per-pair — rejected; gives the model another arithmetic surface to get wrong, when the venue match is mechanically obvious. (c) Drop the buffer entirely — rejected; same reason as (a).

**Tradeoffs:** The lat/lng path requires venues to be geocoded; at `planCity` time they aren't yet (lat/lng are populated later by `/api/places/resolve`). The fallback to `venue_name` lowercase exact-match handles the common case. Activities with neither populated coordinates nor a venue_name will continue to use the 20-min buffer (safe default).

---

## [2026-04-27] No deterministic time-assignment fallback; broken activities go to `unplaced`

**Decision:** Deleted `src/arrangeTimeAssigner.js` entirely. `/api/arrange` is now a two-tier flow: LLM proposes times → validator → optional repair pass. If repair still fails physics validation, the offending placements are moved to `unplaced` with reason `physics_unresolved` for the user to fix manually in the UI. There is no third-tier deterministic placement.
**Reasoning:** The fallback was scaffolding from when the LLM was order-only and JS owned time-picking. Once Sonnet 4.6 was given direct timing, the fallback ran rarely and, when it did run, applied stale rules (notably `MEAL_BANDS` forcing American meal customs onto Spain/Japan/etc.) that conflicted with the LLM's better judgment. Surfacing physics-unresolvable activities to the user is more honest and avoids silent wrong placements; the existing `unplaced` chip/panel UI already handles them.
**Alternatives rejected:** (a) Keep the fallback but strip `MEAL_BANDS` — rejected as half-measure; the rest of the assigner (earliest-slot greedy, opening-hours-only logic) was also worse than the LLM's reasoning. (b) Add a third repair pass before falling back — rejected; if two LLM passes can't resolve physics, a third unlikely will, and "unplaced" is a clear signal for manual intervention.
**Tradeoffs:** Trips that previously got force-placed by the fallback may now show items in the unplaced panel. Acceptable — better visibility than silent bad placement. Validator still imports the four time helpers (`effectiveDayStart`, `effectiveDayEnd`, `getDuration`, `parseOpeningHours`); they were inlined into the validator since it became their only caller.

## [2026-04-27] Removed `MEAL_BANDS` — global meal-time intersection was wrong by design

**Decision:** Removed `MEAL_BANDS` from `src/arrangeConstants.js`. Meal times are now a function of opening hours and LLM judgment only, with no hard-coded breakfast/lunch/dinner windows.
**Reasoning:** `MEAL_BANDS` defined breakfast as 7–9am, lunch 11:30am–1:30pm, dinner 6–8:30pm and intersected these with opening hours in the assigner — which would force a Madrid restaurant open until midnight to serve dinner by 8:30. Sonnet 4.6 knows local meal customs (Spanish dinner 9:30pm, Japanese fish-market breakfast 6am, Mediterranean lunch 2pm) far better than a hard-coded American-default table. Validator already enforces opening hours, which is the only physical constraint that matters.
**Alternatives rejected:** (a) Make `MEAL_BANDS` city-aware via a lookup table — rejected as the wrong axis; meal customs vary by venue and season as much as by city, and the LLM already integrates these. (b) Pass `MEAL_BANDS` as soft hint in the prompt — rejected; the prompt already says "use what you know about local meal customs," adding a default table would push back against that.
**Tradeoffs:** None observed. The single remaining caller (`arrangeTimeAssigner.js`) was deleted in the same sweep, so removal was safe.

---

## [2026-04-27] Validator enforces physics only, not taste

**Decision:** The arrange validator (`src/arrangeValidator.js`) checks only mechanical/structural rules: overlap with buffer, lock overlap, day-window, opening hours. Removed `meal_cap` (≤1 of each meal type) and `category_cap` (≤2 of any non-meal category) — those are judgment calls, not physical constraints.
**Reasoning:** The hybrid arrange split (LLM picks order, JS picks times) was severing the LLM's ability to act on semantic intent like "sunset drinks" or "no two food events back-to-back." Pulling the LLM back into time-selection meant the validator's job needed to shrink to match. Modern Sonnet won't schedule three museums in a row; rules-as-validator was scaffolding for a problem that no longer exists. Each rule we remove from the validator is a rule the user no longer has to fight when their intent doesn't fit the rule (e.g. a planned tapas + dinner pairing is now allowed; the LLM can use judgment).
**Alternatives rejected:** (a) Keep the caps as soft warnings — rejected, would still surface as `diagnostics` and confuse users. (b) Move caps into the prompt as guidance — also rejected; they were not adding value at the prompt layer either, since Sonnet already paces well.
**Tradeoffs:** If we ever swap to a weaker/cheaper model, the safety net for "3 museums in a row" outputs is gone — would need to be added back as prompt guidance, not as validator rules. Accepted.

## [2026-04-27] Restaurant price tiers come from Google Places, not LLM cost guesses

**Decision:** `price_tier` (1–4 → `$`–`$$$$`) is sourced from Google Places API Text Search `priceLevel` field, cached in `data/places-cache.json` keyed by `name|city`. Enrichment runs once per food activity inside `planCity`.
**Reasoning:** Cost-bucket thresholds derived from `estimated_cost_usd` (itself an LLM guess) compound error. Places `priceLevel` is grounded ground truth and uses the same `GOOGLE_MAPS_API_KEY` already configured for Distance Matrix — no new credential, no new vendor. Caching keeps marginal cost near zero ($0.32 per ~10 unique restaurants, then free on re-plans).
**Alternatives rejected:** (a) Threshold-derive from `estimated_cost_usd` — rejected because it inherits the LLM's cost guess and would feel inconsistent (Casa Lucio bucketed by an LLM number rather than what diners actually pay). (b) Have Claude emit `price_tier` directly — rejected because it's another LLM-judgment field that would drift across plans for the same restaurant.
**Tradeoffs:** Generic activity names ("Tapas Crawl", "Street food walk") won't match a real Place and silently render without a tier. Acceptable — empty subtitle suffix is better than a wrong $$$.

---

## [2026-04-25] Consolidated time helpers into shared/timeHelpers.js

**Decision:** Both client (`public/app.js`) and server (`src/services/distanceMatrix.js`) now import `parseTimeTo24`, `minutesFromTime`, `timeFromMinutes`, `extractTimeFromDateTime` from `shared/timeHelpers.js`. The server-side function name `parseMinutesFromTime` is preserved at the call site via a local rename (`{ minutesFromTime: parseMinutesFromTime }`).
**Reasoning:** Eliminate the silent client/server divergence the plan flagged. Client-side `minutesFromTime` previously had no input validation (NaN propagated); server-side `parseMinutesFromTime` defaulted to `9 * 60` on bad input. Adopted server semantics as canonical because they're stricter and the only test coverage relies on them.
**Alternatives rejected:** (a) Keep two copies, document drift in `decisions.md` only — rejected because the next bug here would still be silent. (b) Pull `parseTimeString` from `shared/activityMigration.js` into the same file — deferred; that helper has different semantics (returns `null` on empty input, not a default) and only one caller, so consolidation adds no value.
**Tradeoffs:** Client now requires `shared/timeHelpers.js` to load before `app.js` (added the script tag in `planner.html`, ahead of `activityMigration.js` which doesn't depend on it). Any caller passing literal numbers as time strings will now hit the strict validator and get `9 * 60` back instead of NaN; this is the intended behavior.

---

## [2026-04-20] Duplicate buffer tables in src/ and public/js/

**Decision:** Buffer values are defined twice — `src/arrangeBuffers.js` (CommonJS for server-side tests) and `public/js/arrangeBuffers.js` (plain script for the browser). No build step, no shared module system.
**Reasoning:** The project uses vanilla JS on the frontend with no bundler. The only way to share constants without adding a build tool is to duplicate the file.
**Alternatives rejected:** Adding webpack/esbuild just for this file; inlining the values in `app.js` (no testability).
**Tradeoffs:** Any change to buffer values must be applied to both files. Documented in this file to prevent drift.

## [2026-04-16] Unified preference system — server-side, user-visible, single LLM input

**Decision:** Replaced the dual-track preference system (signal-derived `liked`/`disliked` + `distilledProfile` on one track; explicit `preferences`/`constraints` on another) with a single unified model: `profileInstruction` (high-level AI summary) + `preferences` + `constraints` (specific learned details). All three fields live server-side. The LLM uses exactly what the user sees and can edit.
**Reasoning:** The old system had two parallel paths that never reconciled — signal-derived data was invisible to the user and couldn't be corrected; `distilledProfile` was a hidden AI-generated prose blob that also duplicated the role of `profileInstruction`. The user's mental model is clear: a high-level summary (editable) and a checklist of specific learned details (editable). One data shape, one render path, one LLM input path.
**Alternatives rejected:**
- Surfacing `liked`/`disliked` signal summaries as tags — rejected because approve/decline activity patterns don't provide enough signal value and add complexity without a clear user benefit.
- Keeping `distilledProfile` as a background AI process — rejected because it was invisible to the user, got overwritten on distillation, and cleared `preferences`/`constraints` as a side effect.
- Merging `profileInstruction` and `distilledProfile` into one field — rejected once it was clear they serve different roles: `profileInstruction` is generated from self-reported answers (what the user tells us), learned preferences capture specifics from interactions (what the AI picks up).
**Tradeoffs:** Approve/decline signals no longer feed any learning mechanism. The only learning path is now explicit extraction from replace/modify notes and chat. This is intentional — signals were too noisy and the user preferred deliberate preference capture.

## [2026-04-16] AI summary regenerates only on profile answer/aboutMe changes

**Decision:** `/api/profile/enrich` is only called when the user's `answers` or `aboutMe` have changed since last save. Manual edits to the AI summary textarea are saved on blur directly to `/api/preferences` without triggering a regeneration.
**Reasoning:** The AI summary and learned preferences are separate entities. Clicking Save after editing something unrelated (or editing the summary itself) should not clobber the user's manual edits with a fresh AI generation.
**Alternatives rejected:** Always regenerate on save — rejected because it overwrites user edits. Separate "Regenerate" button — deferred as a future improvement; the change-detection approach covers the core case cleanly.
**Tradeoffs:** If the user edits the summary and also changes their answers, save will regenerate and overwrite. This edge case is acceptable for now.

## [2026-04-15] Minimal frontend boundary split with fallback-safe loading

**Decision:** Extract only three boundary concerns from `public/app.js` into helper modules: overlay/modal manager (`public/js/overlayManager.js`), API/service layer (`public/js/apiService.js`), and top-level persistence helpers (`public/js/statePersistence.js`), while keeping orchestration in `app.js`.
**Reasoning:** Recent mobile regressions showed that touching unrelated logic in one monolithic file increases blast radius. This split isolates high-churn boundaries first, lowers risk, and makes failures easier to localize without pausing feature work.
**Alternatives rejected:**
- Full rewrite into a framework/module system now — rejected as too risky and time-expensive for current delivery pace.
- No split at all — rejected because it preserves the same fragility pattern.
**Tradeoffs:**
- `public/app.js` remains large by design for now.
- Because `planner.html` still only loads `/app.js` directly in this environment, fallbacks remain in `app.js` when helper globals are missing.
- Chosen approach is intentionally minimal and revertible (easy rollback by inlining boundary helpers if needed).

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

## [2026-04-18] Local filesystem for activity ticket attachments (swappable to cloud)

**Decision:** Store user-uploaded ticket files under `/data/attachments/{userId}/` (flat files + per-user `manifest.json`) with a multer-backed `POST /api/itinerary/:id/activity/:actId/attachments` route. Auth guard ensures files are scoped by Clerk userId. A thin `src/attachmentStore.js` module wraps all disk I/O so the storage backend can be swapped (e.g. to Cloudflare R2) by re-implementing four functions without touching routes or frontend.
**Reasoning:** Fits the existing flat-file / no-database philosophy documented in CLAUDE.md. Zero new credentials or vendors. At 10 MB × ~20 activities × 100 users = ~20 GB worst case, it's comfortable on a standard VPS. Migration trigger: if `/data/attachments/` approaches ~50 GB or backup complexity grows, swap internals for R2.
**Alternatives rejected:** Cloudflare R2 / S3 immediately — rejected because it adds new API credentials, SDK dependency, and complexity for a small user base. Deferring uploads entirely — rejected because the user explicitly wanted this feature now.
**Tradeoffs:** VPS disk is finite. No CDN. Files are not backed up separately unless the VPS backup includes `/data/attachments/`. These are all acceptable given current scale.

## [2026-04-18] Rename "Execution" mode to "Itinerary" mode

**Decision:** Renamed the final step from "Execution" to "Itinerary" everywhere: button label, HTML IDs (prefixed `itineraryMode*`), CSS classes (`.itinerary-mode-*`), JS function names, and share URL param (`mode=itinerary`). Old `mode=execution` share links are handled gracefully (backward compat in `setViewMode` and `maybeLoadSharedItineraryFromUrl`). Old `localStorage` value `'execution'` is also mapped to `'itinerary'` on read.
**Reasoning:** "Execution" was jargon with no travel context. "Itinerary" is what travelers call this view.
**Alternatives rejected:** "My Trip", "Day-of" — rejected in favor of the clearest option.
**Tradeoffs:** Old share links with `?mode=execution` show itinerary mode correctly but the URL is not updated. Negligible — share links are short-lived.

## [2026-04-07] Add date range to city main row with auto-population

**Decision:** Start/end dates are now set at the city row level and auto-populate accommodation check-in/check-out, arrival date, and departure date.
**Reasoning:** User wanted a single source of truth for dates rather than filling in the same dates across three sections.
**Alternatives rejected:** Keeping dates only in the expandable drawer — rejected because it required too many clicks and redundant input.
**Tradeoffs:** Accommodation dates are now tied to arrival/departure by default. Users can still override them in the drawer, but the initial values are driven by the city-level date range.

## [2026-04-19] Google Places replaces Brave for pins and restaurant price signal

**Decision:** Activity map pins resolve via a new `/api/places/resolve` endpoint that calls Google Places "Find Place From Text" using a required LLM-emitted `venue_name` field. Restaurant cost is shown as Google's `$`–`$$$$` `price_level` badge only — no fabricated per-person dollar number is rendered on the card. Tour and attraction cards show a "Price on GetYourGuide →" affiliate-search link instead of a number. A small representative-per-category number (meals keyed off `price_level`, tours $75, attractions $25, shows $80) is used ONLY to seed the hidden budget rollup so totals still function; user-entered `budgetUsd` on each checklist item continues to override everything downstream.
**Reasoning:** Brave snippet scraping produced wildly wrong values (e.g. $1,987 for Casa Lucio) because `Math.max(claude, brave)` let any outlier win and `parseFirstPrice` matched any currency-shaped number in a snippet. Google Places provides an authoritative landmark coordinate and a coarse but reliable price signal. Showing the badge as-is avoids inventing precision we don't have. Linking out to GetYourGuide defers the price question to the booking funnel where it's accurate.
**Alternatives rejected:**
- Keep Brave scraping with sanity thresholds — user explicitly rejected hard-coded threshold fixes; the underlying signal is too noisy to salvage.
- Apply for the GetYourGuide Partner API to fetch real tour prices — gated behind 100k monthly visitors, which we do not currently meet. Revisit when traffic crosses that threshold.
- Trust the LLM's `estimated_cost_usd` as the display number — unreliable in isolation; still emitted and retained in the schema for backward compatibility with stored itineraries, but no longer consumed by rendering paths.
**Tradeoffs:** (a) Existing stored itineraries have no `venue_name` or `price_level` and will fall back to Nominatim until replanned. (b) Google Places API usage increases — one lookup per activity on first render, cached in localStorage and in server-side LRU. (c) Users who want an exact per-person number for meals will need to enter it manually in the checklist.

## [2026-04-23] Rename "confidence" to `bookingChecklist` (stored) + `tripHealth` (derived)

**Decision:** The legacy single name `confidence` is split into two distinct concepts: `bookingChecklist` for the user-managed stored state (checklist items, notification prefs, issue triage notes) and `tripHealth` for the derived report (status, issues, progress) computed by `computeTripHealth()`. Affects server routes (`/api/itinerary/:id/trip-health`), persisted itinerary field (`itinerary.bookingChecklist`), client state keys, DOM ids, CSS classes, and tests.
**Reasoning:** "Confidence" was overloaded — it described both the user's booking-readiness checklist AND the system's derived health report. Two unrelated objects with different shapes shared one name, which made the codebase confusing (e.g. `state.confidence` was the report; `state.confidenceChecklist` was the user's data). The new names accurately describe each concept and match the existing UI step "Trip Health".
**Alternatives rejected:** Keep one name and disambiguate by prefix only — rejected because the two objects have different lifecycles (stored vs. derived) and conflating them invited the original confusion. Migration shim — rejected per debug-mode policy (no production data to preserve).
**Tradeoffs:** Any in-the-wild itinerary records with the old `itinerary.confidence` field will silently lose their checklist on next save. Acceptable per debug-mode policy. CSS file rename means any cached browser stylesheet may 404 once until next deploy.

## [2026-04-26] Hybrid scheduling: LLM orders, code assigns times

**Decision:** `/api/arrange` uses a two-stage pipeline. Claude returns `{day_plans:[{date, ordered_ids}], unplaced}` with NO times. `src/arrangeTimeAssigner.js` walks each day's ordered list and assigns concrete times deterministically using opening hours, meal bands, locked occupied intervals, day windows, and a commute matrix. `src/arrangeValidator.js` then checks overlaps, caps, and window bounds. On failure, a single repair prompt asks Claude to reorder; second result is returned regardless with diagnostics.

**Reasoning:** Previous "trust the LLM for scheduling" approach produced category-clustering bugs (multiple lunches, three museums in a row), overlaps when locks were dense, and window-overflow when the model misjudged duration. Splitting concerns lets the LLM focus on what it's good at (semantic ordering, geography clustering, day flow) and gives deterministic guarantees on what it's bad at (arithmetic, time bounds).

**Alternatives rejected:**
- Pure rule-based scheduler: loses LLM's clustering/flow intelligence.
- Multi-attempt LLM loop with no deterministic floor: expensive, still non-deterministic, doesn't actually fix the cap violations.
- Add post-LLM mutation (shift activities to fix overlaps): hides the underlying bug and produces unpredictable results.

**Tradeoffs:**
- Two LLM round-trips on validation failure (cost + latency).
- Meal type is inferred from `inferCategory` regex, not an explicit field — fragile if naming conventions drift.
- Commute matrix call adds N×N Distance Matrix queries per arrange; capped at concurrency 6 to limit Google API burst.
- Old `src/services/arrangePrompt.js` no longer used — kept as artifact until cutover smoke test passes.
