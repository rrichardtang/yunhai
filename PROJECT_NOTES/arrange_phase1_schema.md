# Arrange Rebuild — Phase 1: Activity Schema Migration

**Branch:** `feature/arrange-schema-migration`
**Goal:** Land the new activity schema + a legacy migration without changing any user-visible behavior. Auto-arrange continues to work against the old prompt via an adapter.
**Non-goals:** No arrange prompt changes. No time-assigner. No lock UI. No transport mode UI.

---

## 1. New activity schema (authoritative)

Replace the current flat shape emitted by `normalizeActivity` in `src/claude.js:188` with:

```js
{
  id: "string",                              // unchanged
  name: "string",                            // unchanged
  city: "string",                            // unchanged
  venue_name: "string | null",               // unchanged

  location: {
    name: "string",                          // defaults to venue_name || name
    address: "string",                       // defaults to start_location || ""
    lat: "number | null",
    lng: "number | null"
  },

  category: "sightseeing | food | tour | shopping | relaxation | nature | cultural | landmark",
  tags: ["walking", "museum", "market", "..."],   // freeform strings, deduped
  meal_type: "breakfast | lunch | dinner | cafe | null",

  timing: {
    duration_minutes: "integer",              // ≥ 15
    opening_hours: "string",                  // freeform, e.g. "09:00-17:00"
    preferred_time: "HH:MM | null",           // 24h; null means no preference
    fixed: null | {                           // the time-lock (Phase 3 fills in the UI)
      date: "YYYY-MM-DD",
      time: "HH:MM",
      reason: "string"
    },
    must_happen_on_day: "YYYY-MM-DD | null"   // weaker lock; unused until Phase 5
  },

  experience: {
    intensity: "low | medium | high",         // default "medium"
    is_highlight: "boolean"                   // default false
  },

  booking: {
    type: "tour | attraction | restaurant | none",
    links: ["string"],                        // URLs, possibly empty
    reference: "string | null"                // confirmation code; null for now
  },

  cost: {
    estimated_usd: "number | null",
    type: "per_person | per_group"
  },

  verdict: "Recommend | Recommend with caveats | Skip",
  dedicated_time_block: "boolean",

  why_it_fits: "string",
  pitfall: "string",
  booking_advice: "string",
  smarter_alternative: "string | null"
}
```

### Field-by-field mapping from legacy

| Legacy field | New location |
|---|---|
| `name` | `name` |
| `type` (string) | used only for legacy `meal_type` + `category` inference, then dropped |
| `city` | `city` |
| `venue_name` | `venue_name` |
| `start_location` | `location.address` |
| `end_location` | dropped (was rarely different from start_location) |
| `duration_hours: 2.5` | `timing.duration_minutes: 150` (round to integer) |
| `duration` (display string) | dropped — recompute from `duration_minutes` where needed |
| `suggested_time: "10:00am"` | `timing.preferred_time: "10:00"` — **but** drop the sentinel; see §3 |
| `opening_hours` | `timing.opening_hours` |
| `category` | `category` + possibly `tags` |
| `estimated_cost_usd` | `cost.estimated_usd` |
| `cost_type` | `cost.type` |
| `booking_type` | `booking.type` |
| `booking_links` | `booking.links` |
| `verdict` | `verdict` |
| `dedicated_time_block` | `dedicated_time_block` |
| `why_it_fits` / `pitfall` / `booking_advice` / `smarter_alternative` | same names, top level |

New fields with no legacy source:
- `location.name` ← `venue_name || name`
- `location.lat / lng` ← `null` (will be populated by existing Google Places lookups; lookup code must be updated to write here, see §6)
- `tags` ← `[]`
- `meal_type` ← inferred: if legacy `type ∈ {breakfast, lunch, dinner}` use that; if `type ∈ {food, restaurant}` use `null` (unknown meal, inferred later); else `null`
- `timing.fixed` ← `null`
- `timing.must_happen_on_day` ← `null`
- `experience.intensity` ← `"medium"`
- `experience.is_highlight` ← `false`
- `booking.reference` ← `null`

---

## 2. Category enum normalization

Trim the category enum. Map legacy values:

```
breakfast / lunch / dinner / food / restaurant  →  "food"
tour / show                                     →  "tour"
museum / gallery                                →  "cultural"    + tag "museum" or "gallery"
walk / walking                                  →  "sightseeing" + tag "walking"
park / garden                                   →  "nature"
market / shopping                               →  "shopping"    + tag "market" if legacy was market
spa / relax                                     →  "relaxation"
landmark / viewpoint                            →  "landmark"
cultural                                        →  "cultural"
(anything else)                                 →  "sightseeing"
```

`src/arrangeConfig.js` `CATEGORY_HINTS` remains but is only consulted during inference from raw LLM output when the category field is missing.

---

## 3. Preferred-time sentinel fix

Current code defaults `suggested_time` to `"10:00am"` when the LLM omits it (`claude.js:220`). Downstream code treats `"10:00am"` as "unspecified" (`app.js:5868`). This is a bug — a user who explicitly wants 10 AM loses the hint.

**Fix:** `timing.preferred_time` is `null` when the LLM omits it; `"10:00"` only when explicitly requested. Migration:
- Legacy `suggested_time === "10:00am"` → `preferred_time = null` (cannot distinguish sentinel from intent for legacy data; null is the safe default)
- Any other legacy value → parse to 24h `"HH:MM"`; if parse fails, null

---

## 4. File changes

### 4.1 `src/claude.js`

