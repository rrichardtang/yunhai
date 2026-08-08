# Plan — take deterministic work out of the plan prompt

_Drafted 2026-08-08, branch `claude/guide-me-setup-stuck-mszkyo`._

## Why

`applyMealPoolCap` deleted every meal GPT-5.6 produced — 12 restaurants for Lijiang, against a
target of 12 — because it screened on `opening_hours` before enrichment ran, while the prompt told
the model to leave unknown hours null and let Google fill them. The report then read "the model
returned no meals", and four commits of prompt tuning chased a symptom.

That bug is one instance of a pattern. The plan prompt asks the model for fields that code
overwrites, and states rules that code already enforces. Every one is wasted output tokens, wasted
attention against the judgement work, and a place where prompt and code can silently disagree.

**Governing principle (owner, 2026-08-08):** if something is covered by deterministic logic it
should not be in the prompt at all. Never require output we then drop or count as an error.

## Phase 1 — strip what code already decides

Applies to all three prompts (`SYSTEM_PROMPT`, `SYSTEM_PROMPT_GPT`, `SYSTEM_PROMPT_GPT_LEAN`) and
to the user prompt built in `planCity`.

| Remove from prompt | Because | Replace with |
|---|---|---|
| `opening_hours` | `placesEnrich.applyDetails` overwrites it from Google; the model's value survives only when Places returns 24/7 | Nothing. Enrichment is the only source. |
| `cost_type` | `normalizeActivity` is `raw.cost_type === 'per_group' ? 'per_group' : 'per_person'` — anything else collapses to `per_person` | Default `per_person`. `planCity` does not generate private transfers. |
| `booking_type` | Fully determined by `type`. The shopping block already states the mapping in prose: *"Set type to shopping and booking_type to none."* | A `BOOKING_TYPE_BY_TYPE` lookup: meal→restaurant, museum/landmark→attraction, tour→tour, neighborhood/shopping/sports→none |
| `city` | We passed it in; `normalizeActivity` already falls back to it | The fallback, which is the only correct answer |
| *"Each venue appears at most once"* | `dedupeByName` runs after enrichment | Nothing |
| *"no 'Lunch at' / 'Dinner at' prefix"* | A regex strips it exactly | Strip in `normalizeActivity` |

Keep `suggested_time` as **intent** (`"dawn"`, `"after dinner"`, `"9:00am"`). Drop the rule that it
must fall inside `opening_hours`: the model cannot check that against hours it no longer emits, and
`arrangeScheduler` assigns the real time against Google's hours anyway. Same move as the arrange
redesign — the model never emits a time, so time violations become structurally impossible.

**Expected effect:** ~800 fewer prompt characters and ~1,300 fewer output tokens per city, and the
class of prompt/code disagreement that ate the meals becomes unrepresentable.

**Risk:** `booking_type` drives the GetYourGuide affiliate link and the booking checklist. The
lookup must reproduce today's distribution — verify against the four saved bake-off activity lists,
which are ground truth for what the model currently emits.

## Phase 2 — source meals from coordinates, not from the model's memory

Enrichment already resolves every non-meal activity to an exact lat/lng. That is enough to pick
restaurants geographically, with no LLM involved in the choosing.

```
LLM plans non-meal activities
  → enrich → real coordinates for each
  → cluster coordinates (agglomerative, ~1.5km threshold; no k to tune)
  → per cluster: places:searchText, locationBias circle on the centroid,
    maxResultCount 20, includedType restaurant
  → rank by rating × log(userRatingCount), take a share proportional to cluster size
  → LLM fills why_it_fits / pitfall / insider_tips for the chosen restaurants
```

**Why this is better than prompting for restaurants, on every axis:**

- **Geography is structural.** A restaurant an hour from everything cannot be selected, because it
  is never a candidate. This is what the current instruction — *"choose options that fit the day's
  geographic area"* — asks the model to do with no coordinates and no day assignment.
- **Fewer Places calls, not more.** Today: one `searchText` per meal, 12 for Lijiang. Proposed:
  ~4 cluster searches returning 20 each. Same endpoint, same auth, same `fetchWithTimeout` helper.
- **Drops the Brave `searchTopRestaurants` query**, freeing quota against the 2000/month tier.
- **Real rating and `userRatingCount`** replace `mealQualityScore`, which currently regex-matches
  `why_it_fits` for the phrase "must-order" as a proxy for quality.
- **Hours, coordinates and price level arrive correct**, so nothing downstream needs to overwrite
  them and the deletion bug cannot recur.

The LLM keeps only what Places has no opinion about: which dishes to order, what the pitfall is,
whether it suits this traveler's stated taste for spicy food and their dietary restrictions.
`/api/activity/add` already uses this exact shape — Places resolve gate, then LLM fill with the
verbatim name — so it is an established pattern here, not a new one.

**Open questions to settle during implementation:**

- Field mask needs `places.rating` and `places.userRatingCount` added. Confirm the SKU tier those
  fields put the request in before shipping — Places bills by field set.
- "On the way between two clusters" is a second search at the midpoint of adjacent centroids. Add
  only if cluster-local coverage proves insufficient; do not build it speculatively.
- Cuisine steering (profile says spicy) can ride in `textQuery` rather than being filtered after.

## Phase 3 — rejected alternatives, recorded so they are not re-proposed

**A parallel meal call.** Planning meals independently of activities produces exactly the
hour-away restaurant. Rejected on the owner's objection, correctly.

**A surplus meal pool for arrange to select from.** `minMeals = 2 * tripDays` is exactly the number
of lunch/dinner slots arrange has, so surplus meals have nowhere to go — they land in `unplaced`
with `no_meal_slot_on_day` and read as failures rather than alternates. Making that work means
teaching arrange to distinguish "could not place" from "did not need", which is a larger change than
Phase 2 needs.

## Verification

- `npm test`, plus a new test asserting no prompt mentions a field the pipeline overwrites, so
  Phase 1 cannot regress silently.
- **Baseline, no API spend:** replay the saved bake-off lists through `schedule()` and compute, per
  placed meal, the commute distance to the nearest same-day activity. Gives a number for today's
  meal geography to prove Phase 2 improves on, and costs nothing since the lists are on disk.
- Re-run `--arms gpt-5.6 --runs 1 --prompt lean` after Phase 1 — the first measurement where the
  pipeline is not fighting the model. Expect meals at target, `distinct%` holding near 90.
- After Phase 2, the same meal-distance measurement against the baseline.

## Corrections owed

`decisions.md` [2026-08-08] cites "GPT-5.6 returned zero meals in both cities" as evidence for
keeping Sonnet 4.6. That is false — the model produced a full set and `applyMealPoolCap` deleted it.
The decision still stands on cost and speed, which are unaffected, but the record needs an appended
correction and the quality comparison needs re-running after Phase 1.

Sonnet 4.6 only looked better on meals because it emitted `opening_hours` — including the five
distinct split-shift patterns flagged as probably invented. The pipeline was rewarding hallucinated
hours and deleting honest nulls.
