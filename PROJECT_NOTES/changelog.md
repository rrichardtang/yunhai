# Changelog

Append-only. Factual log of completed work. Entries older than 30 days may be summarized but never fully deleted.

---

## [2026-04-07] Overhaul Auto Arrange logic

- Fixed meal scheduling: meal categories (breakfast, lunch, dinner, nightlife, sunset) now always use category-default opening hours, overriding Claude's generated values — prevents breakfast being placed at 4pm on arrival days
- Auto Arrange now skips opening windows that have already closed by the time a day's available window starts (`openEnd <= dayStart`)
- Fixed `buildCityTravelTiming` (server) to read arrival/departure times from `city.logistics.arrival/departure.customTime` with fallback to legacy `travelEntry`
- Arrival-point → accommodation travel time now computed for all cities (was previously only city index 0)
- Departure location now reads from `city.logistics.departure.{location,latitude,longitude}` with legacy field fallback
- `auto_version_control.md` updated: removed `Claude Code` branch, now always commits/pushes to `main`
- Files: `public/app.js`, `src/server.js`, `.claude/rules/auto_version_control.md`

## [2026-04-07] Fix arrival/departure location autocomplete

- Skip `renderCities()` for `arrivalLocation`/`departureLocation` input events to prevent DOM teardown from destroying the Places widget mid-typing
- Same pattern already used for city name input
- File: `public/app.js`

## [2026-04-07] Add Google Places location inputs for accommodation, arrival, departure

- Replaced accommodation type dropdown (Hotel/Airbnb/None) with a Google Places autocomplete address input
- Added arrival location input with Places autocomplete (e.g. airport)
- Added departure location input with Places autocomplete (e.g. train station)
- Added location/placeId/lat/lng fields to `city.logistics.arrival` and `city.logistics.departure`
- Ensured first accommodation entry auto-created when drawer renders
- Synced accommodation check-in/check-out dates from city-level date range changes
- Files: `public/app.js`, `public/styles.css`

## [2026-04-07] Simplify trip setup date/time UX

- Added start/end date inputs to city main row that auto-populate accommodation check-in/check-out and arrival/departure dates
- Replaced Morning/Afternoon/Evening/Custom dropdown with native `<input type="time">` for arrival and departure
- Fixed `normalizeCityLogistics` to read from `city.logistics` first, preserving state across re-renders
- Files: `public/app.js`, `public/styles.css`

## [2026-04-07] Scaffolded PROJECT_NOTES/

- Created `current_state.md`, `decisions.md`, `open_items.md`, `changelog.md`