Rewrite `normalizeActivity` (line 188) to emit the new shape. Add a `normalizeLegacyActivity(raw)` helper called when input looks legacy (detect via presence of `duration_hours` and absence of `timing`). Export both.

Add `src/activityMigration.js` (new file) with:
- `isLegacyActivity(obj)` — returns true if `obj.timing === undefined`
- `migrateActivity(legacy)` — returns new shape, applying all mappings from §1 and §3
- `parseTimeString(raw)` — handles `"10:00am"`, `"10am"`, `"10:00"`, `"14:30"`, returns `"HH:MM"` or null
- `parseDurationToMinutes(hours)` — `Math.max(15, Math.round(hours * 60))`
- `inferMealType(raw)` — returns breakfast/lunch/dinner/cafe/null based on legacy `type` and name keywords

### 4.2 `src/itineraryStore.js`

On load (wherever `readItineraries()` is, grep for `readFile`/`JSON.parse` in the store), iterate every itinerary's activities. For each activity, if `isLegacyActivity(a)`, replace with `migrateActivity(a)`. Do **not** write back to disk on read — migration is in-memory only. Write-back happens naturally the next time the user saves.

Add a top-level `_schemaVersion: 2` on each itinerary after save. On load, if `_schemaVersion < 2`, run migration.

### 4.3 `src/server.js` — `/api/arrange` adapter

The current prompt builds lines like:
```
- id:abc | "Name" | museum | 2.5h | hours:10:00-18:00 | preferred:14:00 | at:Rue X | cost:$35/person
```
This reads `category`, `duration_hours`, `opening_hours`, `suggested_time`, `start_location`, `estimated_cost_usd`, `cost_type` directly.

Add an adapter right before prompt assembly (lines 1054–1089):

```js
function activityForPrompt(a) {
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    durationHours: a.timing.duration_minutes / 60,
    opening_hours: a.timing.opening_hours,
    preferred_time: a.timing.preferred_time,         // null-safe
    location: a.location.address,
    estimated_cost_usd: a.cost.estimated_usd,
    cost_type: a.cost.type
  };
}
```

Update the existing `activitiesText` template literal to read from the adapter output. Do **not** change the prompt rules or JSON output contract in this phase.

### 4.4 `public/app.js`

Update read sites. Grep for each of these and rewrite:
- `a.duration_hours` → `(a.timing?.duration_minutes ?? 60) / 60`
- `a.suggested_time` → `a.timing?.preferred_time`
- `a.start_location` / `a.end_location` → `a.location?.address`
- `a.estimated_cost_usd` → `a.cost?.estimated_usd`
- `a.cost_type` → `a.cost?.type`
- `a.booking_type` → `a.booking?.type`
- `a.booking_links` → `a.booking?.links`
- `a.opening_hours` → `a.timing?.opening_hours`

Use optional chaining throughout so half-migrated localStorage state doesn't crash the UI.

Add a client-side migration pass in the state hydration path (grep for `loadStateFromStorage` / `JSON.parse(localStorage...)`): before using any activity, run it through a client-mirror `migrateActivity()`. The cleanest path: duplicate `activityMigration.js` logic into `public/js/activityMigration.js` (plain JS, no imports) and include it via `<script>` in `index.html` before `app.js`.

### 4.5 Blank-activity factory

Find every place a new activity literal is created (grep `venue_name:` and `duration_hours:`). Replace with a single `blankActivity()` helper in both `src/claude.js` and `public/app.js` that returns the new shape with all defaults set. Centralize to prevent drift.

---

## 5. Google Places/lat-lng wiring

Currently Google Place lookups populate a parallel map keyed by activity id. Update the lookup callback to also set `activity.location.lat` and `.lng` on the activity itself so the Phase 4 commute matrix can read them directly. Grep for `placeId` writes in `app.js` and add the location mutation alongside.

If a lookup fails, leave `lat/lng` as `null`. Never throw.

---

## 6. Testing

Add `src/activityMigration.test.js` using `node:test`:
- Legacy activity with `duration_hours: 2.5` → `timing.duration_minutes: 150`
- Legacy activity with `suggested_time: "10:00am"` → `preferred_time: null`
- Legacy activity with `suggested_time: "2:30pm"` → `preferred_time: "14:30"`
- Legacy activity with `type: "lunch"` → `category: "food"`, `meal_type: "lunch"`
- Legacy activity with `type: "museum"` → `category: "cultural"`, `tags: ["museum"]`
- Idempotency: `migrateActivity(migrateActivity(x)) === migrateActivity(x)` deep equal

Add a smoke test in `src/server.test.js` (or new file): POST `/api/arrange` with a mix of new-shape and legacy-shape activities, assert 200 + valid JSON response.

---

## 7. Exit criteria

- [ ] `npm test` green
- [ ] Loading an existing itinerary from `data/itineraries.json` displays identically in the UI
- [ ] Creating a new trip end-to-end (Cities → Activities → Arrange → Review) works without errors in the console
- [ ] Auto-arrange produces the same placements it did before for a known fixture trip (tolerate ±20min since preferred-time sentinel removal may shift hints)
- [ ] A saved itinerary has `_schemaVersion: 2` and new-shape activities on disk after one save cycle

---

## 8. Rollback plan

If a user reports breakage, revert the branch. No disk writes in the new shape have happened until the user explicitly saves an itinerary post-deploy, so the old code will still read legacy data fine. Any itineraries saved under v2 are a strict superset of v1 fields needed by old code, but the old code reads different paths — so users whose itineraries saved under v2 would need their data rolled back manually. Mitigation: keep the feature branch on staging for 48h before prod.
