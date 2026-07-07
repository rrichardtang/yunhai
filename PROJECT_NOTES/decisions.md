# Decisions

Append-only. Records permanent architectural and design decisions.

---

## [2026-05-30] Concierge search is model-driven tool-calling, not a regex gate

**Decision:** The chat concierge no longer decides whether/what to search via regex. It is given a single `web_search` OpenAI function tool (`src/services/chatTools.js`) and writes its own query; `runChatTurn` in `src/routes/chat.js` runs a bounded tool loop (max 2 searches) feeding results back. Deleted: the `chat_concierge` branch of `shouldUseBrave`, `scopeQueryToTrip`/`HOTEL_PHRASE`, and `braveSearch.searchForChat`. The model reads the now-enriched trip context (accommodation address + coords, per-activity cost/booking/why_it_fits/etc.) to ground location/value/booking/rationale questions directly. `response_format: json_object` was dropped — it conflicts with mid-loop tool calls; the `{reply,signals}` contract now rests on the system-prompt instruction plus `parseChatResponse`'s existing prose fallback.

**Reasoning:** Two brittle regexes (search-gate + query-builder) caused repeated whack-a-mole patches (shopping, geo-scope, hotel field, hotel anchor). Giving the model agency + sufficient context fixes the class of bug, not each instance. "Dinner near my hotel" now works because the model reads the address and writes the query itself.

**Alternatives rejected:**
- *Broaden the regex / add an LLM classifier pre-fetch.* Still no agency; edge cases recur.
- *`record_signal` tool or a second forced-JSON turn for signals.* Extra round-trips; the prompt-instruction + parser fallback is cheaper and already robust.

**Tradeoffs:** Up to one extra OpenAI round-trip when a search occurs (bounded by the 2-search cap, ~700 tokens, and the 10-min Brave cache). Slightly less guaranteed JSON, mitigated by the parser fallback. Tool/tool_calls messages are kept OUT of persisted `session.history` (only the final reply text is stored) so `compactHistory`/`summarizeHistory` stay untouched.

## [2026-05-29] "Learned by AI" categories are derived client-side from text, not stored

**Decision:** Group the learned-prefs UI by topic using a client-side regex matcher (`categorizeLearned` / `LEARNED_CATEGORIES` in `public/app.js`) over each item's `text`, with a final "Other" bucket. No category field is added to the memory record, and inline edits ride the existing `PUT /api/preferences` diff-sync rather than a new id-based update path.

**Reasoning:** The store already carries `keywords`, but they're only populated by the Haiku reconciler — manually-added/edited records have empty `keywords`, so keyword-based grouping would be inconsistent. Deriving from `text` is uniform across all records and needs zero backend/API change, keeping `recall()` and the hot path untouched. Categorization is a navigation nicety, not correctness: a mis-bucketed item just lands in Other or an adjacent topic.

**Alternatives rejected:**
- *Add a `category` field to the record + LLM classification.* Adds write-path cost and a schema change for a cosmetic grouping; reconciler already has enough to do.
- *Group by stored `keywords`.* Inconsistent for manual/edited records (empty keywords).
- *id-based edit endpoint to preserve metadata across edits.* Out of scope; the text-keyed diff-sync already treats a rename as remove-old + add-new.

**Tradeoffs:** Editing an item's wording drops that record's learned metadata (`keywords`/`salience`/`source` reset to a fresh `manual` record) because `syncUserScoped` keys on text. Acceptable — matches how manually-typed items already behave. The regex category list is hand-maintained and English-only; it degrades gracefully to "Other."

## [2026-05-29] `@clerk/express` v2: `req.auth` is a function; admin uses verified identity

**Decision:** Always access Clerk auth via `req.auth()` (call it), never `req.auth.userId`. Admin routes (`/api/admin/*`) are verified by Clerk like every other route — `requireConfiguredAuth` + `requireOwner` checking `req.auth().userId` against `OWNER_USER_ID` — instead of trusting a client-supplied `?userId=` query param. Behind a reverse proxy, set `trust proxy` and pass `authorizedParties` (from `CLERK_AUTHORIZED_PARTIES`) to `clerkMiddleware`.

**Reasoning:** In `@clerk/express` v2 the middleware assigns `req.auth = (opts) => requestState.toAuth(opts)` — a function. Reading `.userId` off it returns `undefined`, so server-side auth silently never resolved a real user (everyone became `userId=default`). The prior admin design bypassed Clerk entirely and string-compared a query-param userId, which was both spoofable and a parallel second auth system. Collapsing onto `req.auth()` gives one identity path and closes the spoof.

**Alternatives rejected:**
- *Keep the query-param admin bypass.* Anyone could pass any `userId`; also meant two different ways to know "who is this."
- *Blanket `treatPendingAsSignedOut: false`.* Considered when "pending session" was a suspected cause; rejected once the token was confirmed `active` and the real bug was the accessor. Would weaken auth semantics app-wide for no benefit.

**Tradeoffs:** `authorizedParties` must be configured per environment (staging vs prod URLs) or token verification origin checks can reject. Documented in `.env.example`.

## [2026-05-27] Invite management is a browser admin UI, not a CLI

**Decision:** Mint, list, and revoke beta access codes via `/admin.html` (Clerk-gated by `OWNER_USER_ID` env var) instead of the existing `scripts/mint-invite-codes.js`. Endpoints live in `src/routes/admin.js` and mount before `requireEntitlement` so the owner can administer without being entitled themselves.

