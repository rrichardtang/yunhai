# Arrange Rebuild — Phase 4: Hybrid Scheduler (LLM orders, code assigns times)

**Branch:** `feature/arrange-hybrid-scheduler`
**Depends on:** Phases 1–3 merged
**Goal:** Replace `/api/arrange`'s "LLM returns placements with times" contract with "LLM returns per-day ordered lists; server code assigns times deterministically; validator + single repair pass catches violations". This fixes category clustering, overlap bugs, and window-overflow bugs in one change.
**Non-goals:** Intensity alternation, `must_happen_on_day`. Those ship in Phase 5.

---

## 1. New flow

```
CLIENT                                           SERVER
────────────────────────────────────────────────────────────────
autoArrangeActiveCity
  ├── partition locked vs flexible          →
  ├── build commuteMatrix (N×N for pairs)   →    POST /api/commute-matrix
  │                                                   → Google Distance Matrix (batched)
  ├── POST /api/arrange {                   →
  │     days (with occupiedIntervals),
  │     flexible,
  │     locked,
  │     commuteMatrix,
  │     buffers,
  │     transportModes, profile, ...
  │   }
  │                                              a. Build prompt (HARD/SOFT/INPUTS)
  │                                              b. Claude → { day_plans, unplaced }
  │                                              c. assignTimes(day_plans, ctx)
  │                                                   → { placements, unplaced }
  │                                              d. validate(placements, ctx)
  │                                                   → { ok, issues }
  │                                              e. if !ok: single repair prompt,
  │                                                         re-assign, re-validate
  │                                              f. respond { placements, unplaced,
  │                                                           diagnostics }
  ├── merge server placements                ←
  ├── merge locks (always win)
  └── rerender
```

---

## 2. Prompt (verbatim template for `src/server.js`)

Build inputs first:

- `lockedText` — per locked activity: `- id:abc "Eiffel" 2026-05-03 14:00–16:30 (booked tickets)`
- `daysText` — per day:
  ```
  - 2026-05-03 (arrival day): window 11:30–23:00
      arrival buffer: 30min transit + 135min mode=flight-international = 165min pre-block
      occupied: 14:00–16:30 "Eiffel"
      capacity ≈ 5h10m for flexible
  ```
- `activitiesText` — per flexible activity: `- id:xyz "Louvre" | cultural/museum | 150min | hours:10:00–18:00 | preferred:14:00 | at:Rue X | highlight`
- `categoryCountsText` — `food: 5 total; cultural: 3; sightseeing: 4`
- `travelerBlock`, `transportBlock` — small lines describing traveler count + arrival/departure modes

Prompt template:

```
You arrange approved activities into per-day ordered lists.
You do NOT assign times — times are computed deterministically by server code after your response.

HARD CONSTRAINTS (violations = invalid output):
H1. LOCKED ANCHORS are immovable. Never include a locked id in any ordered_ids list.
    Flexible activities scheduled on the same day must fit around the occupied intervals.
H2. Day windows: every flexible activity must be able to fit within the day's available window,
    accounting for its duration and the buffers noted per day.
H3. Meal category caps (per day): at most ONE breakfast, ONE lunch, ONE dinner.
H4. Non-meal category caps (per day): at most TWO activities sharing the same non-meal category
    (sightseeing, cultural, tour, shopping, nature, landmark, relaxation).
H5. If an activity cannot fit any day without breaking a hard constraint, put it in "unplaced"
    with a one-sentence reason. Never silently drop activities.

SOFT CONSTRAINTS (optimize; relax only if a hard constraint forces it):
S1. Cluster by geography — group nearby activities on the same day.
S2. Alternate intensity — avoid two long/heavy activities back-to-back; interleave with lighter ones.
S3. Day flow: breakfast first if present; dinner last if present; lunch around midday;
    major highlights in the late morning or early afternoon.
S4. Honor pace preference: ${paceDesc}.
S5. Honor preferred_time hints — they inform ordering, not exact times.

INPUT — LOCKED ANCHORS:
${lockedText}

INPUT — DAYS:
${daysText}

INPUT — FLEXIBLE ACTIVITIES:
${activitiesText}

INPUT — CATEGORY COUNTS: ${categoryCountsText}
INPUT — TRAVELERS: ${travelerBlock}
INPUT — TRANSPORT: ${transportBlock}

OUTPUT — strict JSON, no prose, no times, no extra fields:
{"day_plans":[{"date":"YYYY-MM-DD","ordered_ids":["id1","id2"]}],
 "unplaced":[{"id":"...","reason":"..."}]}

Rules for output shape:
- Every flexible id appears exactly once across all ordered_ids OR in unplaced. Never both, never neither.
- Never include a locked id.
- ordered_ids is the intended earliest-to-latest sequence for that day.
- No times, no labels, no extra keys.
```

