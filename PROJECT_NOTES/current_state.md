# Current State

_Last updated: 2026-08-12_

## Objective
Two branches are in flight. `claude/yunhai-llm-judge-harness-xgl14a` adds the prompt-regression
harness (built, unit-tested, **uncalibrated**). Ahead of it, the GPT-5.6 planning switch on
`claude/guide-me-setup-stuck-mszkyo` still needs its keyed verification, then deploy behind the
three queued branches (`claude/yunhai-url-endpoints-t6a3ja`,
`claude/budget-optimization-loading-screens-4hc6a3`, `claude/codebase-review-sweep-2z6t4h`).

## Active Workstream
An LLM-as-a-judge harness so a prompt edit to activity generation, auto-arrange or chat can be shown
not to degrade the others. Two layers, decisions [2026-08-12]:

- **Deterministic invariants** (`src/evalChecks.js`, `src/evalChatChecks.js`) — keyless, free, run
  under `npm test`. Five of the six defects the 2026-08-08 blind read found by hand were countable,
  and nothing was counting them; the two lean-prompt lines that fixed them still show up in no
  metric column, so deleting them today is an invisible regression.
- **Blind pairwise judge with position swap** (`scripts/lib/judge.js`) — scoped to what needs
  reading. A criterion wins only when the same content wins from both slots; the same slot winning
  twice is bias and scores a tie.

Runners are `npm run eval:plan` / `eval:chat` over a committed 5-profile corpus in
`evals/scenarios/`. Verdicts land in `data/bakeoff/judge-report.md` and are served by the existing
owner-gated `/debug/bakeoff`. 316/316 tests pass.

Cost, derived from the two measured points in changelog [2026-08-08] (F ≈ $0.195 per call,
m ≈ $0.0034 per activity — calls dominate, not activity count):

| run | scope | calls | LLM |
|---|---|---:|---:|
| `--smoke` | 1 scenario, candidate only | 1 | $0.26 |
| default | 5 scenarios vs cached baselines | 5 | $1.34 + ~$0.32 judge |
| `--refresh-baseline` | both arms fresh, before shipping | 10 | $2.68 + judge |
| `npm test` | invariants over saved lists | 0 | $0 |

Arrange is deliberately out of this pass — its LLM call is an inline closure in the route and needs
extracting first (open_items [2026-08-12]).

## Constraints
- **The harness is uncalibrated.** No control has been run. `JUDGE_LOSS_MARGIN` is a guess (2), not
  a measured noise floor. Do not read a verdict as evidence until open_items [2026-08-12] step 3
  passes — a harness that cannot detect the regression we have proof of is worse than none.
- **Meals may not be planned independently of activities.** A restaurant an hour from any activity
  is not a valid suggestion; it must be near one or on the way between two. Governs Phase 2.
- **Never prompt for something the pipeline then silently drops, overrides or calls an error.** If
  deterministic logic covers it, it does not belong in the prompt at all.
- The model and the prompt travel together: `gpt-5.6` is paired with `SYSTEM_PROMPT_GPT_LEAN`, and
  `SYSTEM_PROMPT` is Claude-shaped and not a drop-in. `SYSTEM_PROMPT` stays byte-identical to its
  pre-bake-off state — it is now also the harness's known-regression control arm.
- `PLAN_SPLIT_DAYS` stays unset — measured and rejected, decisions [2026-08-08].
- Bake-off and eval rows are priced on the model the provider reports serving, not the string
  requested. Sonnet 5's introductory $2/$10 expires **2026-08-31**; the judge prices on
  `servedModel` rather than a hardcoded rate for that reason.
- Places photo-media lookups are billed (~$7/1000); a cache miss costs 2 requests.
- Frontend stays a monolith (`public/app.js`); `innerHTML` through `esc()`, `dataset.*` re-escaped.
  Identity always from `getAuthedUserId(req)`. Deploys via `deployment/promotion.sh` only; run the
  harness from the staging tree.

## Risks
- **The historical bake-off lists are the harness's only ground truth, and they live in `data/`,
  which is gitignored.** If the staging box is rebuilt they are gone and the known-regression
  control loses its reference. Copy two into `evals/fixtures/` at the first opportunity.
- **Three measurements in a row were invalidated by bugs in our own pipeline, not the models.** The
  invariant layer is the direct response, but it inherits the same exposure: a check with a wrong
  threshold produces confident false positives, which is the fastest way to get a harness switched
  off.
- **Nothing on the GPT-5.6 branch has been verified through the UI.** `openaiGenerator()` — the
  function production actually calls — has never run, because both the bake-off and the eval inject
  their own `generate`.
- `distinct%` in the bake-off keys on Places coordinates and penalises dense old-town restaurant
  clustering. `repeatedVenues` in the eval keys on venue names instead and does not have that flaw.
- (Carried over) `GOOGLE_MAPS_API_KEY` rotation + `EMAIL_WEBHOOK_SECRET`/`OWNER_USER_ID` env setup
  still pending; memory-layer / arrange-overhaul / grounding keyed verifications still outstanding.

## Next Actions
1. Calibrate the harness — open_items [2026-08-12]. Steps 1 and 2 are free; step 3 is the one that
   decides whether the harness is worth keeping.
2. Verify the GPT-5.6 switch on a keyed environment (open_items [2026-08-08]).
3. Phase 2: cluster-based meal sourcing, designed in
   `PROJECT_NOTES/plan-deterministic-prompt-split.md`, not started.
4. Deploy behind the three queued branches, then walk the post-deploy checklist in
   open_items [2026-08-07].