**Reasoning:** Node isn't on PATH on the VPS, so the CLI script can't run there. Minting locally and shipping `data/invite-codes.json` would couple invite issuance to a deploy. A browser-driven admin page is operable from any device, scales to ad-hoc beta growth, and reuses the existing Clerk session.

**Alternatives rejected:**
- *Clerk Backend API invitations.* Dev tier caps invitations and requires SMTP/domain setup. This was the original failed attempt.
- *Mint locally, sync the JSON file.* Couples invites to deploys; also fragile across multiple devices.
- *Add node to the VPS PATH.* Possible but a yak-shave; doesn't solve "I want to mint from my phone."

**Tradeoffs:** Trusts a single owner userId. If the owner account is compromised, an attacker can mint unlimited codes — but they could also already access the gate as the owner, so the marginal risk is small. The script (`scripts/mint-invite-codes.js`) remains for local emergency use.

## [2026-05-28] Canonical per-trip memory key is the itinerary id, not the chat session UUID

**Decision:** Per-trip memory `tripId` is standardized on `state.currentItineraryId` (the `it_...` itinerary id) across every touchpoint — chat, arrange, refine, replace, and plan. The chat route now reads `tripId` from the request body for memory `recall`/`observe`; the random UUID `sessionId` (from `ensureChatSessionId()`) reverts to keying chat *history* only. `null` (trip not yet saved) falls back to user-scoped memory.

**Reasoning:** When the memory layer first shipped, chat passed its UUID `sessionId` as the memory `tripId` because that was the only trip-ish identifier the chat route had. But the itinerary id is the one identifier shared by all flows. Had arrange/refine/replace started sending `it_...` while chat kept sending the UUID, the same trip would have had two disjoint trip-memory namespaces — chat-written trip memory invisible to arrange and vice versa. One canonical key keeps per-trip memory coherent.

**Alternatives rejected:**
- *Keep chat on the UUID `sessionId` and have other endpoints send the UUID too.* The UUID is chat-specific and doesn't exist for non-chat flows; the itinerary id is the natural shared key.
- *Map both keys to each other server-side.* Needless indirection; the frontend already has the itinerary id at every call site.

**Tradeoffs:** Before a trip is first saved (`currentItineraryId` is `null`), trip-specific statements are stored as user-scoped (durable) memory. Acceptable — an unsaved trip has no stable id to scope to, and durable is the safe fallback. Chat history remains keyed by the UUID `sessionId`, so the two concepts (history vs memory scope) are now cleanly separated.

## [2026-05-28] Agent-memory layer lives behind a `recall()`/`observe()` module, not a shared LLM wrapper

**Decision:** Introduce a dedicated `src/memory/` module (A-MEM / Mem0-inspired) as the modular seam all four LLM touchpoints share. `recall()` is synchronous, makes no LLM call, and returns a prompt-ready `.text` (relevance-ranked, merging user-scoped + per-trip records); `observe()` is detached/fire-and-forget and runs one Haiku ADD/UPDATE/DELETE reconciliation call (gated by the global semaphore). Storage is a swappable `MemoryStore` (`store.js`) — flat-JSON at `/data/memory/{userId}.json` now, the single file to re-implement for a DB. `preferences.js` becomes a thin facade over the store (same exported API + diff-based sync + one-time legacy migration). Memory is scoped at both user (durable) and trip (working) levels. Read sites: activity generation, arrange, chat, activity/refine (newly wired), activity/replace. Write sites: chat signals, activity-decline, arrange feedback.

**Reasoning:** Exploration confirmed there is no shared LLM wrapper — all 9 call sites instantiate the SDK directly with heterogeneous formats (text / JSON-mode / tool-use). Building a central `callLlm()` to inject memory would be a high-risk refactor across all of them and isn't required for memory. The existing preference seam (`getPreferenceSummary` / `recordPreference`) is already narrow and wired into four of the five sites, so evolving *that* boundary is the robust, low-blast-radius path. Keeping `recall()` synchronous and LLM-free protects the hot path (it runs on every plan/arrange/chat/refine/replace); putting the only LLM call in a detached `observe()` keeps user latency unchanged. The Mem0 ADD/UPDATE/DELETE reconciliation replaces the old append+exact-dedup, which could never resolve contradictions ("loves seafood" + later "went vegetarian" both persisted).

**Alternatives rejected:**
- *Central `callLlm()` wrapper refactoring all 9 sites.* High risk, touches heterogeneous SDKs/formats, and delivers no memory-specific benefit over the module seam.
- *Pull in the `mem0ai` SDK + a vector store (Qdrant/Chroma/hosted).* Hard departure from the flat-file ethos; adds infra/hosted dependency for a user base where per-user memory is tiny.
- *Embedding-based semantic retrieval now.* Deferred behind the pluggable `score()` signature — it would add an embedding API call to every `recall()` (hot path) for negligible gain at current scale (≤ low-hundreds of records/user).
- *Approve/decline as a learning signal.* Rejected again per the 2026-04-16 decision (too noisy).
- *Overloading the existing `/data/users/{userId}.json`.* Kept `profileInstruction` there but put memory records in a separate `/data/memory/{userId}.json` so the editable profile and migration stay cleanly separated.

