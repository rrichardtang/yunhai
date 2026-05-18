# Current State

_Last updated: 2026-05-18_

## Objective
Overhaul Arrange-step staging area + drag-and-drop: replace Sortable.js with custom pointer-driven drag matching `design_handoff_arrange_drag/`. Enforce a 30-minute "no-go" buffer before and after every placed activity so containers can't sit adjacent.

## Active Workstream
Implementation complete locally. Pending VPS smoke test.

Changes:
- `public/app.js` — `renderArrange()` swaps Sortable instances for delegated pointerdown on `#stagingArea` + `#dayColumns`; new `bindArrangeDrag`, `startArrangeDrag`, `onArrangePointerMove`, `onArrangePointerUp`, `cancelArrangeDrag`, `renderArrangeBlockedRanges`, `arrangeIsValidDrop`. 15-min snap. 30-min buffer baked into both collision check and overlay rendering (`.blocked-buffer` lighter strips around `.blocked-core`).
- `public/planner.html` — added `.staging__head` with `Unplaced activities` label, count pill (`#stagingCount`), hint text. Removed `sortablejs` CDN script.
- `public/styles.css` — appended drag-overhaul section: `.staging__head*`, `.day-head__pill`, `.blocked-layer`, `.blocked-core`, `.blocked-buffer`, `.drop-indicator(.invalid)`, `.drag-ghost*`, `.day-grid-wrap.drag-active`, `.day-grid-wrap.drop-target`.
- Removed orphans: `nearestLegalSlot`, `paintDropOverlaysForDrag`, `clearDropOverlays`, `getDraggingActivityDuration`, `_arrangeSortables`, `_sortableDragging`, `.drop-zone-overlay` markup.

## Constraints
- Hour window stays at current `DAY_START_HOUR=6` → `DAY_END_HOUR=26` (per user choice; not the prototype's 7–23).
- Per-city nav preserved — only the active city's days render in the timeline.
- Locked activities undraggable AND counted as collision obstacles (their range already feeds `blockedBandsForDay` via `state.placements`).

## Risks
- Day-columns horizontal scroller doesn't auto-scroll while dragging near edges (Sortable did). Acceptable for v1.
- `rAF`-throttled move handler renders ~N×days overlay nodes; verify on a 14-day trip.

## Next Actions
- Push branch `feature/arrange-fixes` to remote.
- VPS smoke test:
  1. Drag staging card → empty day slot (15-min snap)
  2. Hover within 30 min of existing item → red indicator + ghost "can't drop here — busy"
  3. Drop exactly 30 min after existing end → valid
  4. Drag within same day → own buffer doesn't block itself
  5. Locked item → no pickup; drop near locked → blocked
  6. Drop outside any day → returns to staging
  7. Escape mid-drag → cancels
  8. Commute pills refresh post-drop
