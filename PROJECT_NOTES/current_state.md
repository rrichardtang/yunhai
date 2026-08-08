# Current State

_Last updated: 2026-08-08_

## Objective
Decide the model for the plan step (`planCity`) on measured cost, speed and quality — `claude-sonnet-4-6`
(current) vs `claude-sonnet-5` (medium/high) vs `gpt-5.6`. Everything else on branch
`claude/guide-me-setup-stuck-mszkyo` exists to make that decision trustworthy: the Setup → Review
fixes are done, the bake-off harness is built, and the remaining work is getting its quality
metrics to measure the model instead of a grounding bug. Three earlier branches remain complete
but undeployed (`claude/yunhai-url-endpoints-t6a3ja`, `claude/budget-optimization-loading-screens-4hc6a3`,
`claude/codebase-review-sweep-2z6t4h`).

## Active Workstream
Baseline economics are measured and are the frame for the decision: time and cost are both linear
in activity count (**6.26 / 6.07 sec per activity**, **$0.00542 / $0.00537 per activity** across two
very different cities, within 3%, negative intercept — no fixed overhead). **$0.35 per 2-city trip**,
of which 85–90% is output tokens. The LLM call is 174s of a 176s city; Brave is ~1s and 36 parallel
Places lookups 0.6s.

Consequence: **splitting one call into parallel day-windows is a ~3x speed lever (225s → ~75s) where
a faster model is ~30%.** Speed is the cheap axis, available to every arm, so the bake-off decides on
quality and cost. `PLAN_SPLIT_DAYS` implements the split and is off by default pending its own A/B.

Just landed: Places lookups now key on `venue_name` rather than the activity label. This was
corrupting the exact columns the decision rests on — wrong pins collapsed distinct activities and
locality centroids overwrote the model's opening hours. `noPlace` became `ghost`, counting only
venues the model named and Google has never heard of.

## Constraints
- `planCity` stays on `claude-sonnet-4-6` until the bake-off reports. Do not migrate on spec
  comparison — GPT-5.6's output ceiling, pricing and JSON-schema support are all unconfirmed, and
  Sonnet 5's adaptive thinking shares the `max_tokens` budget with its response (benchmarking it at
  production's 32768 would measure truncation, not the model). The harness uses 64000.
- Arms must see identical inputs: the Brave cassette records once per city *before* windowing, so a
  split run reuses the same entries and every arm answers the same prompt. Places stays live.
- Do not compare arms while delivered counts run short of target — `kept/target`, `distinct%` and
  `meal res%` are the deciding columns.
- Run the harness from the staging tree only (`projects/travelplanner-staging`);
  `projects/travelplanner` is prod.
- Places photo-media lookups are billed (~$7/1000). `placesCache` amortises them; watch the line item.
- `PLAN_PHASES_PER_CITY` (client) must equal the progress-emitting events per city on the server.
- Frontend stays a monolith (`public/app.js`); `innerHTML` goes through `esc()`, `dataset.*` reads
  are re-escaped. Identity always from `getAuthedUserId(req)`. `STEP_SLUGS` is duplicated in
  `src/server.js` and `public/app.js`. Deploys via `deployment/promotion.sh` only.

## Risks
- `dedupeByVenue` is unproven and currently suspect: most collisions it fired on were artifacts of
  the label-lookup bug, and it dropped delivered counts to 30/36 and 22/30. The next baseline run
  decides whether it stays, shrinks, or goes.
- For meals `normalizeActivity` synthesises `venue_name` as `"<name>, <city>"`, so the Places query
  now carries the city twice. `distanceMatrix` has done this for meals all along without harm, but
  `meal res%` on the next run is the check.
- The bake-off has never run a non-Anthropic arm. GPT-5.6's max output tokens (a 36-activity array
  is ~12k) and JSON-schema support are unverified and either can disqualify it outright; without a
  confirmed price `$/city` prints `—`, though raw token counts are stored so cost is recomputable.
- Switching families means re-tuning `SYSTEM_PROMPT`'s decision framework from scratch, and
  `filterInvalidTypes` / `applyMealPoolCap` are coupled to its output contract. The app is already
  dual-provider, so moving plan to OpenAI consolidates nothing.
- (Carried over) `GOOGLE_MAPS_API_KEY` rotation + `EMAIL_WEBHOOK_SECRET`/`OWNER_USER_ID` env setup
  still pending; memory-layer / arrange-overhaul / grounding keyed verifications still outstanding.

## Next Actions
1. Re-run the unsplit baseline on staging with the `venue_name` fix (4 generations, ~13 min, ~$0.70).
   Expect false dedupes to largely vanish, counts back near 30/36 and 26–30/30, `00:00-23:59` in the
   `places-hours-delta` lines to disappear, and `ghost` roughly flat.
2. Decide `dedupeByVenue`'s fate from that run, not from argument.
3. A/B `--split 2` against unsplit — the ~3x speed lever, and the one experiment that changes the
   shape of the answer.
4. `--arms gpt-5.6 --runs 1` to prove the arm works and settle max-output-tokens empirically.
5. Full 4-arm matrix (~24 generations, 30–60 min), decided on `distinct%` / `ghost` / `meal res%`
   first, then `sec/act` and `$/act`. Read the per-arm activity lists blind before trusting the table.
6. Write the migration plan from the numbers; deploy the branch behind the three queued ones.