**Tradeoffs:**
- Two persistence files per user (`users/` for `profileInstruction`, `memory/` for records); the facade keeps them coherent and migrates legacy arrays once.
- `observe()` adds one Haiku reconciliation call per ingestion turn (only when there's something to ingest); detached, so no user-facing latency, but it is new cost. Arrange feedback is gated on a free-text note to avoid a call per draft click.
- Within a single chat session, a newly stated preference won't bust the cached system prompt until trip context changes — acceptable because the statement is still in the live message history.
- Flat-JSON `MemoryStore` is local to one process/host; horizontal scaling (>1 Node instance) is the migration trigger to Postgres + pgvector. Other triggers: same-user multi-device write contention, embeddings at scale, cross-user/analytics queries.

## [2026-05-22] Landing demo reel drives the real `planner.html` via `?embed=1` iframe — no static screenshots, no separate demo screens

**Decision:** The marketing landing's "See it in motion" demo embeds the real `planner.html` in an iframe (`?embed=1` mode) and reaches into the same-origin DOM at scripted timestamps to move a synthetic cursor, fire real clicks, type into real inputs, and jump between the app's 4 setup steps via `iframe.contentWindow.setStep(n)`. `?embed=1` bypasses Clerk, hides topbar/chat/banner chrome, unlocks `state.maxStep=4`, and seeds a baseline Córdoba city so the Setup beat has something to add to.

**Reasoning:** The design handoff assumed 6 standalone HTML screens (`Setup.html`, `ProfileWizard.html`, etc.) which the real codebase doesn't have — the app is a single-page workflow inside `planner.html`. Driving the real app preserves the handoff's "the product, actually running" pitch with zero drift risk: when the planner UI changes, the demo updates automatically. Selectors target the *existing* stable data attributes (`#addCityBtn`, `[data-field]`, `[data-logistics]`, `[data-tab]`, `[data-accommodation-field]`) so no instrumentation lives in the production CSS/HTML purely for the demo.

**Alternatives rejected:**
- *Build 6 standalone HTML snapshots.* Higher drift risk and double maintenance — the demo would visually diverge from the real app the moment we ship any planner UI change.
- *Pre-recorded video / screenshot loop.* Loses the "real product" credibility and contradicts the section's headline.
- *Add `data-demo-anchor` attributes throughout planner.html.* Adds attributes to production code purely for marketing. Existing data attributes are already stable enough.

**Tradeoffs:**
- Same-origin requirement: the marketing landing must live on the same origin as the planner so the engine can read `iframe.contentDocument`. We already serve both from one Express app, so this is fine indefinitely.
- Embed mode is a fork in `init()` — every future addition to the planner's init flow must consider whether the embedded demo should run it. Mitigated by keeping `initEmbedMode()` as a small, focused function that intentionally skips Clerk, server sync, and profile-wizard auto-open.
- The iframe re-renders the cities container on every tab switch (real app behavior). Selectors use `.city-row:last-child` to survive re-renders; visible cursor jitter is accepted as honest UI feedback rather than papered over.

## [2026-05-19] Per-trip scheduling prefs feed Arrange via dual channel: hard window clamp + soft prompt block

**Decision:** A new Scheduling Preferences wizard captures structured scheduling inputs per-trip. The prefs reach the Arrange LLM via two mechanisms simultaneously: (1) **hard window clamps** narrow `day.windowStart/End` in the `/api/arrange` payload (the LLM cannot place outside them), and (2) a **soft `SCHEDULING PREFERENCES` prompt block** lists tour timing, lunch/dinner targets, pacing, and free-text notes as strong soft constraints. The free-text `dayStructure` question on the profile wizard is removed (superseded).

**Reasoning:** The previous design relied on a Haiku-generated profile summary mentioning vague day-structure prose. The Sonnet arrange model routinely ignored it. Hard payload-level clamps make the window physically un-violable; the soft prompt block handles nuances (tour timing, pacing) that aren't expressible as a single window. Splitting "personality" (pace, food prefs — profile-level) from "this trip's day shape" (start/end times — trip-level) maps to how travelers actually think.

**Alternatives rejected:**
- **Soft prompt only:** weak — exactly the failure mode being fixed.
- **Hard window clamp only:** loses ability to express tour-timing and pacing preferences.
- **Per-profile (not per-trip) scope:** a beach trip and a museum trip have different ideal day shapes; per-profile would force re-entry or compromise.
- **Modify global `getCityDayWindowStart/End`:** would also clamp the timeline UI and break manual drag-and-drop outside preferred hours. Inline-clamp at the arrange POST site only.
- **Persist as part of itinerary save only:** Draft happens repeatedly before Finalize, when there may be no itinerary id yet — added localStorage layer with itinerary as authoritative on load.

**Tradeoffs:** Two persistence stores (localStorage + itinerary) need to stay in sync — on load, itinerary wins. Locked manual placements may sit outside the clamped window; the existing locked-activity handling already treats them as fixed anchors that the LLM works around, so no conflict.

---

## [2026-05-18] Google Calendar OAuth stays separate from Clerk auth

**Decision:** Keep the dedicated `/api/calendar/google/auth-url` flow as the only path to grant Google Calendar access. Do not attempt to reuse the Google OAuth token Clerk obtains during Google sign-in.

**Reasoning:** Clerk's default Google OAuth scopes are `email profile openid` — it never receives `calendar.events` consent, so the underlying token is useless for Calendar API calls. Even with custom Clerk OAuth scope config, retrieving the raw provider token requires the `getUserOauthAccessToken` admin API and dashboard rework. The existing dedicated flow already handles consent, token storage (`/data/google-calendar-tokens.json`), refresh, and fingerprint-deduplicated sync.

**Alternatives rejected:**
- **Pre-grant Calendar scope via Clerk Google sign-in**: would force every signup through Google OAuth and add scope-management complexity; users signing up via email/password still need a separate consent step anyway.

**Tradeoffs:** Users see two consent screens over their lifetime (Clerk sign-in, then Google Calendar connect). Acceptable — the second one only fires when they click Sync.

---

## [2026-05-18] Replace Sortable.js with custom pointer-driven drag for Arrange step; enforce 30-min buffer

**Decision:** Remove Sortable.js for the Arrange step. Implement custom delegated `pointerdown`/`pointermove`/`pointerup` handlers on `#stagingArea` + `#dayColumns`. Snap to 15-min grid. Enforce a 30-minute buffer before and after every existing item — both in collision detection (`arrangeIsValidDrop`) and visually via `.blocked-buffer` strips around `.blocked-core` in the drag overlay.

**Reasoning:** The design handoff (`design_handoff_arrange_drag/`) calls for first-class validation feedback (red drop indicator, blocked-range overlays, floating ghost with live time chip) that Sortable's `onMove`-return-false flow doesn't render cleanly. Custom pointer flow is ~250 LOC and gives precise control over snap, buffer, and rAF-throttled overlay rendering. User explicitly requested the 30-min buffer to prevent containers from sitting adjacent.

**Alternatives rejected:**
- **Keep Sortable, layer overlays on top**: handoff warns Sortable's snap + no-overlap guarantees are weaker than this; layering overlays inside its placeholder lifecycle is fiddly.
- **Skip buffer, rely on adjacency rules in auto-arrange only**: drag wouldn't enforce it, defeating the visual feedback goal.

**Tradeoffs:**
- Lose Sortable's edge-auto-scroll while dragging in a horizontal scroller — acceptable for v1; flagged in risks.
- Buffer makes valid slots scarcer on packed days; user accepts this as the explicit goal.

---

## [2026-05-12] Distance Matrix: Haversine pre-filter + cluster-centroid pairs over Mapbox migration or Finalize-deferral

**Decision:** Keep Google Distance Matrix and feed Sonnet real commute data at arrange time, but cut call volume via (1) Haversine pre-filter at 1.5 km (sub-threshold pairs skipped — prompt already ignores <15-min walking pairs), (2) greedy 2 km clustering with single inter-cluster representative pair fanned out to all member-pairs, (3) cache TTL 30d → 365d, (4) per-leg UI pills stay live during drafting now that arrange cost is bounded.

**Reasoning:** Sonnet's schedule quality degrades noticeably without grounded commute data — it falls back to vibes about venue geography. Earlier proposal to defer all Distance Matrix until Finalize was rejected for this reason. The cost problem is fixable by computing fewer pairs, not by removing data from the prompt.

**Alternatives rejected:**
- **Mapbox Matrix API**: no public transit data, which is the dominant mode in Tokyo/most cities the user plans for.
- **Defer Distance Matrix until Finalize**: degrades arrange quality.
- **K-means clustering**: greedy first-fit is simpler and the optimality gap is irrelevant at this scale.
- **Per-leg pills only after Finalize**: with the matrix cost cut ~10×, per-leg pills become affordable (~$0.50 per session) and are a real UX win during iteration.

**Tradeoffs:** Inter-cluster pairs receive a centroid-derived estimate, not exact venue-to-venue time — e.g. all Asakusa↔Shibuya pairs share one number. Sonnet doesn't know which numbers are exact vs approximate, which is the right design. Greedy clustering is order-dependent; produces slightly suboptimal partitions in pathological cases but cost stays bounded.

---

## [2026-05-10] Matrix endpoint uses single-mode (transit-with-driving-fallback); per-leg UI endpoint keeps 3 modes

**Decision:** `/api/commute-matrix` now calls Distance Matrix once per pair (mode=transit), falling back to driving only when transit returns no result. Single-direction queries with both-direction storage in the matrix. Hard cap of 2000 pairs per request (circuit breaker). The `/api/commute` per-leg endpoint that powers the UI mode-pill dropdowns keeps the existing 3-mode `getCommuteBetweenActivities` because the UI needs all three.

**Reasoning:** The matrix endpoint exists to feed Sonnet a single number per pair ("fastest mode minutes") for scheduling purposes. The previous 3-mode implementation paid 3× cost for a value the caller discarded the mode breakdown of. For dense cities (Tokyo, NYC, Madrid, Paris) transit is almost always fastest, so a single transit query is correct in the average case; driving fallback covers Google's transit-data gaps and late-night service. Symmetric query dedup (A→B and B→A) takes another 2× off because for trip-planning purposes the asymmetry from one-way streets is irrelevant — Sonnet just needs to know "leave 35 min between these venues."

**Alternatives rejected:** (a) Always-transit (no driving fallback) — pairs in transit-data gaps would silently render as no-commute, and Sonnet would treat them as walking distance. (b) Cache layer keyed by activity ID — `commuteCache` already memoizes by geocode-string (origin|destination|mode); after yesterday's v2 location.lat/lng resolver fix, the same activity produces the same coord-string query, so the existing layer already does the right thing. Add an ID layer only if observed cache hit rate is low. (c) Caller-side decision (let `/api/commute-matrix` request a `single_mode` flag) — increases API surface for no real benefit; the matrix endpoint will always want a single number.

**Tradeoffs:** For pairs where driving is actually fastest (suburban trips, late nights), the matrix gets transit time which is typically 10–20% slower. Acceptable — Sonnet uses these for "leave at least N minutes between venues," and a 15% over-buffer is benign vs. a 200% under-buffer. If observed schedule quality drops, revisit.

## [2026-05-09] Commute matrix goes into the arrange prompt; no hardcoded buffer in the validator

**Decision:** The `/api/arrange` route now passes the precomputed Distance Matrix (already shipped from the frontend in the request body) into `buildDirectArrangePrompt`, which renders the top 30 non-trivial pairs (≥15 min, fastest mode) into a `COMMUTE TIMES` block. The validator's `MIN_BUFFER_BETWEEN: 20` constant is deleted; overlap detection is true time overlap with no padding. The cleanup loop drops only the later-starting activity in an overlapping pair, not both.

**Reasoning:** Sonnet was being asked to "leave reasonable transit time" via implicit prompt framing while the actual computed Google Maps numbers were thrown away — and the validator then punished dense placements with a 20-min buffer Sonnet didn't know existed. Two layers fighting the same problem with worse information than we already had on hand. With real numbers in the prompt, Sonnet schedules with knowledge; the validator only catches genuine physics violations (true overlap, lock conflict, day window, opening hours start). This is consistent with the 2026-04-27 reversion of the hybrid scheduler — the LLM owns scheduling, the system gives it good data and only flags the actually impossible.

**Alternatives rejected:** (a) Add a "leave reasonable transit time" line to the prompt — vague, would not produce different behavior, contradicts the product ethos of avoiding hardcoded heuristics. (b) Bring back the hybrid scheduler with `arrangeTimeAssigner.js` — already rejected on 2026-04-27 for severing semantic intent (`sunset drinks`, local meal customs). (c) City-aware default buffers — real Distance Matrix data > any hand-rolled table. (d) Keep `MIN_BUFFER_BETWEEN` lower (e.g. 5 min) — still hardcoded heuristic, just smaller.

**Tradeoffs:** Slight increase in prompt size (top 30 commute pairs ~1-2 KB on a 9-day trip). The matrix isn't free to compute (Distance Matrix API costs), but it was already being computed and shipped — pure plumbing fix, no new costs. If `/api/commute-matrix` returns empty (Maps API down or unconfigured), the prompt simply omits the COMMUTE TIMES block; Sonnet falls back to address-only reasoning, same as before this change.

## [2026-05-09] Opening-hours check: "start within" instead of "fit entirely"

**Decision:** `arrangeValidator` now checks that an activity's start time is within an opening window (`startMin >= s && startMin < e`), not that the entire activity fits inside the window (`startMin >= s && endMin <= e`). A 1-hour lunch starting at 14:30 at a restaurant listed `11:00-15:00` now passes; one starting at 10:00 still fails.

**Reasoning:** LLM-emitted opening hours are lower bounds. Restaurants seat patrons up to close (kitchens stop new orders, but seated diners finish). Museums don't kick visitors out at the dot. The "fit entirely" check was producing false-positive `physics_unresolved` rejections on legitimate edge-of-window placements. Starting position is the real physical constraint — if you arrive at a closed venue, it's closed; if you arrive while it's open, you'll be served.

**Alternatives rejected:** (a) Pad the window by N minutes ("treat 15:00 close as 15:30") — another hardcoded heuristic that varies by venue type. (b) Require LLM to emit closing-time-buffered hours — unreliable, depends on Sonnet getting the buffer guessing right. (c) Keep "fit entirely" — produces user-visible bug (pin café placement at 17:30 with 16:00 listed close fails); the resulting unplaced rate isn't worth the marginal correctness gain.

**Tradeoffs:** A venue that closes at 21:00 will accept a placement at 20:55 even if the activity duration is 90 min (theoretical end 22:25). Acceptable — most venues close because they stop accepting new arrivals, not because they evict existing patrons. If this surfaces as a real-world bug (e.g. user reports being turned away because they arrived too close to close), revisit.

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

## [2026-06-09] Arrange: trade forced tool_choice for adaptive thinking
**Decision:** Switch the Arrange placement call from `tool_choice:{type:'tool'}` to `tool_choice:{type:'auto'}` so adaptive thinking can be enabled, keeping the `submit_schedule` tool for schema-shaped output.
**Reasoning:** Anthropic docs confirm forced tool use is incompatible with extended/adaptive thinking (returns an error). The Arrange failure mode is a reasoning failure on a dense multi-constraint problem (16-violation first passes), so unlocking thinking is the core fix. `auto` keeps the tool in context (so output is still schema-shaped and downstream parsing/validation is unchanged) while permitting thinking.
**Alternatives rejected:** (a) Drop the tool and parse strict-JSON from text — more failure surface. (b) `output_config.format` structured outputs — newer/untyped on SDK 0.39.0, higher risk than flipping tool_choice. (c) Fine-tuning — not offered by Anthropic, and wouldn't fix multi-constraint reasoning anyway.
**Tradeoffs:** Under `auto` the model could occasionally answer in prose instead of calling the tool; mitigated by an explicit "you MUST call submit_schedule" instruction and the existing `tool_use=false` throw + telemetry. Thinking adds latency/token cost, offset by prompt-caching the static system prefix; `effort` is the dial (`high`→`medium`) if cost matters. A forced-tool fallback was deliberately NOT added pre-emptively — only if VPS logs show prose responses actually occur.

## [2026-06-09] Keep deterministic adjuster authoritative; fix Arrange quality at the LLM, not with a reorderer
**Decision:** Address the activity-drop cascade by improving first-pass LLM quality (thinking + few-shot demonstrating commute-aware same-day clustering), not by adding a deterministic reordering pass to `arrangeTimeAdjuster`.
**Reasoning:** The adjuster can only push-or-drop in LLM order; a geographically incoherent order guarantees end-of-day drops. The LLM already receives the commute matrix + walking-neighbor blocks, so the intended mechanism is for it to order coherently — the fix is making it use that data (user confirmed this expectation), keeping the hybrid "LLM places, deterministic enforces" split intact.
**Alternatives rejected:** Deterministic nearest-neighbor reorder before time assignment — larger change to the authoritative layer; deferred unless drops persist after the LLM-side levers. Deterministic meal-slot enforcement in the adjuster — also deferred; user chose LLM-side meal handling.
**Tradeoffs:** Meal/ordering correctness stays probabilistic (model-driven) rather than guaranteed. Acceptable given the safety net (validator + adjuster + force-drop) and measurability via `forceDropPct`; revisit if VPS stats don't improve.

## [2026-06-09] SUPERSEDES both 2026-06-09 thinking decisions above — reverted adaptive thinking; deterministic meal protection instead
**Decision:** Remove adaptive thinking from the Arrange call entirely; keep the fast single forced-tool call (`tool_choice:{type:'tool'}`, no thinking, `max_tokens:16384`). Fix dropped meals with **deterministic anchoring in `arrangeTimeAdjuster`** (anchor each meal into a lunch/dinner slot by opening_hours before placing non-meals), not at the LLM.
**Reasoning:** Adaptive thinking was tried in three structures (one-call 16K, one-call 32K streamed, two-call reason-then-force) and every one ran for minutes and usually hit `max_tokens` without emitting the schedule (4.5min → 8.7min → a 6.5min reasoning call returning zero text). Root cause confirmed in live Anthropic docs: adaptive thinking auto-enables interleaved thinking, which on a tool task can consume the whole token budget, and Sonnet 4.6 removed `budget_tokens` so there is no hard cap. Not viable for an interactive button. With thinking gone, the premise of "LLM-side only meals" (that thinking would carry placement quality) no longer held, so meal correctness moved to the deterministic layer where it can be guaranteed.
**Alternatives rejected:** Keep tuning `max_tokens`/`effort` — empirically never converged. Two-call design — reasoning call still hung. Async/background arrange to allow thinking — out of scope for an interactive request (noted as the only viable future route if reasoning is ever wanted). Deterministic reorder pass — not needed once meals are anchored.
**Tradeoffs:** No model "reasoning" step on the interactive path; first-pass placement quality is whatever the fast forced-tool call produces, backstopped by the few-shot, the 2-iteration surgical repair, and (authoritatively) the validator + adjuster + meal anchoring. Genuine meal over-subscription (e.g. a dinner-only venue on a day that closes at 18:00 with other days' dinners taken) still drops — correctly.

## [2026-06-09] Decline breakfast slot + generator meal-slot tagging
**Decision:** Do not add a breakfast scheduling slot, and do not have `planCity()` tag meals with a breakfast/lunch/dinner daypart. Meal generation stays as-is (neutral named restaurant + opening_hours); arrange infers lunch/dinner from opening_hours.
**Reasoning:** After deterministic anchoring fixed the lunch/dinner cascade drops, a generator slot-tag would mostly duplicate the hours-based inference the adjuster already does. The only genuine gap is breakfast (breakfast-only venues, e.g. 7:00–11:00, currently find no slot and drop), but the user confirmed their trips assume breakfast-at-hotel, so breakfast scheduling has no demand.
**Alternatives rejected:** Add `BREAKFAST_WINDOW` + third anchor slot (no demand). Add a generator `meal_slot` enum + plumb through schema/arrange/validator (largest surface, marginal value over hours-based inference).
**Tradeoffs:** Breakfast-only venues, if ever generated, are silently dropped. Acceptable given confirmed intent; revisit only if breakfast venues start appearing and mattering.

## [2026-06-10] Arrange redesign — LLM assigns days, deterministic code schedules
**Decision:** Stop asking the LLM for concrete times. The `assign_days` tool returns only a per-day activity assignment (which day each activity goes on, no times/order). New `src/services/arrangeScheduler.js` deterministically does cross-day meal redistribution, per-day commute-minimizing ordering (brute-force ≤7 non-meals, NN above), meal anchoring by opening hours, and all time assignment. Response shape unchanged (`{placements,unplaced,diagnostics}`); frontend untouched.
**Reasoning:** Asking the LLM to emit times forced it to do arithmetic across ~54 interdependent numbers, producing 16–19 physical violations per first pass and dropping ~⅓ of the trip; all the repair/force-drop machinery existed only to damage-control that. Adaptive thinking (the only lever that might fix the arithmetic) was already reverted for unbounded latency. Moving time/order/slot computation into deterministic code makes violations structurally impossible and lets the core be unit-tested without an API key (28 tests pass).
**Alternatives rejected:** More meal-specific patches on the old adjuster (whack-a-mole — user explicitly asked to stop); async arrange with thinking (thinking produced bad/empty output even given minutes); a deterministic reorder pass bolted onto the old time-emitting flow (still inherits LLM time violations).
**Tradeoffs:** Day-assignment quality still depends on the LLM (it can over-load a day → code drops overflow with a clear reason). Locks aren't in the commute matrix, so they get collision-avoidance but no real commute padding (10-min fallback) — documented, not faked. This SUPERSEDES the prior 2026-06-09 "deterministic meal anchoring on the adjuster" approach (the adjuster is deleted).

## [2026-06-10] Delete obsolete arrange machinery + consolidate geo helpers
**Decision:** Per the no-bandaids directive, deleted `src/services/arrangeTimeAdjuster.js` (+ test), `buildRepairPrompt`/`REPAIR_DIRECTIVES`/`buildCommuteBlock`/the few-shot + time-math rules from `arrangePromptDirect.js`, the 2-iteration repair loop + force-drop block from the route, and zombie telemetry fields. Extracted duplicated `activityCoords`/`haversineKm` (3 copies) into `src/services/geo.js`.
**Reasoning:** Every deleted piece existed only to compensate for the LLM emitting bad times; obsolete under the new paradigm. Keeping them would be bandaids over a base that no longer behaves that way.
**Alternatives rejected:** Keeping the validator's repair-loop role (demoted to a final self-check assertion instead — it's the backbone of the new tests, so kept not deleted).
**Tradeoffs:** None material; net code reduction.

## [2026-07-01] Dedicated grounded `/api/activity/add` instead of reusing `/api/activity/replace`
**Decision:** User-typed activity additions get their own endpoint: Google Places resolve gate runs BEFORE any LLM call (unresolvable name → 404 + inline modal error, no LLM invention), the LLM only fills descriptive fields with the name pinned verbatim to the canonical Places name, and `groundActivityToPlace()` stamps place_id/coords/address/hours from the authoritative resolve. If the LLM is unavailable or fails, return a grounded minimal activity rather than an error.
**Reasoning:** The Add Activity modal was posting to `/api/activity/replace`, whose prompt's entire contract is "find a DIFFERENT venue — NOT ${name}" — asking for "Sisterita" guaranteed a substitute, and nothing verified existence, so hallucinated venues shipped with name-string map links that 404 ("location not found", Muir Woods→Sausalito renames). Grounding-before-LLM makes wrong-venue substitution structurally impossible on the add path, mirroring the arrange redesign's "LLM judges, code guarantees" split.
**Alternatives rejected:** A mode flag on `/api/activity/replace` — one endpoint would serve two opposite prompt contracts (find-something-different vs keep-exactly-this). Post-hoc enrichment alone — verifies the wrong venue after the substitution already happened.
**Tradeoffs:** One extra Places call per add (cached, cheap). With no GOOGLE_MAPS_API_KEY the gate degrades to the old ungrounded behavior. Replace path kept its contract but gained one retry turn when the suggested venue doesn't resolve, else an `unverified: true` flag.

## [2026-07-01] Toasts removed entirely; failures surface via a single persistent error banner
**Decision:** Deleted the toast system (host, `showToast`, CSS, checklist undo-toast). Success/info feedback is simply gone; failures and blocked actions route to `showErrorBanner()` — one fixed top-center `role="alert"` banner, persistent until dismissed, newest error replaces the text.
**Reasoning:** User explicitly asked to remove all toast notifications. But ~30 call sites were the ONLY surface for real failures (plan/generate/upload/PDF/share errors); deleting those silently would strand users, so errors were downgraded from transient toasts to a persistent-until-dismissed banner (user confirmed this option over fully-silent or keep-error-toasts).
**Alternatives rejected:** Inline per-feature error elements everywhere — would touch dozens of templates for scattered one-line failure messages; the add-activity modal got a true inline error because it's a form-validation loop. Auto-dismissing banner — that's a toast again, and missing a 4s error was part of the original problem.
**Tradeoffs:** No positive confirmation anywhere (saves, deletes, copies are silent) — the UI state change is the only feedback. The checklist item delete lost its undo affordance.

## [2026-07-02] Auto-arrange: server-authoritative schedule with explicit endTime; client stops re-deriving
**Decision:** `POST /api/arrange` placements now carry `{date, time, endTime}`. The client stores and renders exactly that (card height, time-range label, blocked bands all flow from one `getPlacementTimeRange`), and the post-response re-check that re-validated server output against client-derived overlap/window/duration rules — silently unplacing on disagreement — is deleted. `endTime` is server-owned: any manual edit that changes time or duration drops it and the client's duration model takes over (user-owned after a manual edit). Client-side validation is retained only for live interactivity (drag-drop validity, time-edit end>start, lock guards).
**Reasoning:** Bug archaeology showed the post-redesign arrange fixes clustered in the client↔server seam: the frontend re-implemented overlap, day-window, duration, and sequencing from *different* data sources (`actDurationHours` + `Math.max(30,…)` vs server `duration_minutes`; re-derived windows vs the `dayPayload` it had itself sent), so every model drift surfaced as a "mystery unplacement." Two schedulers over one schedule can only disagree; the fix is one source of truth, not a better second-guess.
**Alternatives rejected:** Keeping the re-check as a "safety net" (it was the bug, not the net — the server validator already enforces the same passed-in windows); returning durationMinutes instead of endTime (forces the client to re-derive ends — the thing being deleted).
**Tradeoffs:** A genuine server placement bug now renders as-is instead of being silently hidden in the unplaced strip — which is desired: it becomes visible and diagnosable (validator diagnostics + now-live telemetry) instead of masked.

## [2026-07-02] Scheduler: meal rescue pass over slot-swap/bumping; honest commute values
**Decision:** (1) The live `empty_dinner_with_available_meal` failure (anchoring infeasibility — a meal whose own day can't fit it dropped while another day's dinner sat empty) is fixed with a deterministic post-drop rescue pass: dropped meals retry on nearest-day-ordered candidates with a free compatible slot, using real placed intervals as obstacles. Validator check 8 also now counts locked meals into the dinner slot and only fires when the day window actually reaches the dinner window (two false-positive paths closed). (2) `getCommuteMin` returns `null` for missing pairs; real values are no longer floored (a 5-min walk budgets 15 min gap, not 20); the 10-min fallback applies only to genuine misses; obstacle-resume budgeting adds commute from meal anchors when the pair is in the matrix. (3) distance-matrix adds a walking/haversine last resort after transit+driving both fail — an honest large value beats a silent miss.
**Reasoning:** Rescue reuses `findSlotStart`/`nearestDay`/`mealSlotCapability` and touches nothing already placed — overlap remains impossible by construction. The floor made missing data indistinguishable from real short hops, one of the two commute patch-on-patch signals in the git history.
**Alternatives rejected:** Slot-swap (moving an already-anchored meal) and bumping non-meals — both destabilize per-day routings that were already optimized, for no guaranteed win. Another scheduling-ownership flip — done four times already; the LLM-assigns-days / code-schedules split stays.
**Tradeoffs:** A rescued meal can land on a day the LLM didn't choose (bounded by nearest-day ordering). Unfloored commutes pack days tighter; haversine last-resort values are honest-but-large and may increase `no_time_slot_remaining` on tight days — both observable in telemetry (`logRun` failures now surface via debugLog instead of a silent catch).

## [2026-07-03] Clean-sweep security posture: authed-by-default, fail-closed, owner-gated debug
**Decision:** During the codebase sweep, standardized the auth posture rather than patching endpoints ad hoc: every identity-bearing operation derives userId from the Clerk session (never the request body/query); pre-auth surface is limited to `/api/status` (booleans only) and the externally-called email webhook, which now fails closed without its shared secret; all debug/admin surfaces hang off the single `requireOwner` middleware (`OWNER_USER_ID`), and the parallel `ADMIN_TOKEN` scheme was deleted. The server Google Maps key moved behind auth (`/api/config/maps-key`).
**Reasoning:** The exploitable bugs found (invite-code leak + body-userId redeem = entitlement bypass; cross-user memory read/poison via body userId; chat-session IDOR) all shared one root cause — trusting client-supplied identity or leaving "temporary" debug routes unauthenticated. One consistent rule is auditable; six bespoke fixes are not.
**Alternatives rejected:** Keeping `ADMIN_TOKEN` for arrange-stats (second secret channel, and it accepted the token via query string where it lands in logs). Signed short-lived URLs for the maps key (overkill — Clerk auth already exists; the real mitigation is key rotation + referrer restriction, tracked in open_items).
**Tradeoffs:** Email ingest is disabled until `EMAIL_WEBHOOK_SECRET` is configured (was silently open). Client debug logging (`sendDebug`) is lost for signed-out users. Invite redemption now requires a signed-in session — the gate UI already ran post-sign-in, so no UX change.

## [2026-07-07] Budget meter switches to real per-activity cost (partially supersedes 2026-04-19)
**Decision:** The checklist-seeded budget rollup (`buildChecklistFromState` → `budgetUsd`) now derives from the activity's real estimated cost (`optActivityCost`/`actCostUsd`, travelers-multiplied) and falls back to the type-based `representativeCostUsd` only when no estimate exists. A new `budgetUsdAuto` field records the last auto-derived value so re-renders refresh `budgetUsd` only when the user never overrode it (legacy items without `budgetUsdAuto` are treated as auto-derived when their value matches the old representative derivation). `POST /api/activity/refine` normalizes LLM cost output into the activity's own shape (`applyCostShapeToUpdates`: nested `cost.estimated_usd` vs legacy `estimated_cost_usd`), mirroring the route's existing booking-shape normalization.
**Reasoning:** The budget optimizer (built after the 2026-04-19 decision) runs entirely on `actCostUsd`, so the overlay's savings math and the persistent meter disagreed, and the reported bug — total unchanged after accepting a cheaper alternative — was structural: the meter summed a flat per-type number cached with `??` against an unchanged activity id. One cost base ends the disagreement; the user chose "real cost everywhere" over a targeted write for optimized activities only (which would have mixed bases).
**Alternatives rejected:** Writing real cost into the checklist only for budget-opt-replaced activities (meter mixes two bases; per-card refine still stale). Frontend-side cost-shape merge in `onConfirmLocks` (the server route already normalizes booking shape; one seam, unit-testable without an LLM).
**Tradeoffs:** Existing trips' meter totals shift once (LLM estimates are less conservative than the flat numbers — accepted; user-entered `budgetUsd` still overrides everything). Legacy items whose stored value coincidentally equals the old representative derivation are refreshed rather than kept.

## [2026-07-07] One shared interactive loader (#planningOverlay) parameterized for all long waits
**Decision:** The planning overlay's engine (rotating messages, trickle progress bar, status/pill lines) was generalized in-place in `app.js` — `showLoader({title,status,progressLabel,messages,totalUnits})` / `setLoaderStatus` / `setLoaderUnitsDone` / `hideLoader` over the single existing `#planningOverlay` DOM node (z-index raised 1800→2050) — and reused for budget optimization (determinate, one unit per refine promise via `.finally`), auto-arrange draft/finalize (3 milestones: commutes → assign → schedule), and per-card replace (indeterminate). `setPlanningLoading` became a thin plan-flow wrapper. Add-activity keeps its optimistic stub card — no loader.
**Reasoning:** The engine was already mode-agnostic (`totalUnits=1` behaves as indeterminate trickle); only the plan-specific strings and button wiring needed lifting. One overlay node is safe because the flows are mutually exclusive, and reusing it keeps CSS/overlayManager registration untouched. Full-screen for replace was the user's explicit choice over an in-card shimmer.
**Alternatives rejected:** New `public/js/loaderOverlay.js` boundary module (violates the monolith rule for no gain). A loader on add-activity (regression — the stub card already gives instant feedback).
**Tradeoffs:** A single node means a hypothetical future concurrent flow would fight over it. Embed mode now mounts the overlay too (it previously never did), so demo-reel flows show the loader.
