# Current State

_Last updated: 2026-08-08_

## Objective
Ship branch `claude/guide-me-setup-stuck-mszkyo`. The model question that gated it is **closed** —
`planCity` stays on `claude-sonnet-4-6` (decisions [2026-08-08]). What remains is one measurement
(`--split 2`), then deploy behind the three queued branches (`claude/yunhai-url-endpoints-t6a3ja`,
`claude/budget-optimization-loading-screens-4hc6a3`, `claude/codebase-review-sweep-2z6t4h`).

## Active Workstream
The branch fixed the reported "stuck" plan, then found and fixed the grounding bug underneath it.
Measured on staging, both Yunnan cities:

| | delivered / target | grounding | sec/act | $/act |
|---|---:|---:|---:|---:|
| Sonnet 4.6 (kept) | 66 / 66 | 100% | 6.08 | $0.0054 |
| GPT-5.6 Sol | 70 / 66 | 100% | 6.24 | $0.0083 |

GPT-5.6 was 3% slower, 54% dearer, and returned **zero meals in both cities** with non-activity
filler. Sonnet 5 was rejected on analysis, not measurement — see the tradeoff note in decisions.

The decisive finding was that the plan step's problem was never the model: before the `venue_name`
lookup fix the same model delivered 30/36 and 22/30 with mis-resolved pins and destroyed opening
hours. Four grounding fixes landed on this branch — Places keyed on `venue_name`, dedupe by name
rather than coordinate, 24/7 Places hours no longer overwriting the model's, and concurrent
lookups for one venue coalesced.

## Constraints
- Do not revisit the model without new evidence. The harness (`scripts/planCityBakeoff.js`) and its
  Brave cassette are checked in; a rerun costs ~$0.20 per arm per city.
- `PLAN_SPLIT_DAYS` stays unset until the A/B reports — splitting changes the activity mix, not
  just the latency.
- Sonnet 5's introductory $2/$10 expires **2026-08-31**; any future cost case built on it dies then.
- Bake-off rows are priced on the model the provider reports serving, not the string requested —
  GPT-5.6 tiers differ 5x on output price. Keep it that way.
- Places photo-media lookups are billed (~$7/1000); `placesCache` amortises them.
- `PLAN_PHASES_PER_CITY` (client) must equal the progress-emitting events per city on the server.
- Frontend stays a monolith (`public/app.js`); `innerHTML` through `esc()`, `dataset.*` re-escaped.
  Identity always from `getAuthedUserId(req)`. `STEP_SLUGS` duplicated in `src/server.js` and
  `public/app.js`. Deploys via `deployment/promotion.sh` only; run the harness from the staging tree.

## Risks
- Nothing on this branch has been verified through the UI — the plan stream, image ladder,
  transfer-day timing and per-city failure isolation are unit-tested and proven against the
  `/api/plan` route, but no one has watched a real browser session.
- **The blind read found a live defect in the kept model's output**: 11 of Sonnet 4.6's 66
  activities (17%) carry a `preferred_time` outside their own `opening_hours`, and
  `arrangeScheduler` honours the hours — so a "Napa Lake Sunrise" at 06:30 gets rescheduled to
  09:00 and the activity's premise is destroyed. Seven of those are `placesEnrich` overwriting the
  model's hours with a gate or box-office window for `neighborhood`/`tour` activities. See
  open_items [2026-08-08]; six ranked fixes, all prompt or enrichment, none a model change.
- `distinct%` is weaker evidence than it looked. It keys on Places coordinates, and the collapse it
  penalises concentrates in dense-old-town restaurants — which GPT-5.6 produced none of, so its 76%
  vs Sonnet's 71% partly measures the meals failure rather than padding. GPT also leaves
  `venue_name` null on 41% of activities (Sonnet 26%), so more of its list is never grounded.
  The prose shows **both** models padding to hit the count, by different mechanisms.
- Two rejections rest on analysis, not measurement: Sonnet 5 was never run, and GPT-5.6's cheaper
  tiers were inferred from Sol's result. Both are stated as assumptions in decisions [2026-08-08].
  One supporting argument in that record — GPT's zero meals — is partly explained by a
  contradiction in our own prompt (open_items [2026-08-08]). The decision still stands on cost and
  speed, which are unambiguous.
- (Carried over) `GOOGLE_MAPS_API_KEY` rotation + `EMAIL_WEBHOOK_SECRET`/`OWNER_USER_ID` env setup
  still pending; memory-layer / arrange-overhaul / grounding keyed verifications still outstanding.

## Next Actions
1. Decide which of the six quality fixes in open_items [2026-08-08] land. The hours-overwrite fix
   and the meals contradiction are the two with user-visible consequences.
2. A/B `--split 2` against unsplit — the last unmeasured lever, ~3x on wall time (225s → ~75s per
   city) and the actual fix for the reported complaint. Costs one run. Worth folding the prompt
   fixes in first so one run measures both.
3. Decide `PLAN_SPLIT_DAYS` from that run: the speed win against whatever it does to activity mix.
4. Deploy the branch behind the three queued ones, then walk the post-deploy checklist in
   open_items [2026-08-07].
5. Resume the sweep-branch ops follow-ups and the queued keyed verifications.
