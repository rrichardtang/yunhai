# Phase 6 — Activity Recommendation Improvements

**Branch:** `feature/recommendations-phase6`
**Depends on:** Phase 5 merged
**Goal:** Tighten the per-city activity generation in `planCity` ([src/claude.js](../src/claude.js)) so Review-step output is more diverse, more auditable, and more responsive to in-session user behavior.
**Non-goals:** Changing the activity schema in ways that break stored itineraries; rewriting the Brave research pipeline; touching arrange logic.

---

## Current state (one-paragraph recap)

`/api/plan` ([src/routes/activities.js:366](../src/routes/activities.js#L366)) streams one SSE event per city. Each city is planned by a single Claude Sonnet 4.6 call ([src/claude.js:314](../src/claude.js#L314)) given: city basics, accommodations, travel timing, pace, budget, locked activities (positive signal only), Brave web research (citywide activities + restaurants), and a learned cross-trip preference summary. Cities are planned 3 in parallel under a global 10-slot LLM semaphore. Output is a JSON array of ~17-field activity objects, normalized and decorated with booking links before reaching the client.

---

## 1. Expose Decision Framework scores in the output

**Why:** The system prompt instructs Claude to evaluate every activity across Fun Factor, Disappointment Risk, Cost vs. Payoff, Planning Flexibility, Engagement Type — but never asks it to *report* the scores. The verdict ("Recommend" / "Recommend with caveats" / "Skip") is the only externalized signal. We can't audit, filter, or surface these dimensions in the UI.

**Changes:**
- `src/claude.js` SYSTEM_PROMPT: add three required output fields:
  - `fun_factor`: `"low" | "medium" | "high"`
  - `disappointment_risk`: `"low" | "medium" | "high"`
  - `engagement_type`: `"interactive" | "sensory" | "visceral" | "observational"`
- `normalizeActivity`: default missing scores to `"medium"` / `"observational"` so legacy data doesn't break.
- Review-step UI ([public/app.js](../public/app.js) — Review card render): show a small badge row when `disappointment_risk === "high"` (warning color) or `fun_factor === "high"` (positive color). Keep it subtle — one icon row, no extra text.

**Risk:** Adds ~30 tokens per activity. For a 25-activity city, ~750 extra output tokens. Acceptable.

---

## 2. Negative signal — pass declined activities to subsequent cities

**Why:** Within a single planning session the only cross-city signal is `lockedActivities` (positive). If the user declines 4 museums in Florence, Rome's prompt has no idea. The learned-profile summary updates async and only persists across trips, not within one.

**Changes:**
- Frontend (`public/app.js`): when invoking `/api/plan`, include a new payload field `declinedSoFar: { [cityName]: [{ name, type, category }] }` derived from `state.reviewed` where `approved === false`.
- Initial plan call has empty declined list. Re-plans (regeneration) include accumulated declines.
- `src/routes/activities.js` `/api/plan`: accept `declinedSoFar`, pass per-city slice into `planCity`.
- `src/claude.js` `planCity`: new `declinedActivities` parameter. If non-empty, inject a block:
  ```
  Recently declined by this traveler in this trip — DO NOT recommend variants of these:
  - "Uffizi Gallery" (museum, art)
  - "Duomo climb" (cultural, viewpoint)
  ```
- Cap at 20 most recent declines to bound prompt growth.

**Risk:** Could over-correct if a user declines for a one-off reason ("just not today"). Mitigation: phrase the rule as a soft signal — "treat as a strong hint, not an absolute ban."

---

## 3. Cross-city dedup within one trip

**Why:** Madrid / Barcelona / Seville plans are generated independently. The user often sees three "tapas crawls" or three "flamenco shows." Visible failure mode that is trivial to fix.

**Changes:**
- `/api/plan` is currently parallel (`CONCURRENCY = 3`). Two options:
  - **A (cheaper, partial):** Run cities sequentially when `cities.length > 1`. Each subsequent call gets `previouslySuggested: [{ city, name, type, category }]` from completed cities.
  - **B (preserves parallelism):** First-pass plans all cities in parallel, then a fast post-processing pass collects "duplicate concepts across cities" and runs a single repair call to substitute one of each duplicate pair. Cheaper on wall time, more LLM calls.
- Recommend **A** — simpler, the user already accepts ~30s/city wait, and parallelism savings on a 3-city trip are modest (~20s).
- `src/claude.js` `planCity`: new `previouslySuggested` parameter. Inject a block:
  ```
  Already suggested in earlier cities of this trip — avoid generating near-duplicates:
  - Madrid: "Tapas crawl in La Latina" (food)
  - Madrid: "Flamenco at Casa Patas" (show)
  ```

**Risk:** Sequential planning makes total time = sum(per-city) instead of max(per-city). For a 5-city trip this is meaningful. Consider gating on `cities.length <= 3` for parallel, sequential beyond that.

---

## 4. Hard activity-count target derived from pace + duration

**Why:** Prompt currently says "generate a number of activities proportional to length of stay and pace." Claude interprets this loosely. A "very relaxed" 5-day trip and a "non-stop" 5-day trip often differ by only ~20% in activity count when they should differ by 100%+.

**Changes:**
- `src/claude.js` `planCity`: compute `targetCount` server-side:
  ```js
  const days = daysBetween(startDate, endDate);
  const perDayByPace = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 7 };
  const targetCount = Math.max(3, days * perDayByPace[pace]);
  ```
- Inject as a hard rule: `Generate approximately ${targetCount} activities for this ${days}-day stay (range: ${Math.round(targetCount * 0.85)}–${Math.round(targetCount * 1.15)}). Do not under- or over-shoot this range.`
- Adjust constants based on telemetry feedback over time.

**Risk:** A hard count may force filler when there isn't enough genuinely good content for a city. Mitigation: floor of 3, soft range (±15%), explicit instruction that quality > quantity if the city is small.

---

## 5. Streaming activities within a city call

**Why:** Each city call takes 30–60s. The user sees nothing until that city completes. For a 3-city trip, the first activity appears no sooner than ~30s in.

**Changes:**
- `src/claude.js`: switch `client.messages.create` to `client.messages.stream`.
- Parse the streaming JSON incrementally — emit `{ type: 'activity', city, activity }` SSE events as each complete activity object is parsed.
- Frontend Review step: append activity cards as they arrive instead of waiting for the city's `done` event.

**Risk:** Streaming JSON parsing is fiddly. The current `tryParseJsonArray` has 4 fallback strategies for truncation; a streaming parser needs incremental versions of those. **Defer this** until after #1–4 ship and we have telemetry on whether the latency is actually a complaint. Listed for completeness.

---

## 6. Prioritization

Ship order if all approved:
1. **§1 Expose Fun/Risk scores** — small prompt change + small UI badge. Highest ratio of value to effort.
2. **§3 Cross-city dedup** — single new parameter, sequential gating, immediately fixes the most visible failure mode.
3. **§2 Negative signal from declines** — requires plumbing through frontend + plan endpoint, but the cleanest unused leverage.
4. **§4 Hard activity-count target** — one constant table + one prompt line. Ship after #1–3 so we can A/B observe count distribution change in telemetry.
5. **§5 Streaming** — defer. Only revisit if #1–4 land and users still complain about wait time.

**Skip if not approved as a set:** §5 has the highest implementation risk and lowest user-value certainty. Drop first if scope shrinks.

---

## Out of scope (intentionally not in this phase)

- **Restaurant grounding by neighborhood** — needs Brave search reformulation and is really an `/api/activity/replace` problem rather than a `planCity` problem.
- **Recency filtering on web research** — would need date parsing of Brave snippets; high noise.
- **A second pass that scores generated activities against the Decision Framework** — interesting but doubles LLM cost per city.
