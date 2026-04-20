# Arrange Rebuild — Phase 3: Time Locks

**Branch:** `feature/arrange-time-locks`
**Depends on:** Phase 1 merged (`timing.fixed` exists on schema), Phase 2 merged (transport buffers)
**Goal:** Users can mark an activity as locked to a specific date + time. Locks never move during auto-arrange, even with the old prompt.
**Non-goals:** No hybrid scheduler. No server prompt rewrite. Server-side changes are minimal — just accept a new `lockedActivities` field and don't send those activities to the LLM.

---

## 1. Concept

A locked activity carries `timing.fixed = { date, time, reason }`. That field is authoritative:
1. Client never sends locked activities to `/api/arrange`.
2. Client writes `state.placements[id]` from `timing.fixed` directly, both before and after the arrange call.
3. Drag handlers refuse to move locked activities.
4. If the user wants to move a locked activity, they must unlock it first.

Locks bypass the LLM entirely. Client-authoritative. Server never needs to reason about them.

---

## 2. UI — Lock toggle on Review cards

### 2.1 Card markup

On each activity card in the Review step, add a lock control at the top-right (grep for the Review card render fn — it's the one that shows verdict + cost + buttons). Markup:

```html
<button class="lock-toggle" data-activity-id="${a.id}" aria-label="Lock date and time">
  <svg class="icon-unlocked" ...></svg>
  <svg class="icon-locked" ...></svg>
</button>
```

When the activity is locked, add class `is-locked` to the card and a gold pill badge reading `Locked · Tue May 5 · 14:00 (reason)` near the name.

### 2.2 Lock editor popover

Clicking the toggle opens a small popover (reuse existing popover mechanism from `overlayManager` if one exists; otherwise a simple absolute-positioned div):

```
📌 Lock this activity
Date  [date input, default today or current placement date]
Time  [time input, default current placement time or 10:00]
Reason (optional) [text input, e.g. "Booked tickets"]
[Save] [Cancel] [Unlock]  ← Unlock only shown when already locked
```

Validation on Save:
- Date must be within the city's arrival–departure window.
- Time must be within that day's window (after `arrivalTime + arrivalTransit + arrivalBuffer` on arrival day; before `departureTime − departureTransit − departureBuffer` on departure day).
- No other locked activity on the same day may overlap `[time, time + duration + 20min]`.
- If the activity's `timing.opening_hours` is set and the chosen time is outside it, show a non-fatal warning: "This is outside listed opening hours — continue anyway?" with a confirm.

If validation fails, show inline error and do not save.

### 2.3 Save handler

```js
function saveLock(activity, date, time, reason) {
  activity.timing.fixed = { date, time, reason: reason || '' };
  const day = findDayForDate(date, activeCity);
  state.placements[activity.id] = { dayId: day.id, time };
  persistState();
  rerenderCard(activity);
}
function unlock(activity) {
  activity.timing.fixed = null;
  // Do NOT remove state.placements — user may want to keep the current time;
  // it's just no longer locked.
  persistState();
  rerenderCard(activity);
}
```

---

## 3. `autoArrangeActiveCity` changes

In `public/app.js` around line 5783:

### 3.1 Partition before the server call

```js
const approvedInCity = ...; // existing filter
const locked   = approvedInCity.filter(a => a.timing?.fixed?.date && a.timing?.fixed?.time);
const flexible = approvedInCity.filter(a => !(a.timing?.fixed?.date && a.timing?.fixed?.time));
```

Build the payload sending **only** `flexible` as `activities`. Add a new top-level `lockedActivities` array:

```js
lockedActivities: locked.map(a => ({
  id: a.id,
  date: a.timing.fixed.date,
  time: a.timing.fixed.time,
  duration_minutes: a.timing.duration_minutes,
  category: a.category,
  name: a.name
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
for (const a of locked) {
  const day = findDayForDate(a.timing.fixed.date, activeCity);
  if (day) state.placements[a.id] = { dayId: day.id, time: a.timing.fixed.time };
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

## 4. Drag handler protection

Find the drag/drop handler for placed activity cards in the Arrange step (grep for `dragend`, `dragover`, or drag logic around `state.placements` mutations). On `dragstart`:

```js
if (activity.timing?.fixed) {
  e.preventDefault();
  showToast("This activity is locked. Unlock it first to move.");
  return;
}
```

Also protect the Review step's time-shift controls (if any) the same way.

---

## 5. Edge cases

- **User locks then edits duration:** the lock's `time` stays but the occupied interval grows. If the new interval overlaps another lock, show a validation error when the duration change is committed and refuse the edit (or offer to auto-shrink).
- **User deletes the city:** locked activities in that city are removed with the city, same as non-locked. No special handling.
- **User moves arrival time earlier/later:** a lock might fall outside the new window. On logistics save, validate all locks for that city; any invalid one is automatically unlocked with a toast "Unlocked X — its time is outside the new city window". Do not silently delete the `fixed` field without notice.
- **Conflicting locks at save time:** validation in §2.2 prevents creation. If somehow persisted (e.g., migrated data), on the first auto-arrange call, server rejects `lockedActivities` with `400 { error: 'Conflicting locks', ids: [...] }` and the client shows them in a resolution UI (lightweight — just highlight the offending cards and ask the user to unlock one).
- **Lock outside opening hours:** allowed with warning at save time. Never blocks; locks are authoritative.
- **Auto-arrange with only locks and no flexible:** short-circuit, no LLM call.

---

## 6. Testing

Manual QA script:
1. Create a trip with 6 activities across 3 days. Run auto-arrange. Note placements.
2. Lock activity A to Day 2 14:00 with reason "booked tickets".
3. Re-run auto-arrange. Expect A to be at Day 2 14:00 exactly. Other placements may reshuffle but should not overlap A (within 20-min buffer).
4. Try to drag A in the Arrange step. Expect toast "This activity is locked…".
5. Unlock A, drag to Day 3. Expect drag succeeds.
6. Lock A to Day 2 14:00. Lock B to Day 2 15:00 with duration 90 min. Expect validation error on B save ("overlaps existing lock").

Automated:
- `src/server.test.js`: POST `/api/arrange` with `lockedActivities: [{id, date, time, duration_minutes: 60}]`. Assert the response `placements` does not include the locked id. Assert the prompt sent to Claude (mock the client) contains `ALREADY OCCUPIED`.

---

## 7. Exit criteria

- [ ] Lock toggle appears on every Review card
- [ ] Locking + re-running auto-arrange never moves the locked activity
- [ ] Dragging a locked activity is blocked with a clear message
- [ ] Overlap validation prevents saving conflicting locks
- [ ] Flexible activities respect `ALREADY OCCUPIED` intervals in the prompt (spot-check a few generations)
- [ ] `npm test` green