---

## 3. `src/arrangeTimeAssigner.js` (new)

```js
const { MIN_BUFFER_BETWEEN, DEFAULT_COMMUTE_MIN, MEAL_BANDS } = require('./arrangeConstants');

function assignTimes({ days, dayPlans, activitiesById, lockedPlacements, commuteMatrix }) {
  const placements = {};
  const unplaced = [];

  for (const day of days) {
    const plan = dayPlans.find(p => p.date === day.date) || { ordered_ids: [] };
    const dayStart = effectiveDayStart(day);
    const dayEnd = effectiveDayEnd(day);

    let cursor = dayStart;
    let prevId = null;
    const occupied = [...(day.occupiedIntervals || [])].sort((a, b) => a.startMin - b.startMin);

    for (let i = 0; i < plan.ordered_ids.length; i++) {
      const id = plan.ordered_ids[i];
      if (lockedPlacements[id]) continue;   // defensive

      const act = activitiesById[id];
      if (!act) { unplaced.push({ id, reason: 'unknown activity id' }); continue; }

      const duration = act.timing.duration_minutes;
      const windows = effectiveOpeningWindows(act);
      const start = findEarliestSlot(cursor, duration, windows, occupied, dayEnd);

      if (start == null) {
        unplaced.push({ id, reason: 'no time remaining in day window' });
        continue;
      }

      placements[id] = { date: day.date, time: toHHMM(start) };

      const nextId = plan.ordered_ids[i + 1];
      const commute = nextId
        ? (commuteMatrix?.[id]?.[nextId] ?? DEFAULT_COMMUTE_MIN)
        : MIN_BUFFER_BETWEEN;
      cursor = start + duration + Math.max(commute, MIN_BUFFER_BETWEEN);
      prevId = id;
    }
  }

  return { placements, unplaced };
}
```

Helpers:

- `effectiveDayStart(day)` — `max(day.windowStart, day.isArrival ? arrivalTime + transit + buffer : 0)`
- `effectiveDayEnd(day)` — `min(day.windowEnd, day.isDeparture ? departureTime − transit − buffer : Infinity)`
- `effectiveOpeningWindows(act)` — parse `act.timing.opening_hours` into `[[startMin, endMin], ...]`. For meal categories, intersect with `MEAL_BANDS[mealType]`:
  - breakfast: 420–540 (7:00–9:00)
  - lunch: 690–810 (11:30–13:30)
  - dinner: 1080–1230 (18:00–20:30)
  - cafe: 540–1020 (9:00–17:00)
  If intersection is empty, fall back to opening hours alone (meal timing relaxed).
- `findEarliestSlot(cursor, duration, windows, occupied, dayEnd)`:
  ```
  let t = cursor;
  while (true) {
    t = bumpToWindow(t, duration, windows);          // jump to next opening window that can hold duration
    if (t == null || t + duration > dayEnd) return null;
    const conflict = occupied.find(o => overlaps([t, t + duration], [o.startMin, o.endMin]));
    if (conflict) { t = conflict.endMin + MIN_BUFFER_BETWEEN; continue; }
    return t;
  }
  ```
- `toHHMM(mins)` — `${pad(Math.floor(mins/60))}:${pad(mins%60)}`
- Opening-hours parser: handle `"09:00-17:00"`, `"9am-5pm"`, `"10:00-14:00, 17:00-22:00"` (comma-separated ranges). Round to minutes. On parse failure, return `[[0, 1440]]` (always open).

Constants in `src/arrangeConstants.js`:
```js
module.exports = {
  MIN_BUFFER_BETWEEN: 20,
  DEFAULT_COMMUTE_MIN: 20,
  MEAL_BANDS: {
    breakfast: [420, 540],
    lunch:     [690, 810],
    dinner:    [1080, 1230],
    cafe:      [540, 1020]
  }
};
```

---

## 4. `src/arrangeValidator.js` (new)

