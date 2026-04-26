# Arrange Rebuild — Phase 5: Polish (Optional)

**Branch:** `feature/arrange-polish`
**Depends on:** Phase 4 merged
**Goal:** Quality-of-life improvements once the hybrid scheduler is stable. Each item is independent — ship the ones that matter, skip the rest.
**Non-goals:** Anything that changes the arrange contract or data model shape.

---

## 1. Intensity alternation (soft constraint)

Activities already have `experience.intensity: low | medium | high` from Phase 1. Push the LLM to alternate.

Changes:
- Prompt (in `src/services/arrangePromptHybrid.js`): extend the activities line to include intensity, e.g. `| intensity:high`.
- Add soft rule:
  > S6. Alternate intensity within a day. Avoid two `high`-intensity activities back-to-back; pair a `high` with a neighboring `low` or `medium` when possible.
- No validator change — this stays soft. Violations don't trigger repair.

The LLM has the data; the prompt tells it to use it. Low-risk addition.

---

## 2. Repair-pass telemetry

Phase 4 returns `diagnostics` to the client but doesn't persist them. Instrument the repair pass to understand how often the LLM's first attempt is invalid.

- On each `/api/arrange` call, append to `logs/arrange.jsonl`:
  ```json
  { "ts": "2026-04-26T...", "userId": "...", "cityName": "...",
    "firstPassValid": true|false, "issues": [...], "repairUsed": true|false,
    "secondPassValid": true|false, "flexibleCount": 8, "lockedCount": 2 }
  ```
- Weekly: skim the log, look for dominant issue types. If 60%+ of repairs are triggered by `category_cap`, tighten the prompt's rule wording.
- Add a minimal `/api/admin/arrange-stats` route (gate behind an env-based admin flag) summarizing last N runs.

---

## 3. Distance Matrix caching

`/api/commute-matrix` recomputes the N×N pairs serially in batches of 6 on every Draft. For 10 activities that's 100 cells. Users re-run Draft often during planning, and current_state.md flags this as a latency risk.

Cache commute minutes keyed by `(fromPlaceId, toPlaceId, mode)` in `data/commute-cache.json`. TTL 30 days. Invalidate on user edits to activity location.

Savings: ~90% reduction in Distance Matrix quota usage and faster Draft round-trips for active planning sessions.

---

## 4. Unplaced activity recovery UI

Currently `unplaced` activities are surfaced as a toast. Users have to manually find them and re-drag. Better: a sticky "Unplaced (3)" chip on the Arrange step that opens a side panel showing the unplaced cards with their reasons (from `diagnostics`) and drag handles.

Low-effort UX fix. Purely frontend.

---

## 5. Prioritization

Ship order if all are approved:
1. Unplaced recovery UI (§4) — high UX value, low effort
2. Distance Matrix caching (§3) — saves quota and speeds up Draft
3. Repair-pass telemetry (§2) — data-driven prompt improvements downstream
4. Intensity alternation (§1) — noticeable quality win

Skip anything that doesn't have clear user or quota impact.

---

## Dropped from earlier draft (2026-04-26 review)

- **`must_happen_on_day` soft constraint** — Superseded by the Draft → Finalize lock flow. Date-only soft locks compete with the existing hard-lock UX.
- **Arrange run history / undo** — Less compelling now that Draft is non-destructive by design and Finalize is the explicit commit step.
- **Multi-city "Auto-arrange all"** — Bypasses per-city Finalize. Reconsider only if users explicitly ask; needs UX rethink first.
