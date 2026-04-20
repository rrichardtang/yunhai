# Arrange Rebuild — Phase 2: Transport Mode + Arrival/Departure Buffers

**Branch:** `feature/arrange-transport-buffers`
**Depends on:** Phase 1 merged (new activity schema in place)
**Goal:** Add required transport mode to city arrival/departure logistics and apply mode-based buffers to the first/last activity of a city.
**Non-goals:** No lock UI. No hybrid scheduler. No new prompt — existing `/api/arrange` still returns placements; we only change the `fixedStart` / `fixedEnd` times it is told about.

---

## 1. Why

The current arrival "FIXED FIRST" time equals `arrivalTime + Google Distance Matrix transit`. That's pure driving time — no customs, no baggage, no check-in, no decompress buffer. Users get scheduled into walking tours 30 minutes after an international flight lands. The app cannot infer flight vs. train from addresses alone. Solution: user picks the mode; code applies the right buffer.

---

## 2. Data model changes

### 2.1 City logistics

Current `normalizeCityLogistics` in `public/app.js:501–533` stores:
```js
arrival:   { location, time, placeId, lat, lng }
departure: { location, time, placeId, lat, lng }
```

Add two fields to each:
```js
mode: "flight" | "train" | "car" | "other"    // default: "flight"
international: boolean                         // default: true; only meaningful when mode === "flight"
```

Update the normalize function to coerce unknown values to defaults. Update any other places logistics are serialized (grep `logistics.arrival`, `logistics.departure` in `app.js`) to preserve these fields through state round-trips.

### 2.2 Stored itineraries

When loading itineraries that predate this phase, default `mode: "flight"`, `international: true`. Do this in the same client-side migration pass added in Phase 1 — extend it to also migrate city logistics, not just activities.

---

## 3. Buffer tables

Create `src/arrangeBuffers.js`:

```js
const ARRIVAL_BUFFER_MINS = {
  flight: { domestic: 70, international: 135 },
  train: 45,
  car: 35,
  other: 60
};

const DEPARTURE_BUFFER_MINS = {
  flight: { domestic: 120, international: 180 },
  train: 30,
  car: 15,
  other: 60
};

function arrivalBufferMins(mode, international) {
  const v = ARRIVAL_BUFFER_MINS[mode] ?? ARRIVAL_BUFFER_MINS.other;
  return typeof v === 'number' ? v : (international ? v.international : v.domestic);
}

function departureBufferMins(mode, international) {
  const v = DEPARTURE_BUFFER_MINS[mode] ?? DEPARTURE_BUFFER_MINS.other;
  return typeof v === 'number' ? v : (international ? v.international : v.domestic);
}

const TRANSIT_FALLBACK_MINS = {
  flight: 45, train: 20, car: 25, other: 30
};

module.exports = {
  ARRIVAL_BUFFER_MINS, DEPARTURE_BUFFER_MINS, TRANSIT_FALLBACK_MINS,
  arrivalBufferMins, departureBufferMins
};
```

Mirror the same values in `public/js/arrangeBuffers.js` for the client (plain script, no imports). Both files must stay in sync — note this in `decisions.md`.

These buffers are **added on top of** the Google Distance Matrix transit leg. They represent non-driving time (customs, check-in, freshen-up) not reflected in the driving estimate.

---

## 4. UI changes

### 4.1 City drawer arrival/departure rows

In `public/app.js` around lines 2923–2941 (the city drawer arrival and departure rows), add two elements per row next to the existing time input:

```html
<select data-logistics="arrivalMode" aria-label="Arrival transport">
  <option value="flight">Flight</option>
  <option value="train">Train</option>
  <option value="car">Car</option>
  <option value="other">Other</option>
</select>
<label class="intl-toggle" data-mode-dep="arrivalMode">
  <input type="checkbox" data-logistics="arrivalInternational">
  International
</label>
```

Same for departure: `data-logistics="departureMode"` and `departureInternational`.

Show/hide the international checkbox based on the select value — only relevant for `flight`. Add a listener:
```js
selectEl.addEventListener('change', e => {
  const label = row.querySelector('.intl-toggle');
  label.hidden = e.target.value !== 'flight';
});
```

Initialize `hidden` on render based on current mode.

### 4.2 Persistence

