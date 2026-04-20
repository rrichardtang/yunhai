# Arrange Rebuild — Phase 5: Polish (Optional)

**Branch:** `feature/arrange-polish`
**Depends on:** Phase 4 merged
**Goal:** Quality-of-life improvements once the hybrid scheduler is stable. Each item is independent — ship the ones that matter, skip the rest.
**Non-goals:** Anything that changes the arrange contract or data model shape.

---

## 1. Intensity alternation (soft constraint)

Activities already have `experience.intensity: low | medium | high` from Phase 1. Push the LLM to alternate.

Changes:
- Prompt (in `src/server.js` arrange handler): extend `activitiesText` line to include intensity, e.g. `| intensity:high`.
- Add soft rule:
  > S6. Alternate intensity within a day. Avoid two `high`-intensity activities back-to-back; pair a `high` with a neighboring `low` or `medium` when possible.
- No validator change — this stays soft. Violations don't trigger repair.

The LLM has the data; the prompt tells it to use it. Low-risk addition.

---

## 2. `must_happen_on_day` soft constraint

Schema field `timing.must_happen_on_day` exists from Phase 1 but is unused. Wire it as a **weaker** lock — forces a specific date but leaves the time flexible.

Changes:
- Prompt: inject a new INPUT block "DATE-CONSTRAINED" listing activities with their required date.
- Hard rule addition: "H6. Any activity in DATE-CONSTRAINED must appear in that date's `ordered_ids` and no other."
- Validator: check that each must-happen activity appears only on its required date.
- UI (Review card): add a "Must happen on" date-only control alongside the existing lock popover. Clear visual distinction from a full lock (e.g., a pin icon vs. the gold lock).

Keep locks and must-happen separate concepts: lock = date + time; must-happen = date only.

---

## 3. Repair-pass telemetry

Instrument the repair pass to understand how often the LLM's first attempt is invalid.

- On each `/api/arrange` call, log (to existing logger or a new `logs/arrange.jsonl` append-only file):
  ```json
  { "ts": "2026-04-19T...", "userId": "...", "cityName": "...",
    "firstPassValid": true|false, "issues": [...], "repairUsed": true|false,
    "secondPassValid": true|false, "flexibleCount": 8, "lockedCount": 2 }
  ```
- Weekly: skim the log, look for dominant issue types. If 60%+ of repairs are triggered by `category_cap`, tighten the prompt's rule wording.

Add a minimal `/api/admin/arrange-stats` route (gate behind an env-based admin flag) that summarizes last N runs.

---

## 4. Distance Matrix caching

The N×N commute matrix is recomputed on every auto-arrange run. For 10 activities that's 100 matrix cells (~2 batched Google calls). Users re-run auto-arrange often during planning.

Cache commute minutes keyed by `(fromPlaceId, toPlaceId)` in a flat JSON file `data/commute-cache.json`. TTL 30 days. Invalidate on user edits to activity location.

Savings: ~90% reduction in Distance Matrix quota usage for active planning sessions.

---

## 5. Unplaced activity recovery UI

Currently `unplaced` activities are surfaced as a list in a toast. Users have to manually find them and re-drag. Better: a sticky "Unplaced (3)" chip on the Arrange step that opens a side panel showing the unplaced cards with their reasons and drag handles.

Low-effort UX fix. Purely frontend.

---

## 6. Arrange run history

Keep the last 3 arrange outputs per city in state so users can "undo arrange" when a new run produces a worse result. Reuse the existing activity-refine rollback pattern if one exists.

State shape:
```js
state.arrangeHistory[cityId] = [
  { ts, placements, diagnostics },  // most recent first
  ...
]
```

Cap at 3 entries per city. Show an "Undo last arrange" button for 60 seconds after each run.

---

## 7. Multi-city arrange

Currently auto-arrange runs one city at a time (`autoArrangeActiveCity`). Users on multi-city trips have to click through each city. Add an "Auto-arrange all cities" button that runs each city sequentially and shows progress.

Parallelizing would be nice but the global LLM semaphore caps concurrency — sequential is fine and keeps the UX predictable.

---

## 8. Prioritization

Ship order if all are approved:
1. Repair-pass telemetry (§3) — data-driven improvements downstream
2. Unplaced recovery UI (§5) — high UX value, low effort
3. Distance Matrix caching (§4) — saves quota
4. Intensity alternation (§1) — noticeable quality win
5. Multi-city arrange (§7)
6. Arrange run history (§6)
7. `must_happen_on_day` (§2) — only if users request it

Skip anything that doesn't have clear user or quota impact.
