# Decisions

Append-only. Records permanent architectural and design decisions.

---

## [2026-04-07] Replace time-of-day presets with direct time picker

**Decision:** Removed the Morning/Afternoon/Evening/Custom dropdown for arrival and departure times, replaced with a single `<input type="time">`.
**Reasoning:** User found the dropdown unintuitive. A time picker is consistent with how dates are selected and gives precise control.
**Alternatives rejected:** Keeping the dropdown with better labels — rejected because the user explicitly wanted a time input consistent with the date picker.
**Tradeoffs:** Users no longer get preset shortcuts (Morning = 09:00, etc.) — they must always pick an exact time. Defaults to 09:00 arrival and 18:00 departure.

## [2026-04-07] Enforce category opening hours for meal types in Auto Arrange

**Decision:** Meal categories (breakfast, lunch, dinner, nightlife, sunset) always use hardcoded category default opening hours in `normalizeActivityMetadata`, ignoring Claude's generated `opening_hours`.
**Reasoning:** Claude frequently generates wide opening windows for restaurants (e.g. `08:00-22:00`) that defeat the scheduling logic. Meal service windows are predictable and don't vary meaningfully by venue.
**Alternatives rejected:** Trusting Claude's output and adding smarter fallback logic — rejected because the root cause is upstream data quality, not the scheduler.
**Tradeoffs:** A breakfast spot that genuinely serves until midnight would be constrained to `07:30-10:30`. Acceptable given the scheduling correctness benefit.

## [2026-04-07] Add date range to city main row with auto-population

**Decision:** Start/end dates are now set at the city row level and auto-populate accommodation check-in/check-out, arrival date, and departure date.
**Reasoning:** User wanted a single source of truth for dates rather than filling in the same dates across three sections.
**Alternatives rejected:** Keeping dates only in the expandable drawer — rejected because it required too many clicks and redundant input.
**Tradeoffs:** Accommodation dates are now tied to arrival/departure by default. Users can still override them in the drawer, but the initial values are driven by the city-level date range.