```js
function validate({ placements, lockedPlacements, days, activitiesById }) {
  const issues = [];

  // Group by date
  const byDate = groupPlacementsByDate(placements, activitiesById);
  for (const [date, entries] of Object.entries(byDate)) {
    const day = days.find(d => d.date === date);

    // 1. Pairwise overlap
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (overlapsWithBuffer(entries[i], entries[j])) {
          issues.push({ type: 'overlap', day: date, ids: [entries[i].id, entries[j].id],
            message: `${entries[i].id} and ${entries[j].id} overlap on ${date}` });
        }
      }
    }

    // 2. Lock overlap
    const locks = Object.values(lockedPlacements).filter(l => l.date === date);
    for (const e of entries) {
      for (const l of locks) {
        if (overlapsWithBuffer(e, l)) {
          issues.push({ type: 'lock_overlap', day: date, id: e.id,
            message: `${e.id} overlaps locked anchor on ${date}` });
        }
      }
    }

    // 3. Day window
    for (const e of entries) {
      if (e.startMin < effectiveDayStart(day) || e.endMin > effectiveDayEnd(day)) {
        issues.push({ type: 'window', day: date, id: e.id,
          message: `${e.id} outside day window on ${date}` });
      }
    }

    // 4. Meal cap
    const meals = { breakfast: 0, lunch: 0, dinner: 0 };
    for (const e of entries) {
      const mt = activitiesById[e.id]?.meal_type;
      if (mt && meals[mt] != null) meals[mt]++;
    }
    for (const [mt, n] of Object.entries(meals)) {
      if (n > 1) issues.push({ type: 'meal_cap', day: date, meal: mt,
        message: `${n} ${mt} activities on ${date} (max 1)` });
    }

    // 5. Non-meal cap
    const cats = {};
    for (const e of entries) {
      const a = activitiesById[e.id];
      if (a.meal_type) continue;
      cats[a.category] = (cats[a.category] || 0) + 1;
    }
    for (const [cat, n] of Object.entries(cats)) {
      if (n > 2) issues.push({ type: 'category_cap', day: date, category: cat,
        message: `${n} ${cat} activities on ${date} (max 2)` });
    }
  }

  return { ok: issues.length === 0, issues };
}
```

---

## 5. Repair pass (single attempt)

In `/api/arrange` after first validate:

```js
if (!v1.ok) {
  const repairPrompt = buildRepairPrompt({ dayPlans, issues: v1.issues });
  const repaired = await callClaudeForJson(repairPrompt);
  const r2 = assignTimes({ ...ctx, dayPlans: repaired.day_plans });
  const v2 = validate({ ...ctx, placements: r2.placements });
  return res.json({
    placements: r2.placements,
    unplaced: [...r2.unplaced, ...(repaired.unplaced || [])],
    diagnostics: v2.ok ? [] : v2.issues.map(i => i.message)
  });
}
```

Repair prompt template:

```
A previous ordering failed deterministic validation. Fix by ONLY reordering activities
within their day OR moving specific ids to unplaced. DO NOT assign times or change the schema.

CURRENT ORDERING:
${JSON.stringify(dayPlans)}

ISSUES (fix every one):
${issues.map(i => `- [${i.type}] ${i.message}`).join('\n')}

OUTPUT (identical schema as before, strict JSON):
{"day_plans":[{"date":"...","ordered_ids":[...]}],"unplaced":[{"id":"...","reason":"..."}]}
```

Cap at one repair attempt. Second failure returns `r2` anyway with diagnostics surfaced to the user.

---

## 6. `POST /api/commute-matrix` (new route)

Request:
```js
{ activities: [{ id, lat, lng }, ...] }
```
Response:
```js
{ matrix: { [fromId]: { [toId]: minutes } } }
```

Implementation in `src/server.js`:
- Tile into ≤10×10 batches (Google per-request limit is 100 elements).
- Skip pairs where both endpoints are the same point (`minutes: 0`).
- On API error, return `{ matrix: {} }` with a diagnostic — assigner falls back to `DEFAULT_COMMUTE_MIN`.
- Cache per-request in memory; optional: longer-term cache keyed by `(fromPlaceId, toPlaceId)` in a simple JSON file, invalidate after 30 days.

Client helper in `public/app.js` (near existing `fetchCommutesForActivities`): `buildCommuteMatrix(activities)` that POSTs to the new endpoint and returns the matrix. Call it before `/api/arrange` inside `autoArrangeActiveCity`.

