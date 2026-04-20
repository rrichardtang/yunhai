# Arrange Rebuild — Phase 3: Time Locks (Finalize Modal)

**Branch:** `feature/arrange-time-locks`
**Depends on:** Phase 1 merged (`timing.fixed` exists on schema), Phase 2 merged (transport buffers), save-button plan merged (checklist `verified` flag + Draft/Finalize buttons)
**Goal:** Clicking "Finalize" opens a modal listing all approved activities in the active city. Pre-checked = locked. User can toggle any lock on/off. Live overlap validation prevents confirming an invalid set. On confirm, locks feed into arrange as hard constraints.
**Non-goals:** No hybrid scheduler. No per-card lock toggle on Review cards.

---

## 1. Concept

A locked activity is pinned to a specific date + time. Two lock sources:
1. **`timing.fixed = { date, time, reason }`** — persistent schema field
2. **Checklist `item.verified === true`** — user checked it off in the checklist

The Finalize modal unifies both. It:
- Shows every approved activity in the active city
- Pre-checks activities with either lock source
- Lets the user toggle locks on/off for this arrange run
- Validates overlaps live
- On confirm: turns checked items into `lockedActivities` payload; excludes them from the LLM input; applies their placements client-side after arrange

Locks bypass the LLM entirely. Client-authoritative. The LLM only sees flexible activities plus `ALREADY OCCUPIED` day windows.

---

## 2. UI — Finalize Modal

### 2.1 Trigger

The "Finalize" button (from the save-button plan) opens this modal. Button is enabled when at least one activity has a lock source (verified checklist OR `timing.fixed`).

### 2.2 Modal markup

```
┌─ Finalize Arrangement ──────────────────────────── ✕ ┐
│                                                      │
│  Lock activities to their current times. Unlocked    │
│  activities will be scheduled by AI.                 │
│                                                      │
│  Day 1 · Mon Apr 24                                  │
│    ☑ 🔒 10:00  Alcázar de los Reyes Cristianos       │
│    ☑ 🔒 15:00  Mezquita-Catedral Guided Tour  📋     │
│    ☐    19:00  Dinner at Casa Pepe                   │
│                                                      │
│  Day 2 · Tue Apr 25                                  │
│    ☑ 🔒 11:00  Medina Azahara Tour  📋               │
│    ☐    14:00  Patios de Córdoba walk                │
│                                                      │
│  ⚠️ Conflict: "Alcázar" and "Mezquita" overlap on    │
│     Mon Apr 24 (10:00–12:00 vs 15:00–17:00) — OK     │
│     or show if real                                  │
│                                                      │
│              [Cancel]  [Confirm]                     │
└──────────────────────────────────────────────────────┘
```

Each row shows:
- Checkbox (lock toggle for this arrange run)
- Lock icon when checked
- Time (editable inline — clicking opens a time picker)
- Activity name
- 📋 badge if sourced from checklist `verified`; no badge if sourced from `timing.fixed`

### 2.3 Default state on open

- Activity with `timing.fixed.date && timing.fixed.time` → checked
- Activity with matching checklist item where `item.verified === true` → checked
- All others → unchecked

### 2.4 Live validation

On every checkbox toggle and every inline time edit, re-run `findLockedOverlaps(lockedSet)`:

```js
function findLockedOverlaps(locked) {
  const intervals = locked.map((entry) => {
    const duration = entry.activity.timing?.duration_minutes || 60;
    return {
      id: entry.activity.id,
      name: entry.activity.name,
      date: entry.date,
      time: entry.time,
      end: addMinutes(entry.time, duration)
    };
  });
  const conflicts = [];
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i], b = intervals[j];
      if (a.date === b.date && a.time < b.end && b.time < a.end) {
        conflicts.push([a, b]);
      }
    }
  }
  return conflicts;
}
```

If `conflicts.length > 0`:
- Show inline warning banner naming the conflicting pairs
- Disable "Confirm & Arrange" button

### 2.5 Confirm handler

```js
function confirmFinalize(lockedSet) {
  // Persist inline time edits back to state
  for (const entry of lockedSet) {
    if (entry.sourceKind === 'fixed') {
      entry.activity.timing.fixed = {
        date: entry.date,
        time: entry.time,
        reason: entry.activity.timing.fixed?.reason || ''
      };
    } else if (entry.sourceKind === 'verified') {
      const item = state.confidenceChecklist.find(
        (c) => c.type === 'activity' && String(c.activityId) === String(entry.activity.id)
      );
      if (item) {
        item.activityDate = entry.date;
        item.activityTime = formatTime12(entry.time);
        syncChecklistDateTimeToPlacement(item);
      }
    }
  }
  persistState();
  closeModal();
  autoArrangeActiveCity({ finalize: true, lockedSet });
}
```

### 2.6 Unlocking inside the modal

Unchecking a `timing.fixed` activity in the modal is a **session-scoped** override — it does NOT clear `timing.fixed`. The activity is flexible for this arrange run only. Next time the modal opens, it's pre-checked again.

Unchecking a verified checklist item does NOT clear `item.verified` either. Same session-scoped semantics.

Rationale: the modal is a "which locks apply to THIS arrange run" picker, not a lock-management UI. Persistent lock/unlock happens in the checklist (toggle verified) or via `timing.fixed` edits elsewhere.

---

## 3. `autoArrangeActiveCity` changes

In `public/app.js` around line 5783:

### 3.1 Partition before the server call