The existing `[data-logistics]` handler (grep for the event wiring in `app.js` — there's already one for `location`, `time`, `placeId`) should be extended to handle `arrivalMode`, `arrivalInternational`, `departureMode`, `departureInternational`. For the checkbox, read `.checked` instead of `.value`.

Writes go through the same state update + `statePersistence` save path as other logistics fields.

---

## 5. Wiring buffers into `autoArrangeActiveCity`

In `public/app.js` around lines 5822–5845, the current code computes:

```js
const fixedStart = isArrival
  ? { label: `Transit: ...`, time: timeFromMinutes(startMins + arrivalTransitMins) }
  : null;
const fixedEnd = isDeparture
  ? { label: `Transit: ...`, time: timeFromMinutes(endMins - departureTransitMins) }
  : null;
```

Replace with:

```js
const arrBuf = isArrival
  ? arrivalBufferMins(cityLogistics.arrival.mode, cityLogistics.arrival.international)
  : 0;
const depBuf = isDeparture
  ? departureBufferMins(cityLogistics.departure.mode, cityLogistics.departure.international)
  : 0;

const fixedStart = isArrival
  ? {
      label: `Arrival + ${cityLogistics.arrival.mode} buffer → accommodation`,
      time: timeFromMinutes(startMins + arrivalTransitMins + arrBuf)
    }
  : null;

const fixedEnd = isDeparture
  ? {
      label: `Depart for ${cityLogistics.departure.location}`,
      time: timeFromMinutes(endMins - departureTransitMins - depBuf)
    }
  : null;
```

The existing prompt already interpolates `fixedStart.time` and `fixedEnd.time` into the "FIXED FIRST" / "FIXED LAST" lines. No prompt change needed this phase.

### Distance Matrix fallback

Currently if the Distance Matrix call fails, `arrivalTransitMins` silently becomes 0 (see around line 5822). Replace with a mode-aware fallback:

```js
if (!arrCommute || !Number.isFinite(arrCommute.durationMinutes)) {
  arrivalTransitMins = TRANSIT_FALLBACK_MINS[cityLogistics.arrival.mode] ?? 30;
  diagnostics.push(`Distance Matrix unavailable for arrival — used ${arrivalTransitMins}min fallback`);
} else {
  arrivalTransitMins = arrCommute.durationMinutes;
}
```

Same for departure. Surface `diagnostics` to the user via the existing arrange results toast.

---

## 6. Edge cases

- **User hasn't set transport mode on an old trip:** migration defaulted to `flight` + `international`. Accept the 135-min buffer as a safe default for legacy data; the UI immediately shows the select, so users can correct it before running auto-arrange.
- **Same-day arrival + departure (tight city visit):** both buffers apply. If the resulting effective window is empty (`endMins - depBuf - depTransit ≤ startMins + arrBuf + arrTransit`), show a warning "No schedulable window for this city — consider extending the stay" and abort the arrange call with an empty result rather than letting the LLM attempt it.
- **Non-flight modes with very long transit** (e.g., scenic train 6h): transit from Distance Matrix already models this; buffers are constant. No special case.
- **User flips international → domestic mid-session:** state updates, next auto-arrange run uses the new buffer. No persistent stale computation.

---

## 7. Testing

Add `src/arrangeBuffers.test.js`:
- `arrivalBufferMins('flight', true) === 135`
- `arrivalBufferMins('flight', false) === 70`
- `arrivalBufferMins('train') === 45`
- `arrivalBufferMins('unknown') === 60`
- `departureBufferMins('flight', true) === 180`

Manual QA:
- Create a trip with arrival 18:00, mode=flight international, transit 30min. Expect first schedulable activity ≥ 20:45.
- Flip to train. Expect first schedulable ≥ 19:15.
- Turn off Wi-Fi mid-run to simulate Distance Matrix failure; observe fallback diagnostic and that auto-arrange still completes.

---

## 8. Exit criteria

- [ ] Every existing city has `mode` and `international` fields after one state-save cycle
- [ ] City drawer shows mode selects; intl checkbox toggles visibility based on flight selection
- [ ] Auto-arrange never schedules an activity within `arrivalTransit + arrivalBuffer` minutes of arrival time
- [ ] Distance Matrix failure no longer silently produces zero-length transit
- [ ] `npm test` green
