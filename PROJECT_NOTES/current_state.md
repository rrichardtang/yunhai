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
- `distinct%` sits at 71% for Sonnet 4.6 (47 distinct venues across 66 activities): Dukezong sold
  six times in one Shangri-La list, Compass Cafe three. That is a real quality ceiling the model
  decision does not address, and it is prompt work, not model work.
- Two rejections rest on analysis, not measurement: Sonnet 5 was never run, and GPT-5.6's cheaper
  tiers were inferred from Sol's result. Both are stated as assumptions in decisions [2026-08-08].
- (Carried over) `GOOGLE_MAPS_API_KEY` rotation + `EMAIL_WEBHOOK_SECRET`/`OWNER_USER_ID` env setup
  still pending; memory-layer / arrange-overhaul / grounding keyed verifications still outstanding.

## Next Actions
1. A/B `--split 2` against unsplit — the last unmeasured lever, ~3x on wall time (225s → ~75s per
   city) and the actual fix for the reported complaint. Costs one run.
2. Decide `PLAN_SPLIT_DAYS` from that run: the speed win against whatever it does to activity mix.
3. Deploy the branch behind the three queued ones, then walk the post-deploy checklist in
   open_items [2026-08-07].
4. Resume the sweep-branch ops follow-ups and the queued keyed verifications.