The `lockedSet` passed from the Finalize modal is authoritative. If called without `lockedSet` (Draft mode), no partition — all activities go as flexible.

```js
async function autoArrangeActiveCity(opts = {}) {
  const finalize = Boolean(opts.finalize);
  const lockedSet = Array.isArray(opts.lockedSet) ? opts.lockedSet : [];
  const lockedIds = new Set(lockedSet.map((e) => String(e.activity.id)));

  const locked   = approvedInCity.filter((a) => lockedIds.has(String(a.id)));
  const flexible = approvedInCity.filter((a) => !lockedIds.has(String(a.id)));
  // ...
}
```

Build the payload sending **only** `flexible` as `activities`. Add a new top-level `lockedActivities` array (derived from `lockedSet`, not just `timing.fixed`):

```js
lockedActivities: lockedSet.map((entry) => ({
  id: entry.activity.id,
  date: entry.date,
  time: entry.time,
  duration_minutes: entry.activity.timing?.duration_minutes || 60,
  category: entry.activity.category,
  name: entry.activity.name
}))
```

### 3.2 Merge locks client-side

After the fetch returns:

```js
// First apply whatever the server returned for flexible activities
for (const [id, p] of Object.entries(result.placements || {})) {
  state.placements[id] = p;
}
// Then overwrite from locks — locks always win
for (const entry of lockedSet) {
  const day = findDayForDate(entry.date, activeCity);
  if (day) state.placements[entry.activity.id] = { dayId: day.id, time: entry.time };
}
```

If zero flexible activities, skip the `/api/arrange` call entirely — there's nothing for the LLM to do. Just apply locked placements and return.

### 3.3 Feed locks into the prompt (conflict avoidance)

The flexible activities still need to dodge locked intervals on the same day. Extend the `daysText` builder (around server.js line 1080–1088) so each day line optionally includes an `ALREADY OCCUPIED` suffix. The server receives `lockedActivities`, groups by date, and emits:

```
- 2026-05-03: available 09:00–22:00
  ALREADY OCCUPIED (do not overlap): 14:00–16:30 "Eiffel reservation"
```

Update the RULES block to add a new rule (keep existing rules, just insert):

> 2a. ALREADY OCCUPIED intervals are booked — do not place any activity that overlaps them (including a 20-minute travel buffer on each side).

This is the only server-side prompt change in this phase.

### 3.4 Server-side defensive drop

In the response JSON parser (server.js around line 1121), after parsing:

```js
for (const id of lockedIds) {
  if (result.placements && result.placements[id]) {
    delete result.placements[id];   // LLM shouldn't emit these; drop if it does
  }
}
```

Belt-and-suspenders — client merge already overrides, but cleaner wire format.

---

## 4. Lock icon on Arrange cards

After Finalize runs, activities whose placement came from a lock show a lock icon in the top-right corner of their Arrange card (matching the budget optimization step's icon style). The icon is derived from the last `lockedSet` used for this city — stored on `state.lastFinalizeLocks[cityId] = lockedSet`.

Draft mode clears `state.lastFinalizeLocks[cityId]` so no lock icons show after a Draft run.

Drag handlers refuse to move activities shown as locked:
```js
if ((state.lastFinalizeLocks[cityId] || []).some((e) => e.activity.id === activity.id)) {
  e.preventDefault();
  showToast('This activity is locked. Re-open Finalize to unlock.');
  return;
}
```

---

## 5. Edge cases

- **Arrival/departure window changes** invalidate a `timing.fixed` lock: on logistics save, scan fixed locks in this city; drop any that fall outside the new window with a toast "Unlocked X — time now outside city window". Checklist-verified locks are not auto-dropped (their `activityDate`/`activityTime` are user-entered); modal overlap validation will flag it at next Finalize.
- **Lock outside opening hours:** allowed — modal warns inline but doesn't block.
- **Only locks, zero flexible:** skip `/api/arrange`, apply locked placements directly.
- **Duration edit causes overlap:** caught at next Finalize open — modal shows conflict, disables Confirm.

---

## 6. Testing

Manual QA:
1. Create a trip, approve 6 activities across 3 days. Run Draft. Note placements.
2. Check off activity A in checklist with time 14:00 on Day 2.
3. Click Finalize → modal shows A pre-checked at 14:00 with 📋 badge.
4. Confirm. A lands at 14:00 Day 2; others rearranged around it; lock icon on A's Arrange card.
5. Try dragging A → toast "This activity is locked…".
6. Click Draft → A moves freely; lock icon disappears.
7. In modal, manually check two activities with overlapping times → warning banner; Confirm disabled.

Automated:
- `src/server.test.js`: POST `/api/arrange` with `lockedActivities: [{id, date, time, duration_minutes: 60}]`. Assert response `placements` excludes locked id. Assert prompt contains `ALREADY OCCUPIED`.
- `src/findLockedOverlaps.test.js`: unit-test the overlap detector with same-day / different-day / touching-boundaries cases.

---

## 7. Exit criteria

- [ ] Finalize button opens modal listing all approved activities for the city
- [ ] Activities with `timing.fixed` or checklist `verified` are pre-checked
- [ ] Inline time editing works in the modal
- [ ] Live overlap validation shows warning + disables Confirm
- [ ] Confirm triggers arrange with `lockedActivities`; flexible activities avoid locked intervals
- [ ] Lock icon shown on Arrange cards after Finalize; absent after Draft
- [ ] Dragging a locked card blocked with clear message
- [ ] `npm test` green