---

## 7. Server `/api/arrange` rewrite

Replace lines 1054–1130 of `src/server.js` with:

1. Parse body: `days, flexible, locked, commuteMatrix, buffers, profile, budget, numTravelers, numChildren, approvedCostTotal`.
2. If `flexible.length === 0`, short-circuit: `return res.json({ placements: {}, unplaced: [], diagnostics: [] })`.
3. Validate input: each locked has id/date/time/duration_minutes; fail 400 on missing.
4. Build `activitiesById`, `lockedPlacements` (convert to `{dayId, startMin, endMin, date}` intervals).
5. Build `daysText`, `lockedText`, `activitiesText`, `categoryCountsText`, `transportBlock`, `travelerBlock`.
6. Build prompt from §2. Call Claude.
7. Parse `{ day_plans, unplaced }`. Drop any locked ids that slipped into `ordered_ids`.
8. Call `assignTimes(...)`.
9. Call `validate(...)`.
10. If `!ok`, run repair pass §5.
11. Respond `{ placements, unplaced, diagnostics }`.

All Claude calls go through the existing semaphore wrapper.

---

## 8. Client diagnostics

In `autoArrangeActiveCity`, when `response.diagnostics.length > 0`, surface them in the arrange-result toast/modal (there's already a place for "unplaced" reasons — extend it). Each diagnostic is a human-readable string; render as a warning list.

---

## 9. CLAUDE.md revision

Replace the bullet:
> - **Trust the LLM for scheduling**: Auto-arrange passes commute times and activity constraints to Claude and uses its output directly — no hardcoded post-processing.

With:
> - **Hybrid scheduling for auto-arrange**: `/api/arrange` splits into LLM-driven ordering and deterministic time assignment. Claude returns per-day `ordered_ids` only; `src/arrangeTimeAssigner.js` computes concrete times using opening hours, commute matrix, day windows, meal bands, and transport-mode buffers; `src/arrangeValidator.js` verifies overlaps, caps, and window bounds. A single repair prompt runs if validation fails, then the result is returned regardless with diagnostics. Locked activities (`activity.timing.fixed`) bypass the LLM entirely and are merged client-side.

---

## 10. Testing

New test files:

**`src/arrangeTimeAssigner.test.js`**
- Single-day plan with 3 activities, no conflicts — exact times produced.
- Activity whose opening_hours doesn't start until after cursor — cursor jumps forward.
- Meal band snapping: lunch at 10:00 gets snapped to 11:30 (band start).
- Lock in the middle of a day — flexible activity around it gets pushed after lock.endMin + 20.
- Day window overflow — last activity pushed to unplaced with reason `no time remaining`.
- Missing commute matrix entry — falls back to 20 min.
- Arrival day with flight+international buffer — first activity ≥ arrivalTime + transit + 135min.

**`src/arrangeValidator.test.js`**
- Detects overlap, lock overlap, window violation, meal cap (2 lunches), category cap (3 museums).
- Empty placements → ok.

**`src/server.test.js`** (extend)
- End-to-end `/api/arrange` with a stubbed Claude returning a plausible `day_plans`. Assert final `placements` has times on a valid grid.
- Validation failure → repair pass exercised (requires a 2-response Claude mock).

---

## 11. Edge cases

- **Claude returns a locked id in ordered_ids:** drop silently before `assignTimes`.
- **Claude returns an id not in flexible:** ignore; add to unplaced with reason `unknown id`.
- **Claude returns an id twice:** keep first occurrence, drop subsequent.
- **Empty ordered_ids for a day:** valid — that day has no flexible activities.
- **All activities for a day go unplaced due to window overflow:** response surfaces diagnostics; client shows the day as empty with a warning.
- **Commute matrix with `NaN` or negative values:** treat as missing, use fallback.
- **Activity duration > remaining day window:** immediate unplaced with reason `duration exceeds day window`.

---

## 12. Exit criteria

- [ ] Category clustering bug (two lunches, multiple walking tours) eliminated in regression test trip
- [ ] Locked activity on a mid-day slot forces flexible activities around it — no overlap
- [ ] `/api/arrange` response is always deterministic given identical LLM output (no time drift)
- [ ] Repair pass fires when validator finds issues; logs both attempts for observability
- [ ] `npm test` green; new test files cover assigner + validator
- [ ] CLAUDE.md architectural decisions updated
