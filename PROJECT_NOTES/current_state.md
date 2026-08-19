# Current State

_Last updated: 2026-08-18_

## Objective
Ship branch `claude/guide-me-setup-stuck-mszkyo`. Both open decisions are settled — `planCity` runs
a single `gpt-5.6` call, `PLAN_SPLIT_DAYS` stays unset — so what remains is a keyed verification,
then deploy behind the three queued
branches (`claude/yunhai-url-endpoints-t6a3ja`, `claude/budget-optimization-loading-screens-4hc6a3`,
`claude/codebase-review-sweep-2z6t4h`).

A second, independent branch is now also queued: `claude/auto-open-scheduling-modal-jmbjem` makes the
Arrange step build its own first draft, deletes the Draft button, and reschedules only the cities
whose day range actually moved (decisions [2026-08-17], both entries). It touches the frontend, the
concierge guide, and the client half of the arrange call — no server planning or scheduling logic —
so it does not interact with the GPT-5.6 verification and can deploy in any order relative to it.

That branch also now carries the regenerate-scope work that came out of the Osaka report: the
dialog pre-checks only the cities whose planning inputs actually changed, matched by city `id`, and
Setup refuses to advance with zero cities at all three interactive exits. Five commits, unpushed,
gated behind the push-review hook (below) — reviewer is now `felix-the-fixer`.

## Active Workstream
The branch fixed the reported "stuck" plan, then found three bugs underneath it that each
invalidated the measurement before it. In order: `planCity` read 3 of ~12 profile keys and dropped
the rest, so no arm was ever judged on profile fit; `applyMealPoolCap` deleted every meal that
arrived without opening hours, which the report then displayed as "the model returned no meals";
and `normalizeActivity` stamped a category-default opening window on activities that have no venue,
which `arrangeScheduler` enforced.

Current standing on staging, both Yunnan cities, after Phase 1A/1B and the hours fix:

| run | arm | sec/act | kept/target | distinct% | meals | $/act |
|---|---|---:|---:|---:|---:|---:|
| control | sonnet-4-6 | 6.08 | 66/66 | 71 | 17/22 | $0.0054 |
| 06:20 | gpt-5.6+lean | 9.13 | 22/33 | 90 | 0/22 | $0.0155 |
| **17:53** | **gpt-5.6+lean** | **5.65** | **33/33** | **89** | **22/22** | **$0.0094** |

`kept/target` and `meals` are per-city averages in the raw report; totals shown here.

The second blind read (8 lists, 2 cities x 4 arms) is done and is the only evidence on profile fit.
It clears `gpt-5.6+lean` on every axis and finds Sonnet 4.6 placing 12 `tour` activities against a
structuredTours rating of 1/5, a cross-city day trip to the city the traveler moves to five days
later, and three meal entries pointing at one restaurant. See changelog [2026-08-08].

On that evidence the owner moved production to a single `gpt-5.6` call with
`SYSTEM_PROMPT_GPT_LEAN`, superseding the earlier decision to stay on Sonnet 4.6 — which had rested
on two of our own bugs. Cost per activity rises ~1.7x, the one column Sonnet still wins.

## Constraints
- **Meals may not be planned independently of activities.** A restaurant an hour from any activity
  is not a valid suggestion; it must be near one or on the way between two. Governs Phase 2.
- **Never prompt for something the pipeline then silently drops, overrides or calls an error.** If
  deterministic logic covers it, it does not belong in the prompt at all. This is what the hours fix
  enforced, and what `applyMealPoolCap` violated.
- The model and the prompt travel together: `gpt-5.6` is paired with `SYSTEM_PROMPT_GPT_LEAN`, and
  `SYSTEM_PROMPT` is Claude-shaped and not a drop-in. `SYSTEM_PROMPT` stays byte-identical to its
  pre-bake-off state so the Sonnet control arm remains comparable; it no longer affects users.
- `PLAN_SPLIT_DAYS` stays unset — measured and rejected, decisions [2026-08-08]. ~186 sec/city is
  the floor for a 2-city plan, so the plan step depends on the loader being informative.
- Bake-off rows are priced on the model the provider reports serving, not the string requested.
- Sonnet 5's introductory $2/$10 expires **2026-08-31**; any cost case built on it dies then.
- Places photo-media lookups are billed (~$7/1000); a cache miss costs 2 requests (Text Search +
  `/media`). Live cache hit rate is 25%.
- `PLAN_PHASES_PER_CITY` (client) must equal the progress-emitting events per city on the server.
- Frontend stays a monolith (`public/app.js`); `innerHTML` through `esc()`, `dataset.*` re-escaped.
  Identity always from `getAuthedUserId(req)`. `STEP_SLUGS` duplicated in `src/server.js` and
  `public/app.js`. Deploys via `deployment/promotion.sh` only; run the harness from the staging tree.

## Risks
- **The pre-push review gate is load-bearing and is finding real defects, not style.** Five rounds on
  `claude/auto-open-scheduling-modal-jmbjem` each surfaced a distinct shipping bug: a baseline read
  from state that unrelated code rebuilds, a lookup keyed on city name that collapsed a repeat-visit
  trip, a "whole trip in scope" answer that collapsed to the empty array meaning "nothing changed",
  and a guard applied to one of three exits. Do not treat a clean `npm test` as sufficient for
  frontend state logic — none of these had a failing unit test before the review named them.
- **Browser harnesses can pass for the wrong reason.** Two instances so far: the arrange harness set
  `state.days` directly instead of dispatching the event that rebuilds it (which is how the Osaka bug
  shipped), and a popstate scenario passed against unguarded code because the preceding scenario left
  `_stepTransitionLock` held. Always run a new scenario against the pre-fix code and confirm it fails.
- **Nothing on this branch has been verified through the UI.** The plan stream, image ladder,
  transfer-day timing and per-city failure isolation are unit-tested (273/273) and proven against
  the `/api/plan` route, but no one has watched a real browser session.
- **Three measurements in a row were invalidated by bugs in our own pipeline, not the models.** Each
  looked like a clean model result and read as a quality finding. Treat any single bake-off column
  as provisional until a blind read or a diagnostic confirms the mechanism behind it.
- `distinct%` keys on Places coordinates and penalises the dense-old-town restaurant clustering that
  a good meal list produces, so it partly measures meal density rather than padding.
- Two harness columns are misleading and have each caused a wrong reading. `kept/target` and
  `meals ok` are per-city averages that read as totals. `hours ok%` compares Places against our own
  category default rather than anything the model said, so it scores our fabrication and is now
  structurally near-zero. Fix both when next touching the report.
- (Carried over) `GOOGLE_MAPS_API_KEY` rotation + `EMAIL_WEBHOOK_SECRET`/`OWNER_USER_ID` env setup
  still pending; memory-layer / arrange-overhaul / grounding keyed verifications still outstanding.

## Next Actions
1. Verify the GPT-5.6 switch on a keyed environment (open_items [2026-08-08]). The arm is well
   measured, but `openaiGenerator()` — the function production actually calls — has never run,
   because the bake-off injects its own `generate`.
1b. Watch the first keyed run of the Arrange auto-draft (open_items [2026-08-17]) — the trigger is
   browser-verified, but it now fires an `/api/arrange` call without a click behind it.
2. Phase 2: cluster-based meal sourcing, so restaurants are drawn near or between activity clusters
   rather than planned independently. Designed in `PROJECT_NOTES/plan-deterministic-prompt-split.md`,
   not started.
3. Deploy behind the three queued branches, then walk the post-deploy checklist in
   open_items [2026-08-07].
