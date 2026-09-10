# Changelog

Append-only. Factual log of completed work. Entries older than 30 days may be summarized but never fully deleted.

---

## [2026-09-08] Skills moved off the repo to the claude.ai account; design skills gated
- `.claude/skills/`: all 20 project-local skills removed — the 12 design skills and `ponytail` go
  to the claude.ai account, the 7 duplicates of `claude-config` skills were byte-identical copies
  frozen at `e05d306` and would have drifted from their source.
- All 12 design skills gained `disable-model-invocation: true` in frontmatter: ~1,500 tokens per
  turn of system-prompt listing → 0, invoked on demand as `/design-taste-frontend` and friends.
- `.gitignore`: `!.claude/skills/` removed, reverting changelog [2026-08-19].
- `CLAUDE.md` startup step 5: dropped the `.claude/skills/ponytail/` path, which no longer exists.
- `rrichardtang/claude-config` (branch `claude/self-refreshing-sync`): `install.sh` now registers
  itself as a user-level `SessionStart` hook via new `hooks/session-start.sh`, so the sync
  re-runs in every local session in every project instead of only in repos carrying their own
  bootstrap. Three `felix-the-fixer` findings fixed: `-s` not `-f` when seeding `settings.json`
  (a zero-byte file silently registered no hook at all), a graceful skip when `jq` is absent
  (default macOS, previously killed the hook every session after the sync had succeeded), and a
  temp-inode write for `session-start.sh` (install.sh is invoked by it, and bash reads a running
  script by byte offset).


## [2026-09-08] Skills merged to `main`; `ponytail` pinned on at session startup
- Fast-forwarded `main` to `e05d306` (`79208e0..e05d306`), so all 14 skills are available to every
  future session in this repo rather than only on the feature branch.
- `CLAUDE.md` **Session Startup**: new step 5 invokes `ponytail` and keeps it active for the
  session; old step 5 renumbered to 6. Merging alone only makes a skill auto-*triggerable* — the
  model still decides whether the description matches — so the pin is what makes it deterministic.
- Design skills left un-gated and model-invocable by owner decision; `full-output-enforcement`
  gating still undecided (open_items [2026-09-08]).

## [2026-09-08] Installed `ponytail` + the 13 `taste-skill` skills, project-local
- `.claude/skills/ponytail/SKILL.md`: from `github.com/dietrichgebert/ponytail` via
  `npx skills use`, which only prints SKILL.md into context (nothing written to disk), so the file
  was transcribed verbatim to make it survive the session.
- `.claude/skills/{brandkit,design-taste-frontend,design-taste-frontend-v1,full-output-enforcement,
  gpt-taste,high-end-visual-design,image-to-code,imagegen-frontend-mobile,imagegen-frontend-web,
  industrial-brutalist-ui,minimalist-ui,redesign-existing-projects,stitch-design-taste}/`: from
  `github.com/Leonxlnx/taste-skill` via `npx skills add` (13 skills, 14 files).
- `npx skills add` installed to `.agents/skills/` with symlinks from `.claude/skills/` — but
  `.agents` is gitignored (`.gitignore:10`), so every symlink would dangle in a fresh clone. The
  symlinks were replaced with real directories under `.claude/skills/` and `.agents` +
  `skills-lock.json` removed, matching the layout decisions [2026-08-19] already established.
- All 14 files read before committing: design/output directives only, no instruction-hijacking or
  network/exfiltration behavior.

## [2026-08-19] Project-local copy of the 7 new skills, so they show up in the `/` menu
- `.claude/skills/{thermo-nuclear-code-quality-review,wayfinder,grill-with-docs,grilling,
  domain-modeling,research,prototype}/`: committed verbatim, copied from the versions just pushed
  to `rrichardtang/claude-config`. Confirmed not gitignored (`git check-ignore` returns nothing).
- `.gitignore`: added `!.claude/skills/` alongside the existing `.claude/*` exceptions.
- Reason: a cloud session's `/` autocomplete doesn't read `~/.claude/skills/` (the global sync
  target) at all — only account-enabled skills and skills committed to the repo's own
  `.claude/skills/` (decisions [2026-08-19]).

## [2026-08-19] Push-gate reviewer retargeted from pre-push-reviewer to felix-the-fixer
- `.claude/agents/pre-push-reviewer.md`: deleted — redundant with `felix-the-fixer`, now synced
  every session (previous entry below). Same tools (no `Edit`/`Write`), same job.
- `scripts/prePushReview.js`: header comment and blocked-push message now name `felix-the-fixer`.
  No change to the gate mechanism itself (still a HEAD-keyed receipt in
  `.claude/pre-push-review.json`) — the script never invoked the agent programmatically, only
  referenced its name in output.
- `CLAUDE.md`: Engineering Practices section updated to name `felix-the-fixer` and note it is
  synced from `claude-config`, not a project-local agent.
- `PROJECT_NOTES/current_state.md`: one stale mechanism reference corrected. Historical
  attributions in `changelog.md`/`open_items.md` naming `pre-push-reviewer` on specific past
  commits are left as written (decisions [2026-08-19]).

## [2026-08-19] SessionStart hook syncs bob-the-builder/felix-the-fixer from claude-config
- `.claude/hooks/session-start.sh` (new): clones/pulls `rrichardtang/claude-config` to
  `~/.cache/claude-config` and runs its `install.sh`, syncing `bob-the-builder`,
  `felix-the-fixer`, and the `caveman` skill into `~/.claude/`. Validated both the fresh-clone and
  pull-and-reinstall paths; confirmed `~/.claude/agents/*.md`, `~/.claude/skills/caveman/`, and the
  managed block in `~/.claude/CLAUDE.md` land correctly.
- `.claude/settings.json`: registered the hook under a new `SessionStart` block, alongside the
  existing `PreToolUse`/`PostToolUse` hooks.
- `.claude/agent-notes/README.md` (new): documents the `bob.md`/`felix.md` per-repo notes
  convention (decisions [2026-08-19]); the files themselves are created on first noteworthy entry
  by each agent.

## [2026-08-18] Snapshot restore respects the zero-city guard
Seventh `pre-push-reviewer` pass returned no blocking findings and confirmed the four-exit
enumeration complete — it independently verified that no `.panel`/`.step-panel` class is toggled
outside `setStep`, that the boot path clamps to `maxStep` (never rehydrated, so a direct visit to
`/plan/review` resolves to step 1), and that cities can only be emptied from step 1.

Two of its non-blocking notes were acted on:

- `public/app.js`: `hydrateFromSnapshot` now clamps to step 1 when the restored snapshot has no
  cities. The review questioned the `|| 3` default on a missing `currentStep` and could not confirm
  that state was reachable; the reachable case is adjacent and needs no legacy data — `saveSnapshot`
  writes `currentStep: state.step` on every save, so a pre-fix user who deleted every city and
  landed on Review has a snapshot with `currentStep >= 2` and `cities: []`, and "Resume draft"
  restored it straight past Setup. The `|| 3` default is left alone: it only fires for snapshots
  that predate the field, and lowering it would move a legitimate legacy resume off Arrange.
- The Trip Health popover now closes on a blocked click. Leaving it open behind the error banner
  read as if the click did nothing.
- Harness: `resumeDraftWithNoCities` scenario added (10 → 11), confirmed failing before the clamp.

## [2026-08-18] Fourth exit from Setup: the Trip Health badge
Sixth `pre-push-reviewer` pass, on the commit below. It found a fourth interactive entrance the
previous round's enumeration missed.

- `public/app.js`: `openTripHealthReviewBtn`'s click handler calls `setStep(4)` from the topbar,
  which sits outside the step panels and so is clickable from Setup. Its badge gates on
  `state.currentItineraryId || state.activities.length` (`renderTripHealthBadge`) — removing a city
  clears neither, so the badge stays visible and live after the last city is gone. `canLeaveSetup()`
  now guards it too; all four interactive exits are enumerated in the helper's comment.
- Harness: `tripHealthBadgeToStep4` scenario added (9 → 10), confirmed failing against the
  three-entrance version.
- Reviewer's second finding accepted as-is, not fixed: a blocked `popstate` leaves the address bar
  showing the step the user tried to reach. It self-heals — nothing compares `state.step` to
  `history.state`, `maxStep` is never persisted so a reload lands on step 1 and `replaceState`
  rewrites the URL, and the next pushed navigation truncates the forward entries. Re-pushing on
  every blocked Back would trap the user in the app, which is worse than a stale URL.
- Reviewer's read-only-share concern checked and found unreachable: it depends on a persisted
  itinerary whose `cities` is not an array, but the server write path normalizes
  `cities: itinerary.cities || []` on every save, so the field is always an array.

## [2026-08-18] All three interactive exits from Setup enforce the zero-city guard
Fifth `pre-push-reviewer` pass. It found the Next-button guard closed only one of the entrances:
`state.maxStep` is monotonic (raised in `setStep`, reset only by `resetToFresh`/`initEmbedMode`) and
is never lowered when cities are removed, so the step chips still reached Review. Tracing the rest
of the transitions found a third entrance the review did not mention: the `popstate` handler, i.e.
browser back/forward.

- `public/app.js`: guard extracted as `canLeaveSetup()` next to `setStep`, and applied at all three
  interactive exits — `goToNextStep(fromStep === 1)`, the step-chip click handler, and `popstate`.
  Not applied inside `setStep` itself: programmatic `setStep(4)` serves the read-only share and
  embed views, which must keep working.
- Harness: `chipToReview` and `browserForwardToReview` scenarios added (7 → 9). Both confirmed
  failing against the guard-less code.
- Harness bug fixed while confirming that: `browserForwardToReview` initially passed pre-fix because
  the preceding scenario's `setStep` leaves `_stepTransitionLock` held until the next frame, which
  swallowed the popstate transition. `navigateFromSetup` now waits a frame first. Isolated, the
  scenario failed pre-fix as expected — the in-suite pass was for the wrong reason.
- Checked and rejected the review's other finding: it argued a stored zero-city itinerary (which the
  pre-fix bug could persist — the server stores `cities: itinerary.cities || []` with no floor) would
  be stranded, since `hydrateLoadedItinerary` never raises `maxStep`, and that recovery "discards the
  loaded activities". Measured instead: the user is blocked with the banner, and adding a city then
  declining regeneration lands on Review with every activity and approval intact and no plan call.
  No data loss and no dead end, so the guard was left unscoped.

## [2026-08-18] Continue no longer advances from Setup with zero cities
Fourth `pre-push-reviewer` pass, on the fix below. It found the fix incomplete: naming the removed
cities makes the dialog *open*, but `showRegenerateConfirmDialog` builds its checkboxes from
`state.cities`, which is empty once every city is gone. The modal rendered with no rows, and Cancel,
backdrop-click and Next-with-nothing-checked all resolve `null`, which `goToNextStep` reads as
"user declined" → `setStep(2)` with activities for cities that no longer exist. Same end state as
before, behind an unactionable dialog.

- `public/app.js`: `goToNextStep(fromStep === 1)` returns early with "Add at least one city to
  continue." when `state.cities` is empty. There is nothing to plan and nothing to review, so the
  step should not advance at all — this closes the empty-modal path and the fresh-trip-with-no-cities
  path in one guard, ahead of any change detection.
- Harness: `removeOneCity` and `removeAllCities` scenarios added (5 → 7). `removeAllCities` confirmed
  failing without the guard (`dialog=true checked=[]`) before the guard was kept.

## [2026-08-18] Whole-trip regeneration scope no longer collapses to "nothing changed"
Third `pre-push-reviewer` pass on `c207e6a`; one correctness finding, fixed and pinned.

- `shared/cityChanges.js`: the "regenerate everything" branches returned the *current* city names,
  which is `[]` when the change was removing cities. Nothing stops the user removing the last city
  (`public/app.js` `[data-remove-city]` has no floor), and an empty result is the caller's
  "nothing changed" signal — `goToNextStep` took the fast path to Review with activities for cities
  that no longer existed, no dialog. Whole-trip scope is now the union of the planned and current
  names, so a removal always reports non-empty and names the city that went. Extra names are inert
  downstream: `renderPhase1` builds checkboxes from `state.cities`.
- `public/app.js`: dropped the `try/catch` around `JSON.parse(state.lastPlannedFingerprint)` —
  the value is assigned only from `step1Fingerprint()` at three sites and never round-trips through
  storage or the server, so the parse cannot throw (CLAUDE.md, no defensive boilerplate). The
  round-trip itself is kept and commented: `step1Snapshot()` returns live references into
  `state.cities`, so the stringify at plan time is what freezes the snapshot.
- `src/cityChanges.test.js`: 3 removal/scope cases added (suite 290 → 292), each confirmed to fail
  against the pre-fix implementation before being kept.

## [2026-08-17] Regenerate only the cities the user actually changed
  - Two regressions the reviewer caught before push, both reproduced and then fixed: keying the
    lookup on city **name** collapsed a repeat-visit trip (Tokyo → Kyoto → Tokyo), so the first leg
    never matched and reported as changed on every Continue with **zero edits** — bypassing the
    skip-to-Review shortcut and pre-checking both legs for deletion. And **deleting** a city
    produced no entry at all, so the trip went straight to Review with no prompt, leaving the
    removed city's activities orphaned and unmentioned; the old coarse boolean at least opened the
    dialog. Matching is now by city `id`, with a removed city putting the whole trip in scope.
  - Also applied: `step1Fingerprint` split into `step1Snapshot()` + a stringify wrapper, so the
    trip-level values are read without serialising every city twice; dead `= null` defaults and the
    now-unreachable `!prevSelected ||` arm dropped from the dialog.
  - Corrected two overclaims the reviewer flagged in these notes: the harness described below is a
    scratch tool, not a repo artifact, and "a field added to the payload is automatically a trigger"
    holds only for per-city fields (`profile` is in the request but not the fingerprint).


The regenerate dialog pre-checked every city, so adding one city and clicking through deleted the
activities and placements for cities the user never touched — the trap behind the Osaka report
(decisions [2026-08-17] "changed set from the existing fingerprint").

- `public/app.js`: `cityPlanningInputs(city)` extracted from `planTrip`'s payload destructure and
  reused by it, so the request payload and the change detector are one definition. `id`,
  `detailsExpanded` and any future UI flag are excluded by construction.
- `citiesChangedSincePlan()` derives the changed set from `state.lastPlannedFingerprint`, which
  already contains the previous city list — no new persisted state. Trip-level changes (budget,
  travelers, children, travels) return every city, since those feed every city's plan.
- `goToNextStep` decides from that set: empty means nothing planning-relevant changed and it goes
  straight to Review; otherwise the dialog opens with exactly those cities pre-checked.
- Fixed two pre-existing defects found while building the verification for this:
  `detailsExpanded` is pure UI state living on the city object, so expanding a city card marked the
  trip changed and offered to delete every activity; and `normalizeCoordinate(null)` returned **0**
  because `Number(null)` is 0, so an unset coordinate became a real location off West Africa, passed
  every `Number.isFinite()` gate meant to catch "not resolved yet", and made normalization
  non-idempotent (null on the first pass, 0 on the second) — which is what made a bare re-render
  look like a user edit.
- The comparison logic lives in `shared/cityChanges.js` (`cityPlanningInputs`, `changedCityNames`)
  so it is testable in the repo's own suite rather than only through a browser: `src/cityChanges.test.js`,
  10 cases. Browser-level checks ran through a throwaway Playwright harness driving the real
  `goToNextStep(1)` and reading actual checkbox state, proven against the unfixed code first (3
  failures) — that harness is scratch, not a repo artifact, and is not what guards this going
  forward; the unit tests are.

## [2026-08-17] Fix: auto-arrange never fired — the baseline was clobbered before it was read

Reported from real use: adding Osaka to an existing Japan trip and moving to Arrange fired nothing,
and the Osaka tab was empty. The defect was not Osaka-specific — auto-arrange had **never** fired in
real use, including on fresh trips (decisions [2026-08-17] "recorded, not inferred").

- Cause: `citiesNeedingArrange` took its baseline from `state.days`, on the assumption that
  `state.days` is only rebuilt at the Review→Arrange transition. `public/app.js` has a `change`
  listener on `#activitiesGrid` that rebuilds it on **every activity approval**, and approving is
  mandatory before the transition is allowed, so the baseline always equalled the value it was about
  to be compared against. The dirty set was therefore always empty.
- Fix: `state.arrangedSignatures` — a per-city record written *only* by `autoArrangeActiveCity`
  (both the normal path and the all-locked early return), holding `cityDayKey` at the moment that
  city was arranged. `citiesNeedingArrange()` reads that record instead of an inferred baseline, so
  unrelated `expandDays` recomputation cannot forge it.
- A city with no record but existing placements adopts the current signature and is left alone —
  this covers trips arranged before the field existed and cities arranged by hand, neither of which
  should be rebuilt. No record and nothing scheduled means genuinely new, which is the Osaka case.
- Persisted alongside `placements` in all three write paths and both hydration paths, and cleared
  wherever placements are cleared. `src/itineraryStore.js` spreads `...payload`, so no server change.
- Two follow-up defects found by the `pre-push-reviewer` subagent on its first real run, both fixed
  before push: (1) `cityIsScheduled` tested `dayId` for truthiness rather than membership in
  `state.days`, so a city holding placements for dates the trip no longer covers adopted a signature
  and was marked clean permanently, with its activities rendering in no day column and no unplaced
  list — the exact "still truthy, no longer valid" shape the reviewer's own rubric names; (2) the
  signature reset landed only in `planTrip`'s full re-plan branch, so partial regeneration deleted a
  city's placements while its signature survived, marking a regenerated city clean while it held
  nothing. Also applied its two behavior-preserving cleanups: reuse `activeDays` rather than
  re-walking `state.days`, and lift the adoption write out of a `.filter()` predicate.
- Harness now 11 scenarios, including one per finding above.
- Harness rebuilt: it now dispatches the real `#activitiesGrid` change event and drives the real
  `goToNextStep(2)` instead of hand-building state and calling the helper directly. Run against the
  pre-fix code it reports 5 failures — every arranging scenario returns `[]` — which is the proof
  the previous harness never had. 8/8 pass after the fix; 280/280 unit tests; no page errors.

## [2026-08-17] Pre-push review subagent and the hook that makes it run

Code reaching a branch had only ever been reviewed by the model that wrote it (decisions
[2026-08-17] "pre-push review gate").

- `.claude/agents/pre-push-reviewer.md`: new project subagent. Establishes its own review range
  (`@{u}..HEAD`, falling back to `main..HEAD`), ranks correctness findings above behavior-preserving
  simplifications, and requires a concrete failure scenario per finding. Granted `Read, Grep, Glob,
  Bash` and deliberately **not** `Edit`/`Write`, so "flag, don't fix" is structural.
- `scripts/prePushReview.js`: PreToolUse hook on Bash. Blocks `git push` unless
  `.claude/pre-push-review.json` records the current HEAD sha; `--record` writes that receipt.
  Keying on HEAD means a new commit re-opens the gate. Follows `checkPractices.js` — stdin payload,
  exit 2 with a stderr message, pure functions exported for tests.
- `.claude/settings.json`: `PreToolUse` block added alongside the existing `PostToolUse` one.
- `.gitignore`: `!.claude/agents/` added. Without it `.claude/*` left the subagent untracked, so it
  would have vanished with the container and never reached anyone else.
- `src/prePushReview.test.js`: 7 tests, which caught two real defects during development.
  `git -C /repo push` slipped past the original regex because `-C` takes a separate value argument —
  replaced by a token scan that resolves the first non-flag token after `git`. Then dogfooding the
  live hook produced a false positive: splitting on `&&` cut through a *quoted* string containing
  "&& git push", blocking a command that never pushed. Quoted spans are now stripped before
  splitting, which is the same "must not cry wolf" constraint `checkPractices.js` is built around.
- `CLAUDE.md`: Engineering Practices now documents both hooks and the `--record` escape hatch.
- 280/280 tests pass. The hook was verified live — it blocked an actual `git push` of this very
  change — plus pipe-tests across push/non-push/compound/quoted-mention payloads, a 14-case
  adversarial sweep of the detector, and `jq -e` against both hook blocks in the merged settings.
- Known limits, accepted: the subagent registry and hook config load at session start, so both take
  effect in the *next* session; `bash -c "git push"` is not detected; and the check reads the
  project's HEAD, so a push aimed at another repo via `cd` is judged against the wrong sha.

---

## [2026-08-17] Arrange reschedules only the cities whose day range actually moved

Replaces the placements-based gate shipped earlier the same day (decisions [2026-08-17] "dirty-city
arrange"). Entering Arrange now re-arranges exactly the set of cities whose day-id set differs from
the one the current placements were built against.

- `public/app.js`: `cityHasSchedule()` / `maybeAutoArrangeCity()` replaced by `cityDayKey()`,
  `citiesNeedingArrange()`, `autoArrangeCities()` and `maybeAutoArrangeCities(previousDays)`.
  `goToNextStep`'s `fromStep === 2` branch captures `state.days` into `previousDays` before
  `expandDays` overwrites it, and passes it through. No new persisted state: `state.days` is already
  saved in snapshots and itineraries and is only rewritten at this transition, so it is the baseline.
- `citiesNeedingArrange` also skips cities with no approved activities, so a changed city with
  nothing to place never fires an LLM call.
- `public/app.js`: the per-city-switch trigger added earlier is removed — every changed city is
  handled on entry, so switching tabs no longer schedules anything.
- `public/app.js`: `autoArrangeActiveCity` accepts `opts.auto`, which skips the "Replace
  arrangement?" confirm (an automatic run must not prompt), and now clears every flexible activity's
  placement before applying the server response. Without that, an activity the response does not
  place kept a dayId pointing at a day that no longer exists — rendering in no column and excluded
  from the unplaced list for being "placed", i.e. invisible.
- Verified in headless Chromium against the real `planner.html`, no page errors: fresh run arranges
  both cities; no-change arranges none; adding a day to city B arranges B only; shifting both cities
  arranges both; shrinking city A arranges A only; rename arranges the renamed city; a newly added
  city arranges alone; a changed city with no approved activities arranges nothing; the wizard still
  gates the first run. Separately, a shrink driven through the real `autoArrangeActiveCity` with a
  canned response left 0 activities stranded (was 3) and surfaced the unplaced two in staging.
  273/273 unit tests pass.

---

## [2026-08-17] Arrange drafts itself on entry; Draft button removed

Moving Review → Arrange now asks for schedule preferences and builds the schedule, so the step no
longer opens as an empty board the user has to know how to fill (decisions [2026-08-17]).

- `public/app.js`: new `cityHasSchedule()` / `maybeAutoArrangeCity()` beside
  `autoArrangeActiveCity`. `maybeAutoArrangeCity` is the old `#autoArrangeBtn` handler plus a gate —
  it returns if the active city already has an activity carrying a `placements[id].dayId`, opens the
  wizard when `_userConfirmed` is false, and otherwise arranges directly. Called from
  `goToNextStep`'s `fromStep === 2` branch after `setStep(3)`, and from the three city-switch
  handlers in `renderArrangeCityNav` (now routed through one `switchCity` helper) so each city
  drafts on first visit.
- `public/app.js` / `public/planner.html`: `#autoArrangeBtn` deleted — markup, `els` entry, click
  handler, and the two unguarded `els.autoArrangeBtn.disabled` writes inside `autoArrangeActiveCity`
  that would have thrown once the element was gone.
- `public/planner.html`: `#schedulingWizardBtn` relabelled "Schedule" → "Schedule preferences",
  icon `ph-calendar-dots` → `ph-sliders-horizontal`. The id is unchanged, so
  `public/js/landing-reel.js:871` still drives it.
- `public/styles.css`: `#step3 .arrange-actions` gains `flex-wrap: wrap` +
  `justify-content: flex-end` and `.auto-arrange-btn` gains `white-space: nowrap`, so the longer
  label stays on one line and the row breaks onto two rows at ≤360px instead of wrapping text
  inside a fixed 36px pill.
- `src/services/websiteGuide.md`, `src/services/chatPrompt.js`, `public/app.js` chat suggestion:
  the Draft entry is replaced by a description of the automatic build; both chatPrompt rules that
  used "Draft" as the example of a misleading button name now use "Finalize" and
  "Schedule preferences".
- Verified in headless Chromium against the real `planner.html`: all six gate cases
  (unconfirmed→modal, save→arrange, confirmed→arrange direct, already-scheduled→no-op,
  second-city→arrange, dismiss→no-op), no page errors, and header layout measured at 320/360/390/
  768/1280px with no horizontal overflow. 273/273 unit tests pass.

---

## [2026-08-08] Production planning switched to GPT-5.6

`planCity` now defaults to `gpt-5.6` with `SYSTEM_PROMPT_GPT_LEAN`, one call per city
(decisions [2026-08-08]). Owner call, on the measured bake-off plus the blind read.

- `src/claude.js`: `anthropicGenerator()` + `getClient()` replaced by `openaiGenerator()`; the
  `@anthropic-ai/sdk` import is gone from this module. `MODEL` is `gpt-5.6`. The default
  `basePrompt` moves from `SYSTEM_PROMPT` to `SYSTEM_PROMPT_GPT_LEAN`. The `generate` seam is
  unchanged, so the bake-off still drives Sonnet arms through the same pipeline.
- `src/routes/activities.js`: the typed key-missing branch is now `OPENAI_KEY_MISSING`.
- `src/planPrompt.test.js`: the default-prompt test now asserts the lean prompt and uses
  `SYSTEM_PROMPT` as the override case.
- `CLAUDE.md`: request-flow and `claude.js` module notes corrected — planning is GPT-5.6,
  auto-arrange remains Sonnet 4.6, and the semaphore is described as provider-neutral because it
  counts calls rather than Anthropic calls.

`@anthropic-ai/sdk` remains a dependency — chat, auto-arrange, profile summaries and memory
reconciliation are untouched. `SYSTEM_PROMPT` and `SYSTEM_PROMPT_GPT` are retained as bake-off arms
(`--prompt default|gpt`), not dead code. 273/273 pass.

## [2026-08-08] `--split 2` measured and rejected

Ran `gpt-5.6+lean --split 2` on staging against the unsplit run of the same arm and cities. It was
the last unmeasured lever on the branch.

| | unsplit | split 2 | |
|---|---:|---:|---|
| sec/city | 186.3 | 119.2 | −36% |
| sec/act | 5.65 | 4.89 | −13% |
| kept/target | 33/33 | 25/33 | −8 activities |
| distinct% | 89 | 76 | −13 pts |
| $/city | $0.308 | $0.476 | **+55%** |
| $/act | $0.0094 | $0.0193 | **+105%** |
| meals ok | 11/11 | 11/11 | held |
| ghost | 0.5 | 0.0 | improved |
| photo% | 76 | 70 | worse |

Rejected — decisions [2026-08-08]. The predicted ~3x speed-up did not appear (1.56x), and the cost
increase was structural and should have been predicted before the run: each window is a full call
carrying the same system prompt and Brave research block while producing half the activities.

Also settled `hours ok%`, which read 0 in this run. Not a regression from the opening-hours fix:
`hoursMatched/hoursComparable` compares `llmHours` against Places, but since no prompt asks for
`opening_hours`, `llmHours` was never the model's answer — it was our own `arrangeConfig` category
default, so the column has been scoring our fabrication against Places. It was already degenerate
(`hoursComparable` of 0 and 3 in the two runs checked pre-fix). Removing the default from
venue-less activities shrinks the denominator further, which is the correct direction. The column
now measures nothing useful and should be re-pointed at the fraction of *named* venues that got
hours from Places at all.

## [2026-08-08] Blind read of all four arms, and the opening-hours fabrication it found

Read the 8 saved lists at `/debug/bakeoff?file=blind-read.md` (2 cities x 4 arms), keyed after
judging. Three findings.

**The museum question is answered, and museums were never the problem.** Against a profile of
museums 2/5, performances 2/5, structuredTours 1/5:

| arm | museums | `tour` type | of which real performances/workshops |
|---|---:|---:|---:|
| gpt-5.6 bare | 5 | 0 | 0 |
| gpt-5.6+gpt | 0 | 0 | 0 |
| sonnet-4-6 | 2 | 12 | 6 |
| gpt-5.6+lean | 1 | 0 | 0 |

Sonnet 4.6 respects the museum rating but puts 12 `tour` activities in 66. Roughly half are
mislabels (Pudacuo National Park and Balagezong are scenic areas). The rest are real: Impression
Lijiang ($45), Naxi Ancient Music ($23), Tibetan Folk Dance Show, Thangka Workshop ($35), Butter
Tea Ceremony, Pu'er Tea Tasting — six structured/performance bookings against ratings of 1/5 and
2/5, plus an Evening Bar Crawl against nightlife 1/5.

**Sonnet also produces trip-level errors no other arm does.** A 10-hour "Lijiang to Shangri-La
Scenic Drive (Day Trip)" on an itinerary that moves to Shangri-La five days later; a Meili Snow
Mountain entry whose own pitfall says it "requires an overnight stay in Deqin"; a Tiger Leaping
Gorge entry filed under Shangri-La with venue city `Lijiang`, whose pitfall calls the single-day
version "brutal"; and 7 Shangri-La meal entries across 4 restaurants (Compass three times, Xiaocai
twice). `gpt-5.6+lean` has none of these — one gorge entry, no cross-city day trip, 12 Lijiang
meals across 12 distinct restaurants. The two lean-prompt lines added for this ("One destination is
one activity"; "Drop any activity whose own pitfall argues against doing it") are doing the work,
and no metric column shows it.

**The defect: `normalizeActivity` invented opening hours for unstructured activities.** 11 of 24
non-meal Lijiang activities asked for a time their own hours forbade — a dawn old-town walk at
07:00 carrying `neighborhood`'s 09:00-21:00, a 10-hour Tiger Leaping Gorge hike at 06:30 carrying
`sports`' 10:00-21:00 so it could not start before 10:00. Cause was `claude.js:307` falling back to
`arrangeConfig`'s category default whenever the model omitted `opening_hours`, which is always —
none of the three prompts ask for the field. Fixed by keying the fallback on `venue_name` rather
than type (commit `92fdce9`): a gated venue keeps a default until Places answers, an unstructured
activity gets `''`, which `parseOpeningHours` already reads as `[[0, 1440]]`. Meals unchanged —
their category default was already `''` and they always carry a synthesised `venue_name`.

Verified against the exact failing cases: all now schedulable at the time they ask for, Mu Mansion
still keeps 09:00-18:00. Two tests added to `planPrompt.test.js`, no API key needed; 273/273 pass.

Also checked and **not** a bug: all 22 lean meals carry empty hours, which looked like broken
lunch/dinner anchoring. `mealSlotCapability` returns `{lunch: true, dinner: true}` on empty, so they
place freely. Sonnet's invented restaurant hours are the riskier behaviour — a fabricated window can
wrongly exclude a slot.

## [2026-08-08] The traveler profile never reached the planner

Branch `claude/guide-me-setup-stuck-mszkyo`. `planCity` read three keys off `profile.answers` —
`pace`, `shoppingPerson`, `shoppingInterests` (`claude.js:315,338,340`) — and dropped everything
else. `museumPerson`, `foodTravel`, `livePerformances`, `outdoorNature` and `nightlifeBars` were
passed in and discarded, as were `dietaryRestrictions`, `mobilityConsiderations`, `budgetStyle`,
`travelCompanions` and `aboutMe`. The one function that renders them,
`formatProfileForEnrichment`, was imported by `routes/preferences.js` alone, where it feeds a Haiku
call that writes `profileInstruction` — which reaches the planner via `recall()` only if the user
completed the wizard and the summary regenerated. The raw ratings never reached it at all.

`SYSTEM_PROMPT` line 15 ("Filter everything through what they actually enjoy… skip prestige picks
when they're likely to feel flat for this person") was therefore addressed to a model told exactly
one fact about the traveler: the pace. **This invalidates the profile-fit half of the blind read
[2026-08-08]** — the bake-off runs as `userId: 'bakeoff'` with no `data/users/bakeoff.json`, so
`getProfileInstruction` returned `''` and both models planned for a stranger. Neither disobeyed the
prestige-pick instruction; neither was given the information it needs to obey it.

- `claude.js` now injects the same structured block the summariser gets, under a `TRAVELER PROFILE`
  heading placed before `ACTIVITY COUNT`. The standalone pace sentence is gone (the block carries it).
- `profilePrompt.js` renders `2/5 (Slightly interested)` rather than the word alone, so a prompt can
  key thresholds on the numeral. Extracted `sliderRating` (the clamp was inline and duplicated).
- Unanswered sliders are omitted rather than reported as a neutral 3: `planCity` treats unanswered
  shopping as 1 and plans none, so a block claiming 3/5 contradicted the same prompt's instructions.
- New `SYSTEM_PROMPT_GPT`, written against GPT-5.6's observed behaviour: interest ratings become
  1-2/3/4-5 thresholds rather than a judgement call; the `opening_hours` escape hatch that beat the
  mandatory-meals rule is closed (null the hours, keep the restaurant); `insider_tips` states an
  expected null rate rather than merely permitting null, and names crowd-timing as the platitude;
  the padding shapes both models produced (logistics blocks, one destination split several ways,
  venue re-use, activities their own pitfall refutes) are enumerated and forbidden; `venue_name`
  null is restricted to activities with no gate, ticket or operator.
- `planCity` takes a `systemPrompt` override and the harness takes `--prompt default|gpt`, tagging
  rows and activity-list filenames as `{arm}+{prompt}`. `SYSTEM_PROMPT` is byte-identical, so the
  pair of runs isolates the prompt.
- New `src/planPrompt.test.js` (13 tests) — captures the prompt `planCity` actually sends rather
  than asserting on the template. 243/243 total.

## [2026-08-08] Blind quality read of the bake-off activity lists

Branch `claude/guide-me-setup-stuck-mszkyo`. Read all 136 generated activities (Sonnet 4.6 and
GPT-5.6 Sol × Lijiang and Shangri-La) through `scripts/blindRead.js`, judging the prose fields the
metric table cannot reach. What the counters missed:

- **Sonnet 4.6 ships 11 activities (17%) whose `preferred_time` falls outside their own
  `opening_hours`** — a 20:00 performance at a venue Places closes at 17:00, five sunrise/dawn
  activities at venues opening 09:00. `arrangeScheduler.js` honours opening hours, so these get
  silently rescheduled and the activity's premise is destroyed. GPT-5.6 has 2, both departure
  times on day trips. Cause is mixed: `placesEnrich.applyDetails` overwrites the model's hours with
  the venue's gate/box-office hours for `neighborhood` and `tour` activities where they describe a
  different thing. 7 of the 11 are that collision; the rest are the model scheduling before opening.
- **`SYSTEM_PROMPT` line 38 contradicts line 43**: meals are MANDATORY, but "If actual hours are not
  in the research, OMIT the restaurant from your output rather than guessing" gives a literal model
  permission to return none. GPT-5.6 returned 0 meals in both cities against targets of 12 and 10.
- **GPT-5.6 never returned a `null` insider tip** across 70 activities; ~12 (17%) are crowd-timing
  restatements of the exact "arrive early" platitude line 34 forbids. Sonnet returned 2 nulls, both
  on padded venue re-uses — the escape hatch working as designed.
- **Both models pad to hit the target count, by different mechanisms.** Sonnet re-uses venues
  (Shangri-La: 7 meals across 4 restaurants, Compass ×3, Xiaocai ×2); GPT decomposes one destination
  into several activities (Pudacuo ×4, Napa Lake ×4, Balagezong ×3) and adds logistics blocks whose
  own `why_it_fits` says they are not worth doing (railway-station buffers, Walmart, a botanical
  garden past flowering season) — ~8 of 70.
- **Itinerary-level errors no per-activity metric can see:** Sonnet plans a 10-hour day trip *to
  Shangri-La* inside the Lijiang leg, two days before the traveller moves there for four days, and
  plans Tiger Leaping Gorge as a full day in both cities. Both models ship activities their own
  `pitfall` field argues against (Meili Snow Mountain "requires an overnight… otherwise a very
  rushed day trip"; an 11-hour, $180 Baishuitai run).
- **Sonnet's insider tips are materially more specific** (CNY prices, named streets and guesthouses,
  Chinese characters) but carry a matching hallucination risk: Ganden Sumtseling/Songzanlin is
  priced at 115 CNY in the Shangri-La list and 15 CNY in the Lijiang list, same model, same run.
  Two tips coach fee avoidance ("fee booths are rarely manned after 8pm"; "guards rarely check
  return visits the following day").
- **Correction to the recorded bake-off table:** `distinct%` flattered GPT-5.6 (76% vs 71%). The
  metric keys on Places coordinates, and the collapse it penalises is concentrated in dense-old-town
  restaurants — which GPT produced none of. GPT also leaves `venue_name` null on 41% of activities
  vs Sonnet's 26%, so a larger share of its list is never grounded at all. On padding, the prose is
  the better evidence than the column, and it shows both models padding.

No code changed. Findings recorded here and as open items; the fixes are `SYSTEM_PROMPT` and
`placesEnrich.js` changes, not a model change — the model decision [2026-08-08] stands.

## [2026-08-08] planCity model bake-off reports: Sonnet 4.6 stays

Branch `claude/guide-me-setup-stuck-mszkyo`. Closes the model question that gated the branch.

- **Result**: Sonnet 4.6 — 66/66 activities against target, 100% grounding, 6.08 sec/act, $0.0054/act. GPT-5.6 (`gpt-5.6-sol`) — 70 activities, 100% grounding, 6.24 sec/act, $0.0083/act, and **zero meals in both cities** plus non-activity filler. Sonnet 5 rejected on analysis (new tokenizer + adaptive thinking ≈ $0.46/trip vs $0.35; intro pricing expires 2026-08-31). Full reasoning in decisions [2026-08-08]. `src/claude.js` unchanged — the production model was never switched.
- **`src/services/placesEnrich.js`**: concurrent activities at one venue each fetched it separately inside the enrichment `Promise.all` — one Shangri-La run spent 10 live lookups on 4 venues, with every photo hit billed twice. Now share an in-flight promise, scoped per call.
- **`scripts/planCityBakeoff.js`**: rows are priced on the model the provider reports serving, not the string requested — GPT-5.6 bills per tier and the tiers differ 5x on output price, so the requested string could not attribute cost. Tier rates added; the bare `gpt-5.6` key stays null so an unrecognized tier prints an em dash instead of a wrong number. OpenAI arm sends `max_completion_tokens` so truncation is distinguishable from the model's real ceiling. Meal counts replace a percentage (0/0 rendered as a dash, hiding the run's most important finding).
- Verified: 224/224 unit tests. Both arms measured live on staging across both cities.

## [2026-08-08] A 24/7 Places result no longer overwrites the model's opening hours

Branch `claude/guide-me-setup-stuck-mszkyo`. From the first staging run that confirmed the `venue_name` lookup was live.

- **`src/services/placesEnrich.js`**: Places returns `00:00-23:59` for a district or any venue with no posted hours — the absence of hours data, not a schedule. `applyDetails` was letting it replace the model's window, so `Lijiang Old Town Night Wander` (model: 09:00-21:00) became bookable at 08:00 and `Wenhai Eco-Village Trek` (10:00-21:00) at any hour. Now skipped when the model supplied a window; still applied when it did not. New `ALL_DAY` constant, exported.
- **`scripts/planCityBakeoff.js`**: `hours ok%` excludes 24/7 Places results, which were scoring a correct model window as a miss. `distinct%` demoted to a cross-arm comparison — Places collapsed three separate Lijiang Old Town restaurants onto one coordinate at one price tier, so it has a floor no model can clear. Report text notes that no metric catches a wrong-city venue (Sonnet 4.6 offered Shangri-La's Dukezong Old Town inside Lijiang and Places snapped it to a Lijiang coordinate, scoring as a clean resolve) — that is the blind read's job.
- **`src/services/placesEnrich.test.js`**: 2 new cases — a 24/7 result leaves the model's hours alone but still applies its coordinate; a 24/7 result is used when the model supplied nothing.
- Verified: 223/223 unit tests. Confirmed live on staging: Lijiang returned 36/36 against a target of 36 with no DEDUPE line and 36/36 coordinate resolution, and Places queries in the log read as venue names with meals carrying the city suffix.

## [2026-08-08] Deduplicate activities by name, not by grounded coordinate

Branch `claude/guide-me-setup-stuck-mszkyo`. From the first staging baseline that showed the drop list.

- **`src/claude.js`**: `dedupeByVenue` → `dedupeByName`, keying on the lowercased name only. The coordinate key dropped 13 activities across the two cities — 4 Dukezong Old Town activities collapsed onto one district centroid, 3 Lijiang Old Town likewise, a butter-tea workshop onto Ganden Sumtseling, a hotel dining room onto the Old Town breakfast stalls — against 2 genuine duplicates. It was also the whole delivered-count shortfall: 37 and 31 raw against targets of 36 and 30, cut to 31 and 24. `coordsOf` is no longer used by the dedupe path.
- **`src/planCitySplit.test.js`**: the three coordinate-collapse cases replaced by name-collapse across windows, four Dukezong activities at one centroid all surviving, and one park under three names surviving to be measured as `distinct%` rather than hidden.
- Verified: 221/221 unit tests.

## [2026-08-08] Google Places lookups keyed on `venue_name`

Branch `claude/guide-me-setup-stuck-mszkyo`. Found while auditing why the split-generation baseline run delivered 30/36 and 22/30 activities and why several Shangri-La activities shared one map pin.

- **`src/services/placesEnrich.js`**: `enrichWithPlaceDetails` queried `activity.name` — the descriptive label — instead of `venue_name`, the field `SYSTEM_PROMPT` defines as the Google-Maps-resolvable place. New `placesQuery()` prefers `venue_name` and falls back to the label only when it is null (unstructured activities, by schema). `placesCache` get/set and the `places-fetch` debug lines follow the same value, so the log shows the query that was actually sent. The `onOutcome` instrumentation now also reports `venueName`.
- **`scripts/planCityBakeoff.js`**: `noPlace` renamed `ghost` and narrowed to activities where the model named a venue Google has never heard of. Activities with `venue_name: null` no longer count against a model for failing to geocode a label. Table header, decision-rule text and metric notes updated.
- **`src/services/placesEnrich.test.js`**: 2 new cases — the venue name reaches Places rather than the label, and a null `venue_name` falls back to the label.
- Verified: 222/222 unit tests (220 → 222). Not yet re-measured against live providers; the effect on delivered counts, `distinct%` and `meal res%` is the point of the next baseline run.

## [2026-08-07] Plan-step progress reporting, image sourcing rework, no-hotel planning, model bake-off

Branch `claude/guide-me-setup-stuck-mszkyo`. From a 2-city Yunnan trip (Lijiang 10-08→10-13, Shangri-La 10-13→10-17) reported as "stuck" at Setup → Next, with missing card images and prose crowding the review nav pill.

- **Plan progress (`src/routes/activities.js`, `src/claude.js`, `public/app.js`)**: `/api/plan` wrote nothing between `res.flushHeaders()` and the first finished city — minutes of silence on a dense trip. Added `city_start` and `phase` events (research / generating / enriching, hooked to `planCity`'s existing `debugLog` points via a new `onPhase` option) plus a 15s `: ping` heartbeat cleared on completion and on `req.close`; `res.end()` moved into a `finally`. Client counts 4 steps per city instead of whole cities (`PLAN_PHASES_PER_CITY`), so a 2-city plan advances 8 times rather than twice; status line names each city and phase via the existing `truncateLocation`. `setPlanningLoading(isLoading, cityCount)` now owns the bar lifecycle, removing a reset that snapped it back to 0 when the stream opened.
- **Review nav (`public/planner.html`, `public/styles.css`, `public/app.js`)**: deleted `<p id="continueArrangeHint">`, its `.nav-hint` rule and the embed-mode override; the disabled arrow + `title` tooltip carry the gate. `updateReviewNav` simplified to `some()` with an early return.
- **Images — venue photos (`src/services/placesEnrich.js`)**: added `places.photos` to the existing `X-Goog-FieldMask` and resolve the first photo via `/media?skipHttpRedirect=true` (returns a public URL; the API key stays server-side). Stored as `photoName` + `imageUrl` in `placesCache`; entries lacking the `photoName` key are refetched once so the 90-day TTL can't serve permanently photo-less hits. Target filter widened to `!hasCoords(a) || !a.imageUrl`. New `src/services/placesEnrich.test.js` (7 cases).
- **Images — city pool (`src/unsplash.js`, `src/services/imageQuery.js`, `src/routes/image.js`)**: replaced per-activity keyword search with a per-city pool. `shortCity()` strips the qualified Places name (`Shangri-La City, Diqing…, Yunnan, China` → `Shangri-La City`) which had been appended verbatim to every query; `cityImageQueries()` builds 3 searches; `scoreImageMatch()` ranks pool photos by name/tag overlap with per-type hints. Pool cache stores the in-flight promise so concurrent `/api/image` calls collapse into one set of searches (36 activities → 3 queries). Empty pools aren't cached, replacing the old permanent negative cache. Removed `buildImageSearchQuery` and `fetchUnsplashImage`. New `src/services/imageQuery.test.js` (8) and `src/unsplash.test.js` (7).
- **No-hotel planning (`src/claude.js`, `src/services/distanceMatrix.js`, `public/app.js`)**: `planCity` destructured `accommodations` while the client sends `accommodation` — every plan read "No accommodations provided" even when a hotel was entered, and the Places bias was never set. Both shapes accepted; bias falls back to city coords, which the client now sends (it validates them but was stripping them). New `cityAnchor()` lets the inter-city leg compute from city centres when no address exists. The transfer estimate was assuming a 09:00 departure instead of the departing city's `leaveTime`, so with an 18:00 departure and 4h transit the arriving city was told 13:00 while the departing city planned to 18:00 — both booked 10-13. Now derives from the real leave time (22:00) and tells the departing city its day ends at 18:00. 4 new cases in `src/distanceMatrix.test.js`.
- **Partial failure (`src/routes/activities.js`, `public/app.js`)**: one city throwing rejected the `Promise.all`, ending the stream and discarding successful cities while their siblings still wrote to the closed response. Failures caught per city and reported as `city_error`; the run fails outright only when every city fails.
- **Model bake-off (`src/claude.js`, `scripts/planCityBakeoff.js`)**: extracted the streaming call behind an injectable `generate` option (omitting it preserves today's behaviour including the key guard). Harness runs 4 arms — `sonnet-4-6` control, `sonnet-5` at medium/high, `gpt-5.6` — over both cities, 3 runs each, with Brave results recorded to a cassette and replayed to every arm while Places stays live. Reports sec/city, venue-resolution %, retry/truncation rate, filter yield and cost/city; writes per-arm activity lists for a blind read.
- Verified: 202/202 unit tests (176 → 202, +26). SSE wire format checked with a stubbed `planCity` (11 events in the right order for 2 cities; `: ping` frames correctly ignored by the client parser). Image ladder checked end-to-end: a resolving venue takes its Places photo, non-resolving activities match the pool (a thangka workshop picked the thangka photo over a lake), Unsplash saw `Shangri-La City` not the 10-word name. Partial-failure and transfer-day fixes checked against the real route. Live-LLM behaviour and the bake-off itself remain unrun — no API keys in this container.

## [2026-07-30] Clean URLs: `/plan/<step>`, `/trip/:id`, `/admin` — no `.html` in the address bar

Branch `claude/yunhai-url-endpoints-t6a3ja`.

- **Server routes** (`src/server.js`): replaced the two `*.html` handlers with a clean route table registered before `express.static` (so the static middleware never serves the raw filenames). `/plan`, `/plan/:step` (whitelist `setup|review|arrange|finalize`; unknown slug → 302 `/plan`), `/trip/:id`, and `/admin` all reuse the existing `serveWithClerkKey()` helper. 301 redirects from `/planner.html` → `/plan`, `/admin.html` → `/admin`, `/index.html` → `/`, each preserving the query string via `queryOf(req) = req.url.slice(req.path.length)` (the landing reel's `?embed=1` and legacy `?itinerary=` share links depend on this).
- **Per-step URLs** (`public/app.js`): new `STEP_SLUGS`/`stepPath(n)`/`stepFromPath()` next to `setStep`, which now passes a real URL to `pushState` instead of the previous null-URL call. Embed mode and read-only share views keep the null URL (the reel runs in an iframe on the landing page). The initial `replaceState` seed reads `stepFromPath()` so a deep link isn't clobbered before `init()` runs.
- **Deep-link clamp** (`init()`): a fresh load of `/plan/arrange` has `state.maxStep === 1` (maxStep is in-memory only and no trip state is restored on reload — the resume popup is the re-entry path), so boot clamps to `Math.min(stepFromPath(), state.maxStep)` and `replaceState`s the URL to match. Unreachable deep links land on Setup with the URL self-corrected rather than showing a blank panel.
- **Fixed broken share links**: `/trip/:id` had no server route — the `app.get('*')` catch-all served the marketing landing, so every link from the Share-trip button (`shareTripLinkBtn`) was dead. Added the route; `maybeLoadSharedItineraryFromUrl()` now reads the id from the path with the legacy `?itinerary=` query as fallback, and the `hasShareLink` entitlement bypass recognizes the path form. `shareMinimalItinerary()` switched from `/planner.html?itinerary=…&mode=itinerary` to the same `/trip/<id>` URL, so both share paths agree; the vestigial `mode=itinerary` param (never read) is gone.
- **Links repointed**: six `href="/planner.html"` → `/plan` (`public/index.html`), `IFRAME_SRC` → `/plan?embed=1` (`public/js/landing-reel.js`).
- Verified: 176/176 unit tests. curl against a local server — every redirect returns 301 with the query preserved, `/plan/bogus` 302s, `/plan/*` and `/trip/:id` serve the planner shell (`stepIndicator` present, Clerk key injected, `__CLERK_FAPI_DOMAIN__` substituted) while `/` still serves the landing. Playwright, 15/15: step nav rewrites the address bar, Back/Forward move one step with no page reload, deep-link parse + clamp, embed mode leaves the URL untouched, landing has zero `.html` links, reel iframe loads `/plan?embed=1`. Share chain proven against a seeded itinerary: `/trip/<id>` → id from path → `GET /api/public/itinerary/<id>` → hydrated with `readOnlyShare: true`; legacy `?itinerary=` still works.

## [2026-07-07] Budget-opt cost fix + shared interactive loading screens

Branch `claude/budget-optimization-loading-screens-4hc6a3`.

- **Bug fix — budget total unchanged after accepting a budget alternative**: `POST /api/activity/refine` now folds LLM cost output into the activity's own shape via new exported `applyCostShapeToUpdates` (`src/routes/activities.js`; nested `cost.estimated_usd` vs legacy `estimated_cost_usd`), with new unit tests `src/activityRefine.test.js` (8 cases). `buildChecklistFromState` (`public/app.js`) derives checklist `budgetUsd` from `optActivityCost` (real per-activity cost) with `representativeCostUsd` fallback, and refreshes non-user-overridden values on re-render using a new `budgetUsdAuto` marker (passed through `normalizeChecklistItem` in `public/js/bookingChecklist.js` and `src/tripHealth.js` so it survives the save round-trip).
- **Shared loader**: generalized the planning overlay engine into `showLoader`/`setLoaderStatus`/`setLoaderUnitsDone`/`finishLoaderProgress`/`hideLoader` (renamed from `*PlanProgress`; `setPlanningLoading` is now a thin wrapper). New message arrays `BUDGET_OPT_MESSAGES`/`ARRANGE_MESSAGES`/`REPLACE_MESSAGES`. Wired into: budget-opt `onConfirmLocks` (determinate "Activity N of M"), `autoArrangeActiveCity` draft+finalize (3 milestones, replaces the 'Arranging…' button label), both card replace handlers (indeterminate; expand variant closes first and reports failure via error banner). `.planning-overlay` z-index 1800→2050 (above budget-opt footer/modals/card-expand). Embed mode now mounts the overlay.
- Verified: 176/176 unit tests; Playwright end-to-end in embed mode (13 happy-path checks + 4 failure/override probes: meter 310→160 after optimization matching the overlay math, user-edited budget kept while legacy auto value refreshes, loader teardown + error banner on refine/replace/arrange failures, no stuck `overlay-active`). Keyless drive recipe: `/planner.html?embed` bypasses auth and exposes `applyDemoState`/`setStep`/render hooks; stub `/api/**` with Playwright routes (register the catch-all first — most-recent wins) and block non-localhost script URLs; seed `schedulingPrefs._userConfirmed` before driving auto-arrange.

## [2026-07-03] Mobile de-squish: full-width budget meter, city-card date row, compact topbar

Branch `claude/codebase-review-sweep-2z6t4h`. From 390px iPhone staging screenshots (squished tracker meter, wrapping dates, two-row topbar):

- **Budget/Activities tracker**: `trackerRow()` (`public/app.js`) now wraps each row in `.tk-row`; CSS switched from one shared 4-column grid to per-row flex (desktop identical). New `@media (max-width:767px)` block AFTER the base tracker rules (source order matters — the base `.tk-bar{flex:1}` otherwise overrides it): bar becomes `flex:0 0 100%`, order last, 10px tall — full-width meter on its own line under "label … value [Optimize]".
- **Setup city-card header**: deleted the stale `.city-row-main > :nth-child()` mobile rules (written for pre-redesign markup; they forced the date pill into a half-width cell of the new 5-column `gm-city__head` grid — the actual cause of dates wrapping to two lines). New mobile layout: header collapses to `36px minmax(0,1fr) auto auto`, `.gm-city__dates` spans a full second row.
- **Date pill overflow follow-up**: iOS renders the wide native "May 7, 2026" format (headless Chrome shows the narrow "05/07/2026"), so the pill bled off the card's right edge on real devices. Fix: on mobile the pill fills the card (`width:100%`), font drops to 10px, gaps/padding tighten, and the redundant "· N nights" is hidden (still shown in the expanded "Nights" field) so both full-format dates fit without clipping; `overflow-x:auto` is a last-resort net. Added a Playwright stress check forcing 100px date inputs to simulate the iOS width.
- **Tabs**: `.gm-city__tabs` overflow-x auto (scrollbar hidden), tab margin 22→16px, nowrap.
- **Topbar**: compact pills at ≤767px (32px height, tighter padding/font), health badge 32px (needs the 3-class selector to beat planner.html's inline style), Checklist icon-only via new `.btn-text` span (`planner.html`).
- **Finalize "Needs a confirmation" checklist**: `#step4 .open-item` is a 3-col grid (`auto 1fr auto`) that squeezed the text body to ~110px on mobile (venue names read one word per line). Added a ≤767px block stacking it: date badge + body on the top row, `Add confirmation` CTA on its own row below (`grid-column:1/-1`). Body width 110→224px; desktop unchanged. Playwright-checked (`verify-checklist.js`).
- **Budget Optimization cards — badge chip + prev/next arrows** (implements a previously-written but never-committed plan): replaced the `.opt-card--refined-label` pill (a solid-accent-blue span that blockified into a full-width bar in the stretch flex column) with a `.badge.badge-refined` chip rendered as the first item in the existing badge row of `buildBudgetOptCard`'s `faceHtml` and the expand body — consistent sizing with the type/price chips (blue tint matching `.badge-maps`). Rewrote `openOptCardExpand(act,label)` → `openOptCardExpand(activities,startIndex)` mirroring `openCardExpand`: prev/next `.card-expand-nav` arrows, ArrowLeft/Right/Escape keys, disabled at ends, resolving each card's shown face/label from `budgetOptState` at show-time. Both call sites (lock + flip) now pass `(approved, approved.indexOf(a))`. Deleted the `.opt-card--refined-label` CSS. Playwright-verified 16/16 (`verify-budgetopt.js`): lock-phase nav, flip-phase Refined/Original chips (small pill, not a bar), expand arrows. 168/168 unit tests pass.
- Verified via Playwright (Chromium) at 390×844 + 375×667 + 1280px: 20/20 geometry checks (pill spans row, dates single-line, no horizontal scroll, tabs one line, meter ≥321px wide, topbar actions ≤44px tall, desktop tracker unchanged). 168/168 tests pass.

## [2026-07-03] Codebase clean-sweep: security hardening, correctness fixes, dedup pass

Branch `claude/codebase-review-sweep-2z6t4h` (5 commits). Full-repo review (backend core, services, frontend) then targeted fixes; 168/168 tests green (8 new smoke regressions).

- Security: removed unauthenticated `GET /debug/codes` (leaked all invite codes; with pre-auth `redeem-code` accepting body userId this was a full entitlement bypass); `redeem-code`/`entitlement` now require Clerk auth and derive userId from the session; public `/api/status` no longer returns the raw `GOOGLE_MAPS_API_KEY` (new authed `GET /api/config/maps-key`); `/debug` + `/debug/clear` owner-gated, `/debug/client` auth-gated; email webhook fails closed (503) when `EMAIL_WEBHOOK_SECRET` unset; `/api/activity/add|replace` memory recall/observe now scoped by the authed user (was client-supplied `userId`); chat sessions record an owner and message/read/delete verify it; `/api/admin/arrange-stats` moved under `requireOwner` (ADMIN_TOKEN scheme deleted).
- Frontend security: fixed placed-card tooltip XSS (dataset round-trip decoded the write-time escaping; now escaped at read), hardened `esc()` to coerce non-strings, escaped invite codes in admin.html, removed the Clerk-JWT-prefix `sendDebug` logging and leftover boot/entitlement/redeem debug chatter, `sendDebug` now authenticates via `apiFetch`.
- Correctness: `itineraryStore`/`userDataStore` writes are tmp+rename atomic; all-day Google Calendar `end.date` treated as exclusive (was stretching events a day, causing false conflicts); fixed duplicate `daysBetween` in app.js (exclusive version shadowed the inclusive one — setup insights under-counted planned days by 1/city); shared `fetchWithTimeout` (10s) on Distance Matrix/Places/Unsplash/Calendar fetches; capped chat `SESSION_STORE` (500, idle eviction) and unsplash caches; guarded `llmSemaphore.release()` underflow.
- Dedup/dead code: new `src/services/llmJson.js` (shared LLM-JSON parse/repair toolkit, replaced 5 copies); `parseClockTime` in `shared/timeHelpers` + `services/calendarShared.js` (calendar parser/location-label dedup); merged keyword extractors into `imageQuery.extractKeywords`; `services/jsonFileCache.js` factory behind commute/places caches; deleted `arrangeConstants.js`, `normalizeLegacyActivity`, `enrichWithPriceLevel`, the first/last accommodation pseudo-split, `renderItineraryModeSummary` no-op, dead client `userId` plumbing (`ensureUserId`); extracted `clearItineraryColumns()`; `renderTripHealth` reuses `renderTripHealthBadge`.
- Repo hygiene: untracked `.env.local` (unused InsForge artifact), `japan.pdf`, `.DS_Store`; removed dead `review:learn` npm script; Brave stdout telemetry no longer logs query text; `.env.example` documents `OWNER_USER_ID` and the fail-closed webhook; CLAUDE.md updated (routes/ split, llmJson, esc()/dataset rule).

## [2026-07-03] Setup-step mobile fixes: dark autocomplete pills, gm-grid overflow, bottom clearance

Branch `claude/mobile-ui-feedback-eqx6he`. From a staging iPhone screenshot (OS Dark Mode, ~390px):

- **`color-scheme: light` declared on `:root`** (`public/styles.css`) — the `gmp-place-autocomplete` shadow input (and native time/select chrome) was self-theming near-black on Dark-Mode phones while our own inputs stayed light. The app is single-theme light; now everything renders light regardless of OS setting.
- **Horizontal overflow fixed at the grid**: `.gm-grid > *` and `.gm-f` get `min-width: 0` (grid-item `min-width:auto` let the autocomplete shadow input's intrinsic width inflate `.gm-pane` past the card, dragging the Time field with it); `.tp-place-autocomplete` gets `min-width: 0`; the shadow-input override in `attachPlaceAutocompleteElement` (`public/app.js`) now also pins `width:100%; min-width:0` on the internal input.
- **Bottom clearance**: mobile `.container` bottom padding 96px so `#setupInsights` scrolls clear of the fixed save/next pill and chat FAB. Placed AFTER the redesign's `.container` rule — the old 767px-block padding/margin was silently dead (later equal-specificity rule won); the dead mobile container rule and the legacy drawer rules (`.city-dropdown-section`, `.accommodation-row`, `.arrival-row`, `.departure-row` — classes no longer rendered) were removed.
- Verified via Playwright at 390×844 with `colorScheme:'dark'`: root computes `light`, time input renders paper-light, injected wide intrinsic input causes zero horizontal overflow, summary strip bottom (707px) clears pill top (770px). 160/160 tests pass.
- **Note:** staging still runs pre-branch code — none of this branch is deployed until `deployment/promotion.sh deploy-staging claude/mobile-ui-feedback-eqx6he` runs on the VPS.

## [2026-07-02] Auto-arrange overhaul: server-authoritative endTime, meal rescue pass, honest commutes

Branch `claude/mobile-ui-feedback-eqx6he`. Follows a full review (backend pipeline, frontend duplication, git bug archaeology). decisions [2026-07-02] ×2.

- **Authoritative contract** — `schedule()` (`src/services/arrangeScheduler.js`) emits `{date, time, endTime}` per placement; all-locked early return in `/api/arrange` now shape-consistent (`mealRedistributed: 0`). Client (`public/app.js`) stores `{dayId, time, endTime}` and renders it verbatim: `getPlacementTimeRange` prefers the server end; `makePlacedCard` height/label and `renderArrange` flow-cursor height derive from it. **Deleted the post-response overlap re-check** that silently unplaced server placements. `endTime` invalidation on every manual write site (drag drop, resize commit, boundary clamp, commute cascade, checklist sync — no stale spreads); time-edit save stores the user's declared end. Auto-arrange button restores its prior label (was hardcoded to 'Auto Arrange' even in Finalize flow).
- **Meal rescue pass** — fixes the live `SCHED_ASSERT_FAIL empty_dinner_with_available_meal`: meals dropped for anchoring infeasibility retry on nearest-day-ordered candidates with a free slot, against real placed intervals (`anchorMeals` now returns `usedSlots`; new `nearestDayOrder`). Validator check 8 counts locked meals into the dinner slot and guards on day-window∩dinner-window (two false positives closed).
- **Commute honesty** — `getCommuteMin` returns `null` for missing pairs; `placeNonMeals` uses the real value + buffer (5-min walk → 15-min gap, was floored to 20; miss still → 20); NN ordering uses the same fallback; obstacle-resume budgets commute from meal anchors when the pair is in the matrix. Validator commute check uses shared `COMMUTE_BUFFER_MIN` and checks all real pairs (dropped the `<15` skip + hardcoded literals). `distanceMatrix.getFastestCommuteWithSource` falls back to `walkingCommute` (Google walking → haversine ×12 min/km) when transit AND driving both fail — addresses the standing ZERO_RESULTS open item.
- **Consolidation** — `COMMUTE_BUFFER_MIN`/`WALKING_FALLBACK_MIN` moved to `arrangeConfig.js`; `getOpeningHoursRaw` + `mealSlotCapability` deduped into `arrangeValidator.js`; meal-window strings in messages built from constants; deleted dead `MIN_COMMUTE_THRESHOLD_MIN`, `getFastestCommuteMinutes`, `normalizeTravelMode`, unreachable `bicycling` icon. Telemetry `logRun` failures now surface via `debugLog` (was a bare swallow).
- **Tests** — 160/160 pass: +7 scheduler (endTime, unfloored/missing commute gaps, rescue live-repro, rescue-around-obstacles, infeasible-stays-silent, short-window check-8 guard), +4 validator (commute parity, check-8 locked/window guards), new `src/distanceMatrix.test.js` (mode-fallback chain, stubbed fetch) and `src/arrangeTelemetry.test.js`. Playwright drive against the real app (`?embed`, intercepted `/api/arrange`): verbatim apply incl. endTime, nothing silently unplaced, card renders server end over duration model, time-edit sets end verbatim, manual move drops endTime, button label preserved.

## [2026-07-01] Mobile UI feedback pass: card navigation, toast removal, grounded adds, wizard scroll, mobile overflow

Branch `claude/mobile-ui-feedback-eqx6he`. Five user-reported fixes:

- **Prev/next arrows in the activity detail overlay, now on desktop too** (`public/app.js` `openCardExpand` inside `renderActivities`, `public/styles.css`). Card click opens the overlay on all viewports (was mobile-only); overlay is index-based over `filteredActivities` with ←/→ nav buttons (disabled at ends), ArrowLeft/ArrowRight/Escape keyboard support, scrim click-to-close, and approve/decline syncing back to the grid card by `data-activity-id`. Desktop renders as a centered 640px scrollable modal over a dim scrim; image header capped (`.activity-card-img-wrap` 260px/220px in overlay).
- **Removed the toast system entirely** (`showToast`, `mountToastHost`, toast CSS, checklist undo-toast, pdfExport toasts, `activeSavingToastId`). Success/info feedback deleted (~20 sites); failures now use a new `showErrorBanner()` — single fixed top-center dismissible banner, `role="alert"`, persistent until dismissed, new text replaces old (~30 sites). Dead `silent` param removed from `saveSnapshot`.
- **Grounded activity adds** (`src/routes/activities.js`, `public/app.js`, `public/planner.html`). Root cause: the Add Activity modal posted to `/api/activity/replace`, whose prompt demands a venue that is NOT the typed name. New `POST /api/activity/add`: Google Places resolve gate before any LLM (404 `place_not_found` if unresolvable; inline modal error client-side), LLM only fills descriptive fields with the name forced verbatim, `groundActivityToPlace()` (exported, unit-tested) stamps canonical name/place_id/coords/address/hours; degrades to a grounded minimal activity if the LLM is missing/fails. Extracted `searchPlaceText()` shared with `GET /api/places/resolve` (field mask now includes opening hours). Replace path: one retry turn when the suggested venue doesn't resolve on Places, else `unverified: true` flag. Refine path: re-enriches coords/hours when the LLM renames. Map links (`public/js/activityCard.js` `googleMapsLinkHtml`, `app.js` `getItineraryRows`) prefer place_id → lat,lng → name+city search (was bare-name search → "location not found" on hallucinated names). Added `src/activityAdd.test.js` (5 tests).
- **Schedule-preferences / profile wizard scrolling** (`public/styles.css`): `.profile-wizard-shell` capped at `100dvh - 48px` (32px mobile), `.profile-wizard-card` now `flex:1; min-height:0; overflow-y:auto` — X and Save reachable on short viewports (was `overflow:hidden` with no max-height, clipping both).
- **Mobile overflow**: Arrange board day columns 86vw with x-mandatory scroll snap at ≤767px (was rigid 280px); Finalize trip stats 2-up below 768 (was 4-up until 520). Overrides placed after the base rules to win the cascade.
- Verified: 144/144 tests pass; Playwright drive of the real app (`?embed` mode) at 1280px and 375px — overlay nav/keyboard/sync, banner show+dismiss, wizard scroll metrics, 86vw snap columns, inline add-modal errors, zero `showToast`/`#toastHost` references.

- **Added a planning progress bar** to the loading modal (`public/app.js`, `public/styles.css`) between the progress pill and rotating message. Driven by the real SSE signal (cities completed / total) which is per-city atomic (one LLM call each).
- **Airplane pointer**: the bar's leading edge is a paper-plane SVG (same glyph as the globe) pointing in the direction of travel, with a drop-shadow and gentle idle bob (`planningPlaneBob`, disabled under `prefers-reduced-motion`).
- **Eased trickle**: because per-city is the only real granularity (a 1-city trip would otherwise jump 0→100 at the end), the bar width is owned by a 120ms trickle loop (`beginPlanProgress`/`setPlanCitiesDone`/`finishPlanProgress`/`endPlanProgress`) that eases toward a ceiling just below the next city milestone (`done·share + 0.9·share`, capped 96%), snaps to each real city-done point, pins ceiling to 100% once all cities are done (prevents a backward sag before the `done` event), and jumps to 100% on done. CSS `width` transition softened to `.2s linear` so trickle ticks flow.
- **Fixed saved trips showing "0 activities"** in the resume popup and My Trips panel. `summarizeItinerary` (`src/itineraryStore.js`) only counted activities nested in `days[].activities`, so trips whose activities weren't arranged into days reported 0 despite a populated top-level `activities` array. Now falls back to the top-level `activities` length when no day-nested activities exist (matching the count the save/update paths already use). Read-path fix — no migration needed. Exported `summarizeItinerary` and added `src/itineraryStore.test.js` (3 tests: nested, fallback, empty). 127/127 tests pass.

## [2026-06-03] Resume-trips popup on app load

- **Added a "Welcome back" popup** that auto-shows on app load so returning users can resume a trip immediately instead of scrolling to the My Trips panel. Triggered in `init()` (`public/app.js`) after auth/entitlement/trip-fetch, only when ≥1 saved trip or in-progress draft exists and the user did not arrive via a `?itinerary=` share link.
- **Refactored My Trips into shared helpers** to avoid duplicating row logic: extracted `collectMyTrips()` (draft + saved gathering), `tripRowMarkup()` and `bindTripRows(listEl, trips, { onPick, onChange })` (render + wire Open/Resume/Delete) out of `renderMyTrips()`, which is now a thin caller. The popup (`showResumeTripsPopup()`) reuses the same rows; `onPick`/`onChange` callbacks close it on trip selection or deletion.
- Popup reuses existing styles (`.modal`, `.saved-itineraries-list`, `.saved-itinerary-item`, `.icon-btn`, `.draft-badge`) — no CSS changes. Registered with the overlay manager alongside `confirmDialog`. Dismiss via "Start a new trip" (→ `resetToFresh()`), X, or backdrop. 124/124 tests pass; verified rendering in headless Chrome. Branch `feature/loading-modal-globe-redesign`.

## [2026-06-01] Planning loading modal redesign (animated globe)

- **Replaced the plain-text planning overlay** with the hifi design from `design_handoff_loading_modal/`: inline wireframe-globe SVG (atmosphere glow, ocean gradient, clipped meridians/latitudes, sheen) with a dotted flight route and an orbiting paper plane riding it via CSS Motion Path, plus a refined type hierarchy (uppercase trip kicker, bold hero city line, progress pill, accent-blue rotating message).
- **Markup**: injected the globe SVG above the four text nodes in `mountPlanningOverlay()` (`public/app.js`). No logic changes — existing `data-trip-name`/`data-city-status`/`data-progress`/`data-loading-message` hooks, the `loading-visible` toggle, and 2400ms message cycling in `setPlanningLoading()` were already a match for the design contract.
- **CSS** (`public/styles.css`): rewrote `.planning-overlay-card` + all `.planning-*` rules to the hifi spec (440px card, layered radial+linear gradient, 28px radius, border/shadow), added `.planning-globe`/`.globe-svg`/`.orbit-route`/`.plane` rules and five keyframes (`globeFloat`, `routeFlow`, `planeOrbit`, `planeFade`, `planningCardIn`). Added `.planning-progress:empty { display:none }` so the pill hides during "Starting planning…", and extended the existing `prefers-reduced-motion` block to disable the new animations.
- Reused the `--text-on-dark` token (spec's #F5F0EB ≈ existing #F4F1EC) and kept the existing 7 `LOADING_MESSAGES`. Verified by rendering the real markup + CSS in headless Chrome. Branch `feature/loading-modal-globe-redesign`, pushed. Pending VPS visual verification.

## [2026-06-01] Approved-activity count in budget tracker

- **Surfaced approved activity count** so users can see how many they've approved (the original gap). `renderApprovedCountSection()` in `public/app.js` adds an "Activities — N approved" row to the budget tracker.
- Deliberately **dropped a "Pace" target/bar** that was prototyped first: the comfortable-target denominator (planner generation count) overstated precision — it counts meals as activities, ignores per-day density (already shown by the `Light/Balanced/Packed day` pills), and penalizes intentional curation. A plain count answers the actual need without a false verdict.
- Shows per-day average alongside the count (`N approved · ~X/day`) — density signal without a count denominator, avoiding the "23/28, am I 5 short?" anxiety the planner's intentional over-generation (`maxTotal = minTotal*1.15`) would otherwise trigger.
- **Unified Budget + Activities onto one shared CSS grid** (`.budget-grid`, cols `auto auto 1fr auto`): both are now single-line rows of equal height with `label (i) · value · inline bar · trailing`, aligned columns, via `trackerRow()`. Budget bar moved inline (was stacked). Activities got its own info icon + bar; the bar shows day-fullness (`activityDensityFill()` = avg/day ÷ comfortable full day from pace pref, capped 100%) so it never implies "add more." Removed old `.budget-tracker-top/left/right`, `.budget-bar-*`, `.approved-count-*` CSS.
- Renamed the budget card label `Budget Tracker` → `Budget`; tracker now renders whenever `step >= 2` (was budget-only) with a `.budget-neutral` card variant for the no-budget case. CSS in `public/styles.css`. Branch `feature/pace-progress-bar`.

## [2026-06-01] Checklist modal z-index, post-midnight time labels, block-aware PDF export

- **Attachment viewer behind checklist modal** — `#attachmentViewerModal` and `#checklistModal` both used `.modal` `z-index: 1900`, so equal stacking + DOM order put the viewer behind the checklist when opened from it. Gave the viewer `z-index: 1950` in `public/styles.css`.
- **Times after 11:59pm rendered as PM** — `formatTimeRangeLabel` in `public/app.js` computed am/pm from raw hours; an activity spilling past midnight has `endMins > 1440` (h=25), so 12:59 AM showed as PM. Wrapped hours with `% 24`.
- **PDF export: sliced stops + attachments dumped at end** — rewrote `public/js/pdfExport.js`. Old version rasterized the whole itinerary as one canvas sliced at fixed pixel offsets (cutting through stops) and appended all attachments after the entire itinerary. New version rasterizes block-by-block (hero, `.city-head`, `.day__when`, each `.stop`), packs blocks onto pages without splitting a block across a page break, and inserts each stop's attachments immediately after that stop, then page-breaks.
- 124/124 unit tests pass; frontend-only changes. Branch `feature/checklist-modal-time-fixes`. Pending VPS visual verification of the PDF output.
- **Removed Trip Health warning toasts** — `renderTripHealthBadge` and `renderTripHealth` fired an error toast for every "newly added" issue signature, but `state.tripHealthIssueSignatures` resets to `[]` on trip clear, so every pre-existing conflict re-toasted on each trip open (bottom-right spam). Deleted both toast call sites plus the now-dead `tripHealthIssueSignatures` state field and its reset in `public/app.js`. The persistent Trip Health badge + popover already surface status/issues, so no signal lost. Other ~53 action/error `showToast` calls left intact.

## [2026-05-31] Landing page redesign: 3 auto-playing "how it works" demos + new hero, current reel kept

- **Rebuilt `public/index.html`** to 7 content sections in order: new hero ("Built around *you*. Not the crowd.") → marquee → Chapter 01 *Completely yours* → 02 *Sequenced by data* → 03 *All in one place* → **existing `#reel` demo (preserved verbatim, moved to just before pricing)** → pricing (unchanged) → FAQ → footer. Per request, the current reel demo is retained as the second-to-last content page.
- Swapped the old animated `.stage` SVG-route hero for the handoff's `.heroapp` product-window mock; **removed the `.hero__stats` row** (per user). Updated marquee copy ("Trusted by travelers from"). Removed the now-dead `.stage__card`/`stageAiMsg` inline script. Nav "How it works" anchor `#reel` → `#why`.
- **Ported from `design_handoff_landing_demos/`** into `public/`: `styles/landing.css` (overwritten — new hero/marquee/chapter/demo shell), new `styles/landing/{landing-demos,landing-demo-profile,landing-demo-sequence,landing-demo-organize}.css`, new `js/landing-demo-{profile,sequence,organize}.js`. Each demo self-inits (DOMContentLoaded) and auto-plays once on scroll-in with a Replay button.
- **Kept as-is:** `styles/landing/landing-demo.css` (entirely the reel's CSS), `js/landing-reel.js`, `tokens.css` (byte-identical to bundle), `landing-pricing.css` (bundle reuses it).
- Renamed all `GuideMe` → `YunHai` across ported assets + demo copy; repathed bundle's `Planner.html`/`Landing.html` → `/planner.html` / `#why`.
- 113/113 unit tests pass; no backend touched. Branch `feature/yunhai-landing-demos`. Pending VPS visual verification.

## [2026-05-31] Landing reel: Finalize check-offs + pre-locked rows; fix cursor top-left dart

- **Finalize shows user control** (`landing-reel.js`): 3 Córdoba stops (Mezquita, Bodegas, Alcázar — via `timing.fixed`) now open **pre-locked** in the Finalize modal "as if checked off in the booking checklist," and the cursor then **checks off two more** unchecked rows (`[data-finalize-check]`, re-querying after each re-render) before Confirm. New narrator beat: "You're in control — lock the rest with a tap."
- **Fixed the cursor darting to the top-left** (`landing-reel.js`): the booking-checklist Mezquita flow clicked "More details" unconditionally, but seeded activities have a cost so the secondary zone (reference field) is already open — the click *hid* it, sending `cursorTo` to a 0,0 rect (top-left). Now it only reveals the reference field when actually hidden (`offsetParent === null`), and `cursorTo` hard-guards against any 0,0/hidden target (stays put instead of darting). Re-center before the check-off too.

## [2026-05-31] Landing reel: densely fill every itinerary day (25 activities)

- **Dense calendar** (`landing-reel.js`): the Arrange grid spans 6am–2am, so 3–4 stops/day read as empty. Added 11 calendar-only mock activities (Córdoba: Viana patios, Sinagoga, Hammam, Tablao Cardenal, Salmorejo tasting; Seville: Barrio Santa Cruz, El Arenal tapas, Setas rooftop bar, María Luisa park, Casa de Pilatos, Hospital de los Venerables) and repacked `DEMO_PLACEMENTS` to ~09:30→21:30 back-to-back: days now hold 4/5/4/5/7 stops with a transit pill between each.
- **No photos needed for fillers**: Arrange placed-cards and checklist rows render time+icon+name only (no `<img>`), so the new photo-less activities never show a placeholder. The **02/Review** beat now seeds a curated 6-card photo-backed subset (`DEMO_REVIEW_ACTIVITIES` via `REVIEW_IDS`) so Review isn't a wall of placeholder cards.
- **Finalize checklist** (`landing-reel.js`): `DEMO_REVIEWED_ARRANGED` now derives from `DEMO_ACTIVITIES` (every activity approved), so all 25 stops render in Arrange AND appear in the booking/Finalize checklist (`buildChecklistFromState` includes all approved activities). Full id parity (25 placed = 25 activities); commute pairs all same-day.

## [2026-05-31] Landing reel: visible checklist nav, modal centering, 3 Córdoba days, no overlap

- **Visible checklist navigation** (`planner.html`, `landing-reel.js`): `#checklistBtn` lives in the embed-hidden topbar, so the reel now relocates it to `<body>` and floats it (embed CSS `#checklistBtn.embed-float`); the cursor visibly travels to it and clicks before the modal opens. Hidden again after close.
- **Modal rows centered** (`landing-reel.js`): new `Engine.centerInScroller(el)` scrolls an element's nearest scrollable ancestor (the modal card) to center it — called before each checklist interaction (and again after the Mezquita row expands/grows), fixing rows snapping to the bottom of the screen.
- **3 Córdoba day columns + no arrival overlap** (`landing-reel.js`): expanded Córdoba to Apr 23→25 so three filled columns show (Apr 23 arrival = 1 evening stop, Apr 24 = 3, Apr 25 hero = 4); Seville Apr 26/27 = 3 each. The arrival day's only stop is at 19:00, well clear of the ~13:45 accommodation card, so the accommodation/first-activity overlap from the screenshot is gone. 14 activities, full id parity. Arrange `dur` already 52s.

## [2026-05-31] Landing reel: booking-checklist walkthrough + compacted, denser trip

- **Booking checklist segment** (`landing-reel.js`, start of Arrange beat; `app.js` exposes `window.openChecklistModal`/`renderChecklistModal` in `initEmbedMode` since `#checklistBtn` is in the embed-hidden topbar): the cursor opens the real checklist modal and (1) taps the ticket icon on a free stop (Judería) → moves it to *Booking Not Required*; (2) on the Mezquita row, expands it, sets start/end time, opens *More details*, types a confirmation # (MZQ-4471), and checks it off to lock. Rows targeted by visible name (`.cl-item-name`) since ids are generated. 100% frontend; check-off also satisfies the Finalize gate.
- **Compacted, denser trip** (`landing-reel.js`): shrank the date span to non-overlapping Córdoba Apr 24→25 + Seville Apr 26→27 (4 day columns) and filled every visible day — Apr 24 (3 light arrival stops), Apr 25 (5-stop hero day), Apr 26 (3), Apr 27 (3). Added 5 activities (Mercado Victoria, Taberna sunset, Seville Cathedral, Triana, Las Setas); repacked `DEMO_PLACEMENTS`/`DEMO_REVIEWED_ARRANGED`/`DEMO_COMMUTES` (pill between each same-day pair). 14 activities, full id parity. Arrange `dur` 38s→52s.
- **Photos** (`public/img/demo/README.md`): added 5 new filenames to grab (mercado, vinos, catedral, triana, setas); all previously-added photos still used (none obsolete).

## [2026-05-31] Landing reel: self-hosted photos for demo activity cards

- **Activity-card photos** (`landing-reel.js`): the `act()` helper now derives `imageUrl` from the activity id → `/img/demo/<slug>.jpg` (slug = id minus the `demo-` prefix). Review cards (and the Arrange/Finalize calendar) show real photos once the files are present; a missing file falls back to the mountains placeholder via the existing `activityImgHtml` `onerror`. REPLACEMENT now derives its photo too (kept `place_id`/`price_level` so `enrichActivity` still makes no network call).
- **Drop-in folder**: created `public/img/demo/` with a `README.md` mapping each filename to its activity (mezquita.jpg, alcazar-cor.jpg, bodegas.jpg, juderia.jpg, patios.jpg, puente.jpg, realalcazar.jpg, flamenco.jpg, plaza-espana.jpg, patios-replacement.jpg). User supplies the image files; served statically from `public/`.

## [2026-05-31] Landing reel: pack the Arrange day + simpler Finalize confirm

- **Packed itinerary day** (`landing-reel.js`): added 3 more Córdoba activities (Bodegas Mezquita lunch, Puente Romano, Judería wander) so the active Córdoba 04-25 day holds 6 back-to-back stops (09:30→20:30) with a transit pill between each — the calendar now looks full like the real app, instead of 3 sparse stops. Repacked `DEMO_PLACEMENTS`/`DEMO_REVIEWED_ARRANGED`/`DEMO_COMMUTES` accordingly (Andalucía kept; no arrival/stay anchor cards — 04-25 is a middle day so the logistics cards don't render).
- **Finalize confirm simplified** (`landing-reel.js`): no longer ticks lock checkboxes (Mezquita is fixed-time and pre-locked, so ticking would have *unlocked* it). The beat now just opens the checklist modal, pauses so the viewer reads it, then presses **Confirm & Arrange**.
- **Show the result** (`landing-reel.js`): after the faked confirm + commute seed, the beat now slowly pans down the packed day so the full timeline + transit pills are clearly seen before advancing (previously it "just ended"). Arrange `dur` 32s→38s.

## [2026-05-31] Landing reel: cursor-drive scheduling modal + working Finalize with transit pills

- **Scheduling Preferences is now actually used** (`landing-reel.js` Arrange beat): the cursor opens the modal and moves through real controls — sets day start/end (`#schedDayStart`/`#schedDayEnd`), picks a tour-timing radio (`#schedTourTiming`), nudges the downtime slider (`#schedBreaks`), then clicks **Save** (`#schedulingWizardSave`) — instead of the old JS-only slider poke + cancel.
- **Finalize now does something** (`landing-reel.js`): clicking `#finalizeArrangeBtn` opens the real finalize checklist modal (`#finalizeModal`); the cursor ticks a couple of lock checkboxes (`[data-finalize-check]`), presses Confirm, then the result is **faked** (no `/api/arrange`): the modal is removed and `state.commutes` is seeded so the day "snaps together" with transit pills between stops on re-render.
- **Enabling the Finalize button**: gave `demo-mezquita` a `timing.fixed` so `updateFinalizeBtn` un-disables `#finalizeArrangeBtn` (it requires a fixed-time or verified-checklist activity).
- **Mock data**: added `DEMO_COMMUTES` (driving pills between consecutive Córdoba/Seville stops, `commutePairKey` shape `from->to` with `{selectedMode,modes:{driving:{durationMinutes,modeIcon}}}`). Arrange seeds `commutes:{}` first (pills hidden) → reveals them post-Finalize; step-4 Finalize beat seeds them too. Arrange beat `dur` 16s→32s.

## [2026-05-31] Landing reel: fix card cropping, fill add-activity form, smooth motion

- **No more cropped cards** (`landing-reel.js`): added `scrollIntoFrame(el)` (centers cards taller than the frame, else nudges a cropped card fully into view) and refactored scroll into a shared `scrollToTop`. The Review beat now `focusCard()`s each whole card before interacting, and all button/field taps use `{scroll:false}` so they don't re-scroll and crop the top half. The Replace re-frames the swapped card so the change is visible.
- **Add-activity is now a worked example** (`landing-reel.js`): the demo opens the modal and fills Name ("Cooking class — Andalusian tapas"), Cost ($55), and Why-it-fits (tying back to the setup notes), hovers the Add button, then cancels. `type`/`setValue` gained a `scroll:false` passthrough for centered-overlay fields.
- **Smoother motion** (`landing-reel.js`, `landing-demo.css`): cursor `left/top` CSS transition cut 1100ms→680ms, and `cursorTo` now sets the cursor transition duration to ~85% of the *paced* travel time, so the cursor always lands before the click at any speed (fixes click-before-arrive jitter). Scroll animations respect pause. Review beat `dur` 30s→40s for the longer choreography.

## [2026-05-31] Landing reel: 2× speed toggle + setup-notes/copy tweaks

- **Speed toggle** (`public/index.html`, `public/js/landing-reel.js`, `landing-demo.css`): added a `1×/2×` pill (`#reelSpeed`) in the reel chrome. Replaced the constant `PACE` with `PACE_BASE/speedMult` via a live `pace()` accessor used by every wait, the typing loop, and the progress bar (`beatRawDur * pace()` recomputed in `tick`), so toggling mid-beat speeds everything up cleanly. Button gets `.is-fast` (inverts to navy) at 2×.
- **Setup-notes demo copy** (`landing-reel.js`): the typed trip notes are now structured bullet points modeling high-quality signals (“- I’ve heard a lot about flamenco shows…”, “- I don’t like paella or other seafood”, “- Prefer slow mornings, lively nights”, reservation). Narrator retitled to “Tell it what you actually like.” to coach users toward specific, structured preferences.
- **Copy fix**: “Where will you be sleeping?” → “Where will you be staying?”.

## [2026-05-31] Landing reel: populate blank Review/Arrange/Finalize steps with seeded demo data

- **Root cause**: the reel drives the real app in an iframe (`/planner.html?embed=1`); `initEmbedMode` (app.js) seeded only ONE city and never ran the live AI, so steps 02 (Review) and 03 (Arrange) rendered blank — no activities/days/placements.
- **app.js `initEmbedMode`**: exposed demo-only hooks — `window.applyDemoState(partial)` (`Object.assign` into `state`), plus `window.renderActivities/renderArrange/renderItinerary/replaceActivityInState`. Lets the reel seed mock state and force the genuine render functions without any backend.
- **`public/js/landing-reel.js`**: added a self-contained Andalucía (Córdoba + Seville) mock dataset — `DEMO_CITIES/DEMO_DAYS/DEMO_ACTIVITIES` (real `buildActivityCard` shape), `DEMO_REVIEWED` (Review opener) + `DEMO_REVIEWED_ARRANGED` (all placed stops approved so day columns/itinerary fill, since `renderArrange` only places approved), `DEMO_PLACEMENTS`, and a `REPLACEMENT` activity (seeded `place_id`/`price_level` so `enrichActivity` skips geocode). A `seed(eng, partial)` helper wraps `applyDemoState`.
- **Rewrote 3 beats** (each self-seeds so dot-jumps work):
  - **Step 02 Review**: real cards, then cursor-drives Approve (`.approve`), Decline (`.decline`), notes (`#actNotes-…` + `.save-activity-notes`), a faked Replace (type `.decline-reason` → click `.confirm-replace` → `replaceActivityInState(old, REPLACEMENT)` instead of `/api/activity/replace`), and opens the Add-activity modal (`.add-activity-card` → `#addActivityModalClose`).
  - **Step 03 Arrange**: seeds a pre-arranged calendar (no Draft animation, per request — Draft needs `/api/arrange`), then opens the real Scheduling Preferences modal (`#schedulingWizardBtn`), nudges `#schedBreaks`, closes (`#schedulingWizardCancel`).
  - **Step 04 Finalize**: renders the itinerary day-by-day from seeded state, scrolls it, then highlights the Sync/Share/PDF tools (`#step4 #syncGoogleCalendarBtn`). Stops before the API-bound finalize-confirm.
- Beat `dur` budgets retimed for the longer choreographies (scaled by existing `PACE`). 113/113 tests pass; `node --check` clean on both files. Pending VPS visual verification.

## [2026-05-31] Landing reel: hero CTA target, slower pace, true freeze-on-pause

- **Hero "See how it works" CTA** (`public/index.html`): now anchors to `#reel` (the "see it in motion" reel) instead of `#why`.
- **Reel pacing** (`public/js/landing-reel.js`): added a global `PACE = 1.6` multiplier applied uniformly to `engine.wait()`, the per-keystroke typing delay, and each beat's progress-bar `dur` budget; raised typing baseline 35–70 → 55–105 ms/char. Whole walkthrough is ~60% slower, typing reads calmer, progress bar still tracks (`beatDur * PACE`).
- **Pause/play no longer restarts the beat** (`public/js/landing-reel.js`): introduced an `engine.paused` freeze flag separate from `engine.cancelled` (teardown). `engine.wait()` and the typing loop poll `pumpPause()` and block in place while paused; `tick` slides `beatStart` forward to hold the progress bar. The play button toggles `pause()`/`resume()` (freeze/continue mid-beat) — it no longer calls `goTo`. Split the old `play()`/`pause()` into `start`/`stop` (hard seek/teardown, used by dot-clicks via new `seek(i)` and the IntersectionObserver scroll in/out) vs `pause`/`resume` (in-place freeze, used by the button).

## [2026-05-30] Budget Optimization: fix confirm button + surface budget in lock stage

- **Fixed permanently-greyed confirm button** (`public/app.js`): `transitionToFlipPhase` previously swapped the button `id` and stacked a second listener while never resetting `disabled`, killing the button in the flip phase. Now a single phase-routed click handler in `mountBudgetOptOverlay` dispatches on `budgetOptState.phase` (`lock`→`onConfirmLocks`, `flip`→`onConfirmSelections`); `onConfirmLocks` always resets `btn.disabled`/label after refine calls and, if all refines fail, re-enables with a `showToast` error instead of transitioning to an empty flip phase.
- **Lock-stage budget signal** (`public/app.js`): footer progress bar + label now un-hidden in `enterBudgetOptMode`; `updateBudgetOptProgressBar` is phase-aware — lock phase shows current total cost vs `state.tripBudget` (reusing `computeBudgetLensBreakdown`, green/yellow/red at .6/.9), flip phase keeps selected-vs-original behavior. New `optActivityCost(act)` helper (per-group vs per-person × travelers + 60%/child) shared by the bar and the per-card cost chip.
- **Per-card cost chip**: `faceHtml` renders an `.opt-cost-chip` per face (each flip face shows its own cost); un-gated the previously mobile-only `.opt-cost-chip` style in `public/styles.css`.
- **Image placeholder fallback** (`public/app.js`, `public/styles.css`): activity `<img>` tags rendered `src=""` (or dead URLs) with no fallback, showing browser broken-image chrome + alt text overlapping the card. New shared `activityImgHtml(src, alt, opts)` helper renders a `.activity-img-placeholder` div (ph-mountains icon, paper gradient) for empty src and swaps in the placeholder via `onerror` on load failure. Applied to main activity cards, budget-opt flip faces, and the opt-card expand view.
- **Guard confirmed bookings from optimization** (`public/app.js`, `public/styles.css`): a checked-off (verified) booking-checklist activity could be unlocked and replaced with a cheaper alternative, invalidating an already-confirmed booking. New `isConfirmedBooking(activityId)` matches checklist items with `type==='activity'` and `verified===true`. In the lock stage those cards render a disabled green `ph-seal-check` lock (`.opt-card--booked`) with a "Confirmed booking — can't be replaced" tooltip and no toggle handler; `onConfirmLocks` also excludes them from the unlocked/refine set as defense-in-depth.
- Branch `feature/budget-opt-confirm-and-lock-budget`; pending VPS verification.

## [2026-05-30] Concierge bot: agentic web_search + minimum-sufficient trip context

- **Root-cause fix** for repeated whack-a-mole on chat search. Replaced the regex search-gate and regex query-builder with a model-driven `web_search` tool (`src/services/chatTools.js`: `WEB_SEARCH_TOOL`, `MAX_SEARCH_CALLS=2`, `formatSearchResultsForModel`, `runWebSearch`). New `runChatTurn()` in `src/routes/chat.js` runs a bounded tool loop (reuses `braveSearch.search`); dropped `response_format: json_object`.
- **Deleted dead code:** `HOTEL_PHRASE`/`scopeQueryToTrip`/`accommodationsOf` and the chat-gate debug lines (`src/routes/chat.js`); the `chat_concierge` branch of `shouldUseBrave` + its live/non-live patterns (`src/braveRetrieval.js`); `searchForChat` (`src/braveSearch.js`).
- **Enriched trip context to "minimum sufficient"** (`public/app.js`): `slimCities` now sends `accommodation {address,checkIn,checkOut,lat,lng}` + `arrival {mode,time}`; new `buildActivityDigest` carries cost/booking/coords/why_it_fits/pitfall/insiderTips/alt/durationMin; `buildScheduledDays` uses it (**fixes the long-standing duration bug** — was `a.duration`, always undefined; now `timing.duration_minutes`); approved/declined activities sent as rich digests instead of bare names.
- **Backend serializer** (`src/services/chatPrompt.js`): redesigned `formatCityLine`/`formatScheduleBlock` + new `formatActivityList`/`formatActivityDetail`/`bookingStatus`/`truncate`, with a 25-activity detail cap (token guard). Updated Bucket A guidance to tell the model it has the full itinerary and to call `web_search` with its own address-aware query.
- **Tests:** new `src/services/chatPrompt.test.js` (serializer fields, duration regression, booking status, token guard, parseChatResponse fallback) and `src/routes/chatLoop.test.js` (tool-call loop, 2-search cap, no-search path, Brave-unconfigured). Updated `src/braveRetrieval.test.js` (removed chat_concierge assertions). Broadened test glob to `src/**/*.test.js` in `package.json`. 124/124 pass.

## [2026-05-29] Reorganize "Learned by AI" profile section + fix pill contrast

- **Legibility fix:** `.learned-pref-tag` was defined twice in `public/styles.css`; the later-cascading block painted pills `background: var(--surface)` (= `--ink-900`, near-black) with `color: var(--text)` (= `--text-700`, dark slate) → unreadable dark-on-dark. Consolidated to one canonical rule (light `--paper-2` bg + dark `--text-700` text); removed the redundant earlier re-skin block.
- `public/app.js`: extracted `renderLearnedPrefs()` from `renderPreferencesModal()`. Learned items now **grouped into collapsible topic categories** (Dining & Food, Lodging & Location, Pace & Timing, Activities & Interests, Budget, Other) via a client-side `categorizeLearned()` regex matcher (`LEARNED_CATEGORIES`); unmatched → Other. Added a **search/filter box** (`state.learnedFilter`), per-group collapse state (`state.learnedCollapsed` Set, survives re-render).
- **Inline edit:** each pill gets a pencil button → inline `<input>`; Enter/blur commits, Escape cancels. Edit replaces old text with new in `state.learnedPrefs` and rides the existing `PUT /api/preferences` diff-sync (no backend change). Empty/duplicate/unchanged edits are no-ops.
- **Delete confirm:** the × now gates removal behind the existing `showConfirmDialog(...)` so items can't be deleted by accident.
- `public/styles.css`: added `.learned-search`, `.learned-group*` (collapsible header/caret/count/body), `.learned-pref-edit`, and inline edit-input styles. Confirm dialog reuses `.modal`.
- Frontend-only — no changes to `src/preferences.js`, `src/routes/preferences.js`, `src/memory/store.js`, or the API. 113/113 tests still pass; `node --check public/app.js` clean.

## [2026-05-29] Fix server-side Clerk auth (userId=null) + collapse admin onto Clerk

- **Root cause:** `@clerk/express` v2 exposes `req.auth` as a *function* (`req.auth()`), but the code read it as a property (`req.auth?.userId` → `undefined`). Every authenticated `/api/*` request resolved `userId=null` and silently fell back to the shared `default` bucket. Fixed all read sites: `src/middleware/auth.js` (`getAuthedUserId`), `src/routes/admin.js`, `src/server.js` (debug log), `src/routes/itinerary.js`, `src/routes/status.js`.
- `src/server.js`: added `app.set('trust proxy', true)` and `clerkMiddleware({ authorizedParties })` from new `CLERK_AUTHORIZED_PARTIES` env var (needed behind Traefik). Removed `/api/admin/` from `clerkBypassed` so admin routes get real Clerk verification.
- `src/routes/admin.js`: `requireOwner` now checks `req.auth().userId` against `OWNER_USER_ID` (was a spoofable `?userId=` query param). Routes gated with `requireConfiguredAuth` + `requireOwner`.
- `public/admin.html`: `api()` sends `Authorization: Bearer <token>` (via `Clerk.session.getToken()`) instead of the query param.
- `.env.example`: documented `CLERK_AUTHORIZED_PARTIES`.
- Verified end-to-end on staging: minting `/api/admin/invites` resolves real `userId` and succeeds. 99/99 tests pass.
- Deploy lesson: file-by-file `git checkout <ref> -- <files>` into the prod checkout does **not** restart the Node process; only the `deploy-staging`/`promote` scripts (full `--force-recreate`) actually swap running code.

## [2026-05-28] Engage per-trip memory: plumb `tripId` through all touchpoints

- `public/app.js`: added `tripId: state.currentItineraryId || null` to every relevant POST body — `/api/arrange` (autoArrangeActiveCity), `/api/activity/refine` (onConfirmLocks budget path), `/api/activity/replace` (all 3 call sites), `/api/plan` payload, and `/api/chat/message`.
- `src/routes/chat.js`: now reads `tripId` from the body and uses it for `recall()`/`processChatSignals()` instead of the chat `sessionId`. **Standardizes the canonical trip key** on the itinerary id (`it_...`) across all touchpoints — previously chat keyed memory by its random UUID `sessionId`, which would have fragmented per-trip memory from the other endpoints. `sessionId` still keys chat history only.
- `src/routes/activities.js`: `/api/plan` reads `tripId` and forwards it as the 11th arg to `planCity(...)` (param already added when the layer shipped).
- No changes to `src/memory/*` (treats `tripId` as an opaque scope key). `null` tripId (trip not yet saved) cleanly falls back to user-scoped memory.
- 113/113 tests pass; server boots clean.

## [2026-05-28] Modular agent-memory layer (A-MEM / Mem0-inspired)

- New `src/memory/store.js`: swappable `MemoryStore` (flat-JSON at `/data/memory/{userId}.json`, atomic temp-file write). Record shape `{id, text, type, scope, tripId, keywords, salience, source, createdTs, updatedTs, supersedes}`. CRUD (`loadAll/saveAll/add/update/remove`), `makeRecord`, `trimUserScoped` (caps user-scoped to 30 prefs / 20 constraints), `formatRecords`.
- New `src/memory/reconcile.js`: `reconcile()` — one Claude Haiku 4.5 call returning ADD/UPDATE/DELETE/NOOP ops; gated by the global LLM semaphore; returns `null` (caller falls back to plain dedup'd ADD) when no key / unparseable. `buildPrompt`/`parseOps` are pure and tested.
- New `src/memory/index.js`: `recall()` (sync, no LLM — merges user-scoped + matching-trip records, ranks via `score()` = salience + recency + lexical overlap, returns prompt-ready `.text` incl. profileInstruction) and `observe()` (detached, fire-and-forget — reconciles candidates into the store, never throws). `computeRecords()` is the pure op-application transform (unit-tested).
- `src/preferences.js`: rewritten as a facade over the store. Keeps all exports (+ new `getProfileInstruction`). `profileInstruction` stays in `/data/users/{userId}.json`; preferences/constraints derive from user-scoped store records. `save()` does diff-based sync (preserves learned-record metadata); legacy `{preferences,constraints}` arrays migrate into the store once on first access.
- Read sites wired to `recall()`: `src/claude.js` planCity (+ optional `tripId` param), `src/routes/activities.js` arrange + activity/replace + activity/refine (refine was previously memory-blind), `src/routes/chat.js` (tripId = sessionId).
- Write sites wired to `observe()`: `src/services/chatPrompt.js` `processChatSignals` (chat signals, detached), `src/routes/activities.js` activity/replace (decline signals, detached) and arrange (new feedback pathway — `buildArrangeFeedback` over scheduling-prefs notes + structured prefs, gated on a free-text note to avoid a Haiku call per draft).
- Tests: new `src/memory.test.js` (9 cases: store CRUD, ADD/UPDATE/DELETE/NOOP, user+trip scope merge, query ranking, legacy migration, diff-sync, reset) and `src/memoryReconcile.test.js` (5 cases: parseOps + buildPrompt). 113/113 pass (was 99). Server boots clean.

## [2026-05-27] Invite admin UI + magic invite links

- `public/app.js`: gate now auto-fills + auto-submits when `?invite=ABC` is in the URL; strips the param after success or if already entitled. Added `readInviteCodeFromUrl()` / `clearInviteCodeFromUrl()` helpers.
- New `src/routes/admin.js`: `GET /api/admin/invites`, `POST /api/admin/invites`, `DELETE /api/admin/invites/:code` — owner-only (gated by `OWNER_USER_ID` env var). Mounted before the global `requireEntitlement` so the owner doesn't need to be entitled themselves.
- New `public/admin.html`: minimal browser UI to mint, list, and revoke codes. Shows full invite links so they can be copied and sent. Reuses Clerk for auth.
- `src/entitlements.js`: added `revokeCode(code)`.
- `src/server.js`: refactored Clerk-key HTML substitution into `serveWithClerkKey(filename)`, applied to `/planner.html` and new `/admin.html`.
- Approach: replaces the failed Clerk Backend API token-script attempt. Node isn't on PATH on the VPS, so admin is browser-driven.
- 99/99 tests pass.

## [2026-05-26] Invite-code entitlement gate (replaces failed Basic Auth attempt)

- Removed the HTTP Basic Auth site gate from `src/server.js` — it caused a re-prompt loop in production (reverse proxy likely strips `Authorization` on subresources). Also dropped the `SITE_USERNAME` / `SITE_PASSWORD` env vars from `.env.example`.
- New `src/entitlements.js`: per-user entitlement store backed by `data/invite-codes.json`. Exports `generateCodes(n)`, `listCodes()`, `isEntitled(userId)`, `redeemCode(code, userId)`, `seedOwnerEntitlement(userId)`. Codes are single-use, 8-char base64url uppercase.
- New `scripts/mint-invite-codes.js` CLI: `node scripts/mint-invite-codes.js 10` mints 10 codes; `--owner <clerk-user-id>` seeds owner access without consuming a code.
- `src/middleware/auth.js`: added `requireEntitlement` — 403 `{error:'not_entitled'}` unless the caller has redeemed a code. Bypasses `/api/auth/session`, `/api/auth/entitlement`, `/api/auth/redeem-code` so the redeem screen can do its work.
- `src/server.js`: chained `requireEntitlement` after `requireConfiguredAuth` on `/api`. Public share endpoint (`/api/public/itinerary/:id`) is mounted before both gates and remains open.
- `src/routes/status.js`: added `GET /api/auth/entitlement` and `POST /api/auth/redeem-code`.
- `public/app.js`: after Clerk auth resolves, call `/api/auth/entitlement`. If unentitled, show a full-page overlay with an access-code form. Skip entirely when the URL has `?itinerary=…` so share-link recipients aren't blocked.
- `public/styles.css`: styling for `.entitlement-gate` / `.entitlement-card` overlay.
- 105/105 tests still pass.

## [2026-05-25] Fix accommodation autocomplete dropdown clipping in Setup step

- Bug: in the city Stay tab, the Accommodation address Google Places dropdown was cut off — only the top of the first suggestion was visible.
- `public/styles.css`: removed `overflow: hidden` from `.city-row.gm-city` (line ~3296). The rounded card was clipping the absolutely-positioned `<gmp-place-autocomplete>` dropdown that paints outside the input row.
- Added `position: relative; z-index: 30;` to `.tp-place-autocomplete` so the dropdown stacks above subsequent sibling cards (e.g. trip-health placeholder).
- Removed unused `overflow: hidden` from `.tp-place-autocomplete` / `.city-autocomplete` mobile rules — same clipping concern. `max-width: 100%` is kept to prevent horizontal overflow.

## [2026-05-25] Fix share-link routing — public read-only itinerary endpoint

- Bug: clicking a shared `/planner.html?itinerary=…&mode=itinerary` link dropped recipients on the home/My Trips view. Root cause: frontend hit authed `/api/itinerary/:id` (scoped by ownerId), got 401/404 for anonymous or non-owner viewers, fell through to `renderMyTrips()`.
- `src/itineraryStore.js`: added `getItineraryByIdPublic(id)` — id-only lookup, no userId scope. Exported alongside existing fns.
- `src/routes/itinerary.js`: added `registerPublic(app)` + `toPublicItinerary()` helper. New route `GET /api/public/itinerary/:id` strips owner-private fields (userId, notificationPrefs, issueMeta) before returning.
- `src/server.js`: registered public route before `app.use('/api', requireConfiguredAuth)` so it bypasses auth gate.
- `public/app.js`: extracted `hydrateLoadedItinerary(itinerary)` helper from `loadItineraryById`. Added `loadPublicSharedItinerary(id)` which fetches via the public endpoint and sets `state.readOnlyShare = true`. `maybeLoadSharedItineraryFromUrl()` now uses the public path; the unused `mode` URL param read was removed (always forces itinerary view).
- 99/99 tests still passing.

## [2026-05-25] Rewrite Tianhe suggestion-chip bank — concrete questions, not UX-copy labels

- `public/app.js` `STEP_SUGGESTED_QUESTIONS` (~L8032): replaced all 12 chips. Old bank was 7-of-12 "where is the button" UI-help questions (e.g. "What does the 'leave time' field do?", "Where do I put my hotel address?") — framed Tianhe as a help-doc lookup. New bank reframes chips as *demonstrations* of what Tianhe is good at, using concrete place names (Tokyo / Harajuku / Madrid / Barcelona / Shibuya–Asakusa) as templates users can read, tweak, and submit.
- Each step now mixes itinerary-specific local-knowledge questions with high-value app-explainer questions (genuine feature distinctions like Draft vs. Finalize), not "where is the button" lookups.
- Chip icons now mirror the literal buttons they reference where applicable (e.g. setup "Continue" chip uses `ph-arrow-right` matching the Continue button; arrange "Draft vs. Finalize" chip uses `ph-magic-wand` matching the Draft button).
- 99/99 tests still passing.

## [2026-05-25] Rename concierge bot Concierge/me → Tianhe

- `public/planner.html`: chat header wordmark now `Tian<span class="chat-name-me">he</span>` (mirrors the YunHai `Yun` + italic-serif `Hai` treatment — bot name shares the brand family's typographic pattern). Aria-labels for FAB/panel/close updated to "Tianhe", input placeholder "Ask Tianhe anything…", legal microtext changed from `GUIDEME · …` → `YUNHAI · …`.
- `public/app.js`: `CHAT_WELCOME.headline` → "Hello — I'm Tianhe, your trip concierge." (role kept as the noun, name takes the subject). Per-bubble `.chat-role-label` "Concierge" → "Tianhe" in both welcome and rendered assistant messages. Typing-indicator aria-label updated.
- Dropped the "/me" slash riff — it didn't mirror anything in the new YunHai brand pattern. Internal CSS class names (`.chat-name-me`, `.chat-role-label`) kept as-is.
- 99/99 tests still passing.

## [2026-05-22] YunHai landing page + live-product demo reel

- `public/index.html`: rewrote as the new YunHai marketing landing (nav, hero with animated stage, marquee, demo reel section, pricing with Free + Pro $14.99/mo cards, trust band, FAQ, footer). Replaces the previous Tailwind-CDN landing.
- `public/styles/landing/{tokens,landing,landing-demo,landing-pricing}.css`: copied from `design_handoff_landing/styles/` and namespaced under `/styles/landing/` so they don't collide with planner CSS.
- `public/js/landing-reel.js`: new single-iframe demo engine. 4 beats matching the real app's 4 setup steps (Setup → Review → Arrange → Finalize). Setup is fully scripted with 7 substeps targeting real selectors (`#addCityBtn`, `.city-row:last-child [data-field=…]`, `[data-logistics=…]`, `[data-tab=…]`, `[data-accommodation-field=…]`); other 3 beats are scroll-tours with one narration each. Engine uses `iframe.contentWindow.setStep(n)` to jump between steps.
- `public/planner.html`: title and topbar wordmark renamed `TravelPlanner`/`Guideme` → `YunHai`. Inline `<style>` gained a `body.is-embed` rule set that hides topbar, chat widget, my-trips panel, banners, and save-progress buttons when planner is embedded as an iframe.
- `public/app.js`: `init()` now branches on `?embed=1`. New `initEmbedMode()` skips Clerk, sets `state.authReady=true` and `state.maxStep=4`, mounts the toast host, sets the trip name, and seeds a single Córdoba city as the Setup beat's baseline.
- Demo script honesty: real Cities-step transport-mode select has no Bus option (only flight/train/car/other) — Setup beat uses `train` for arrival and `other` for departure; narrator copy says "ground transit." Marquee relabeled to "Built for travelers who plan with" with aspirational tooling wordmarks instead of fake user logos.
- Branch `feature/yunhai-landing`. 99/99 tests still passing.

## [2026-05-21] Fix Setup city input — freely-typed names now persist

- `public/app.js` `attachPlaceAutocompleteElement` (~L534): bind an `input` listener directly to the shadow-DOM input inside Google's `PlaceAutocompleteElement`. Mirrors typed text into the hidden fallback input and dispatches `input` so the row-level `data-field` handler runs. Google's web component does not bubble shadow input events to its host, so typed text was previously lost unless a suggestion was selected.
- `public/app.js` row-level `data-field="name"` handler (~L2702): re-render the city row via `renderCities()` (and restore focus) when `city.name` flips between empty and non-empty. The expand caret's `disabled` attribute is baked into the row HTML via `cityIsReadyForDetails`, so a re-render is needed to unlock it.
- `public/app.js` city-name `onResolved` (~L2787): also re-render on the empty→filled transition when a Google suggestion is picked.
- `public/app.js` accommodation autocomplete `onInput` (~L2823): persist the freely-typed address (same root cause; no row-level handler for `data-accommodation-field`).
- Branch `feature/setup-city-input-fix`, pushed. 99/99 tests still passing.

## [2026-05-21] Redesign concierge chat widget per design_handoff_concierge spec

- `public/planner.html`: rebuilt `#chatWidget` markup — FAB with halo ripple + glint pulse, expanded panel with avatar (gradient + pulsing ring), Concierge/me identity, ONLINE status row, rotating close button, input pill, send circle, AI legal microtext.
- `public/styles.css`: replaced entire chat CSS block with dark-theme styles using design tokens (`--ink-900` shell, `--paper-0` text, `--accent` blue). Added `chat-msg-welcome`, `.chat-role-label`, `.chat-typing` (3-dot bounce), `.chat-suggestions-label`, `.chat-suggestion-icon`/`text`/`arrow` chip layout, `.chat-input-pill`, `.chat-legal`. Added `prefers-reduced-motion` fallback that disables halo/glint/avatar pulse and replaces morph with 120ms fade. Updated mobile bottom-sheet override to use 22px top radius.
- `public/app.js`: `STEP_SUGGESTED_QUESTIONS` entries are now `{icon, text}` (Phosphor icons per question, 12 total). `renderChatMessages` renders the always-visible welcome bubble (until first message) and uses a separate `.chat-typing` indicator instead of a fake assistant message. `renderChatSuggestions` emits the new chip layout with icon tile + text + arrow and a "TRY ASKING" eyebrow label. `setChatOpen` flips `[data-state]` on the widget (hides FAB) and focuses the input ~320ms after open. New `updateChatSendEnabled` greys the send button when input is empty or while thinking. `bindChatEvents` adds Escape-to-close and input-driven send-button state.
- 99/99 tests still passing.

## [2026-05-21] Teach Concierge Bot how the website works + step-aware suggestion chips

- New `src/services/websiteGuide.md`: high-level, UI-label-only knowledge base covering the 4 steps (Setup / Review / Arrange / Finalize), Trip Health, Booking Checklist, Email Forwarding, Traveler Profile, calendar export, share link, save progress, and a "Not supported" section (no multi-user editing, no booking actions, no dark mode, no two-way calendar sync, no native app, no "pin"). Includes a no-guess directive: bot must propose the closest real feature when the user asks about something not in the guide, never fabricate steps.
- `src/services/chatPrompt.js`: loads `websiteGuide.md` once at module init; new `looksLikeHelpQuestion(message)` heuristic (help phrases + app nouns); `buildChatSystemPrompt` accepts `{ includeWebsiteGuide }` and appends the guide + directive only when set.
- `src/routes/chat.js`: computes `isHelp` per message; bypasses the cached prompt and skips Brave web search on help-shaped messages.
- `public/app.js`: `STEP_SUGGESTED_QUESTIONS` map (3 questions per step) + `renderChatSuggestions()` that renders pill buttons above the chat input, hides once the user has sent a message, and re-renders on step change.
- `public/planner.html`: added `#chatSuggestions` container above `#chatInputArea`.
- `public/styles.css`: `.chat-suggestions` / `.chat-suggestion-chip` matching existing chat styling.
- Tests: 99/99 passing.

## [2026-05-19] Add per-trip Scheduling Preferences wizard for Arrange step

- New module `public/js/schedulingWizard.js`: single-page modal with day start/end times, tour timing radio (morning/afternoon/flexible), lunch/dinner times, breaks-between slider, and notes textarea. Exposes `defaultSchedulingPrefs`, `normalizeSchedulingPrefs`, `openSchedulingWizard`.
- `public/planner.html`: added Schedule button before Draft in `.arrange-actions`, scheduling wizard overlay, and `<script>` include.
- `public/styles.css`: minimal `.sched-*` styling for the new modal fields.
- `public/app.js`: `state.schedulingPrefs` field; `loadSchedulingPrefs`/`saveSchedulingPrefs`/`clearSchedulingPrefs` (localStorage `travelplanner_scheduling_prefs_v1`); hydrate from `itinerary.schedulingPrefs` on load; include in itinerary save payload and incremental save-progress PUT; clear on `resetToFresh`. Draft button auto-opens wizard on first use (gated on `_userConfirmed`).
- `public/app.js`: arrange POST payload clamps `day.windowStart/End` by user prefs **only on non-arrival/non-departure days** (arrival/departure travel-time bounds win); `schedulingPrefs` added to `/api/arrange` request body. Global `getCityDayWindowStart/End` helpers untouched so timeline UI still spans the full day for manual edits.
- `src/routes/activities.js`: `/api/arrange` accepts `schedulingPrefs` and forwards to prompt builder.
- `src/services/arrangePromptDirect.js`: `buildSchedulingPrefsBlock` injects a `SCHEDULING PREFERENCES` block (strong soft constraints) after the PACE line.
- Removed free-text `dayStructure` profile question (superseded by structured wizard): deleted from `public/js/profileWizard.js` `PROFILE_QUESTIONS`, `public/app.js` `WHY_WE_ASK` tooltip, and `src/services/profilePrompt.js` text-question list. No migration of legacy answers.
- Tests: 99/99 pass.

---

## [2026-05-18] Fix Google Calendar sync UX — Finalize button no longer dead

- `public/app.js`: `updateCalendarControls()` no longer gates `syncGoogleCalendarBtn.disabled` on `googleCalendarConnected` — only on `hasItinerary`. The previous gating made the Finalize Sync tile permanently dead because the only path to connect (`connectGoogleCalendarBtn`) is hidden in markup.
- `public/app.js`: `connectGoogleCalendar()` now opens OAuth in a sized popup, polls `/api/calendar/google/status` every 2s (2-min deadline), and auto-invokes `syncGoogleCalendar()` on success. Handles popup-closed and timeout cases.
- `public/app.js`: `syncGoogleCalendarBtnItin` handler now mirrors Finalize — calls `connectGoogleCalendar()` first if not connected, instead of throwing a 401.
- VPS: added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://staging.travelplanner.srv1553531.hstgr.cloud/api/calendar/google/oauth/callback` to staging `.env`. Created OAuth client in Google Cloud (Web application type) with that exact redirect URI; enabled Google Calendar API; added test user to OAuth consent screen (Testing mode).
- Verified end-to-end on staging: popup opens, consent granted, events created in Google Calendar.

---

## [2026-05-18] Custom pointer-driven Arrange drag with 30-min buffer + blocked-range overlay

- `public/app.js`: replaced Sortable.js wiring in `renderArrange()` with delegated pointerdown on `#stagingArea` + `#dayColumns`. New helpers: `bindArrangeDrag`, `startArrangeDrag`, `onArrangePointerMove`, `onArrangePointerUp`, `cancelArrangeDrag`, `renderArrangeBlockedRanges`, `arrangeIsValidDrop`, `arrangeDragDurationMin`, `isActivityLocked`. 15-min snap, 30-min collision buffer. rAF-throttled move + ghost positioning.
- `public/app.js`: removed orphans `nearestLegalSlot`, `paintDropOverlaysForDrag`, `clearDropOverlays`, `getDraggingActivityDuration`, `_arrangeSortables`, `_sortableDragging`, and the `.drop-zone-overlay` markup.
- `public/planner.html`: added `.staging__head` (label + count pill `#stagingCount` + hint). Removed `sortablejs` CDN script.
- `public/styles.css`: appended Arrange drag-overhaul CSS — staging head, day-head pill, `.blocked-layer`/`.blocked-core`/`.blocked-buffer`/`.blocked-out`, `.drop-indicator(.invalid)`, `.drag-ghost`, `.day-grid-wrap.drag-active`/`.drop-target`.
- Day-head now shows count + total-hours pill per column.

---

## [2026-05-18] Make arrival + lodging real locked anchors with full transit + procedural buffers

Replaces the earlier visual-floor hack (which desynchronized y from time). The previous fix's `prevBottom` cascade meant Yoyogi Park 9–10am visually extended to ~12pm. Root cause was deeper: arrival and lodging were never modeled as locked anchors and the procedural arrival buffer (deplaning/customs/baggage) was never enforced.

- `public/app.js renderArrangeTimeline`: reverted the y-floor hack (no more `prevBottom = yAcc + cardH`, no more `topOverride`/`baseYOverride` params, no more `LOGISTICS_STACK_STEP`). Strict y=time invariant restored.
- `public/app.js getLogisticsForDay`: arrival/departure cards now display the **raw flight time** (from `logistics.arrival.time`), and expose `arrivalMode/arrivalInternational/departureMode/departureInternational` for downstream buffer calculations.
- `public/app.js renderArrangeTimeline` accommodation card: now positioned at `flightTime + arrivalBufferMins(mode, international) + commute` (so an intl flight at 09:00 with 28-min commute → 11:43, not 09:28). Symmetric for departure.
- `public/app.js autoArrangeActiveCity`: appends 2–4 synthetic locked anchors per arrange call (`logistics-arrival-<slug>`, `logistics-acc-arrival-<slug>`, `logistics-acc-departure-<slug>`, `logistics-departure-<slug>`) with `type: 'logistics'`. Times derived from `arrivalBufferMins`/`departureBufferMins` + commute. These reach the LLM prompt as `LOCKED:` lines and reach the validator/adjuster as obstacle entries.
- `public/app.js dayPayload`: explicitly sets `arrivalAvailableTime` and `departureMustLeaveTime` per day so `effectiveDayStart`/`effectiveDayEnd` in the validator enforce them.
- `src/services/distanceMatrix.js`: `arrivalAvailableTime` now includes `arrivalBufferMins(mode, international)`; `departureMustLeaveTime` includes `departureBufferMins(...)`. Single source of truth, matches the frontend formula.
- `src/arrangeValidator.js validate()`: outer loop now iterates `days[]` (not just dates with placements) so locked-only days are validated. New `lock_lock_overlap` issue type catches overlapping locked anchors on the same date.
- `src/services/arrangeTimeAdjuster.js adjust()`: same widening — iterates `days[]` so `ADJUSTER_DAY_START` logs even for locked-only days; orphan-date placements (no matching day) handled separately.
- Tests: +1 in `src/arrangeValidator.test.js` (locks-only-day lock_lock_overlap), +1 in `src/arrangeTimeAdjuster.test.js` (locked-only arrival day, no crash, non-arrival day still places normally). 99/99 passing.

End-to-end effect: Yoyogi Park can no longer be scheduled at 09:00 on an arrival day. The LLM sees the arrival + check-in as immovable locks; the validator/adjuster enforce the day's `arrivalAvailableTime` floor; the accommodation card on the timeline shows the realistic check-in-complete time.

---

## [2026-05-18] Fix arrival/accommodation logistics-card overlap on arrange timeline

After Finalize, the arrival logistics card and the accommodation logistics card on the same day visually overlapped (e.g. "Arrive: Hanedakuko" 09:00 vs "1-8 Maihama" 09:28). The commute pill between them was also hidden — buried beneath the accommodation card at the same y-coordinate.

Root cause: `renderArrangeTimeline` in `public/app.js` placed both cards at raw `yFromTime(time)` with no minimum-gap floor between them, while a 28-min commute = ~37 px (PX_PER_HOUR=80) is less than the card height (36 px) + pill height + gap.

- `public/app.js` `makeLogisticsCard`: added optional `topOverride` arg.
- `public/app.js` `makeLogisticsCommuteIndicator`: added optional `baseYOverride` arg.
- `public/app.js` `renderArrangeTimeline` arrival branch: compute `yAcc = max(yFromTime(accArrivalTime), yArr + LOGISTICS_STACK_STEP)`. Seed `prevBottom = yAcc + cardH` so the first activity also can't collide with the accommodation card.
- `public/app.js` `renderArrangeTimeline` departure branch: compute `yAccDep = min(yFromTime(accDepartureTime), yDep - LOGISTICS_STACK_STEP)`. Anchor the prior commute pill above the floored accommodation card.

Constants used: `COMMUTE_PILL_RESERVE = 36`, `LOGISTICS_GAP = 8`, derived `LOGISTICS_STACK_STEP = cardH + 36 + 8 = 80`.

97/97 tests still pass.

---

## [2026-05-15] End-to-end debugLog coverage for activity-creation pipeline

Stop the whack-a-mole pattern of adding one log at a time. Every step in the trip planning, enrichment, persistence, and arrange pipelines now emits debug log lines visible at `/debug?tail=N` (or `/debug?scope=foo`).

New scopes: `plan`, `plan-city`, `places-fetch`, `activity-refine`, `activity-replace`, `itinerary-store`. Existing scopes preserved: `arrange`, `commute`, `commute-matrix`, `dm`, `places-enrich`.

- `src/routes/activities.js` `/api/plan`: `INBOUND` / `DONE` / `ERROR` / `REJECT` lifecycle around the SSE handler.
- `src/claude.js` `planCity`: replaced console.log/error with `plan-city` scope: `START` / `LLM_CALL` / `LLM_RESPONSE` / `PARSE_FAIL` / `RETRY` / `NORMALIZED` (with raw/after-type-filter/after-meal-cap counts) / `ENRICH_CALL` / `RETURN` / `THREW`.
- `src/services/placesEnrich.js` `fetchPlaceDetails`: new `places-fetch` scope on every call — `OK` (with lat/lng/price/source=live|cache) or `FAIL` (reason=HTTP_status / no_place / no_api_key / exception). One line per Places lookup. Cache hits inside `enrichWithPlaceDetails` also emit `OK ... source=cache`.
- `src/routes/activities.js` `/api/activity/refine` + `/api/activity/replace`: `INBOUND` / `DONE` / `ERROR` / `REJECT` lifecycle. `/api/activity/replace` now also calls `enrichWithPlaceDetails` on the normalized result so replacement activities have coords when returned to the client.
- `src/itineraryStore.js`: `SAVE` / `UPDATE` / `GET_LATEST` / `GET_BY_ID` lines under `itinerary-store` scope to disambiguate "trip was just generated" vs "trip was loaded from storage."
- `src/routes/activities.js` `/api/arrange`: defensive city fallback — when `days[0].city` is empty, derive cityName from the dominant `activity.city` value and emit `CITY_FALLBACK` log line; emit `CITY_EMPTY` if no city anywhere.
- 91/91 tests passing.

---

## [2026-05-15] Fix missing activity coords + cache visibility in debug logs

Root cause of `acts_with_coords=0/28` was a taxonomy mismatch: `placesEnrich` only geocoded activities with `type` in a hardcoded allow-list `{meal, nightlife, museum, landmark, market, tour, shopping, sports}`, but the LLM prompt's taxonomy includes `neighborhood` (and the example showed `walk`). Activities outside the allow-list were stored without coords, breaking the cluster/Haversine/matrix pipeline downstream.

- `src/services/placesEnrich.js`: replaced `isVenueActivity` filter with `hasCoords` filter — now geocodes any activity missing `location.lat/lng` regardless of type. Added `MISSING_COORDS_AFTER` debug log naming activities that still failed to resolve.
- `src/claude.js:46`: stale example `"type": "walk"` → `"type": "neighborhood"` (matches the documented taxonomy on line 19).
- `src/services/placesEnrich.test.js`: deleted — tests were orphaned (not picked up by `src/*.test.js` glob) and stale (used `category` field while code reads `type`).
- `src/services/distanceMatrix.js`: `fetchDistanceMatrixDuration` now returns `{ minutes, source }` distinguishing `cache-hit / cache-neg / live-ok / live-fail`. Added `getFastestCommuteWithSource` sibling so callers can tally outcomes; `getFastestCommuteMinutes` preserved as thin wrapper.
- `src/routes/commute.js`: `/api/commute-matrix` now tallies per-source counters and emits `CACHE hits=N neg_hits=N live_ok=N live_fail=N walking_skip=N (total_api=N)` debug line per request. Added `/api/commute` lifecycle logs (`START` / `RETURN` / `ERROR`).
- `src/routes/activities.js`: `/api/arrange` now emits `INBOUND activities=N locked=N days=N city="..."` before validation, catching empty-payload or wrong-city silent failures.
- 91/91 tests passing.

---

## [2026-05-12] Distance Matrix cost: second wave (~10× further reduction) + per-leg pills back live

Layered four optimizations on top of the 2026-05-10 single-mode/dedup work. Expected 60-activity Tokyo trip: ~$9 → ~$2 first arrange, ~$0 on repeats.

- `src/services/distanceMatrix.js`: added `haversineKm`, `getActivityCoords`, `isWalkingDistancePair`, `WALKING_DISTANCE_KM = 1.5`. `getFastestCommuteMinutes` returns `null` for sub-1.5 km pairs before any API call. `getCommuteBetweenActivities` short-circuits sub-1.5 km pairs with a synthetic walking response carrying `isWalkingDistance: true` — no 3-mode Promise.all fires.
- `src/routes/commute.js` `/api/commute-matrix`: refactored to two-phase clustering. `clusterByProximity` greedy first-fit by 2 km centroid distance. All intra-cluster pairs compute exact data; each inter-cluster pair fires one Distance Matrix call (using first member as representative) and fans the minute count out to every member-pair. Circuit breaker now wraps combined intra+inter pair count.
- `src/routes/commute.js` `/api/commute` (per-leg): passes `isWalkingDistance` through to the frontend.
- `src/services/commuteCache.js`: `TTL_MS` 30 days → 365 days.
- `public/js/arrangeView.js` `formatCommuteBadge`: renders `🚶 walk` for `isWalkingDistance: true`. Per-leg pills remain live during drafting.
- 91/91 tests passing.

---

## [2026-05-10] Distance Matrix cost emergency: 5.7× call-volume reduction

User reported 70K Distance Matrix requests on Google Cloud Console after free trial expired. Root cause: `/api/commute-matrix` paid for 3 modes per pair (transit/driving/walking) when only `durationMinutes` (the fastest) was consumed, AND queried both directions of every symmetric pair. For a 60-activity trip: 60×59 ordered × 3 modes = 10,620 calls per arrange click. Five arrange clicks during debugging = ~53K calls.

- `src/services/distanceMatrix.js`: new `getFastestCommuteMinutes(from, to)` — single Distance Matrix call (mode=transit) with one driving fallback only when transit returns no result. Average 1.05 calls per pair vs the previous 3.
- `src/routes/commute.js` `/api/commute-matrix`: switched from `getCommuteBetweenActivities` (3-mode) to `getFastestCommuteMinutes`. Loop now iterates `j > i` (unordered pairs only) and writes the duration in both directions. `MAX_PAIRS_PER_REQUEST = 2000` circuit breaker — if a trip would generate more pairs than the cap, returns `{ matrix: {}, throttled: true }` and Sonnet falls back to no-commute-data scheduling.
- `/api/commute` (per-leg, UI mode-pill display) unchanged — it legitimately needs all 3 modes for the UI dropdowns.
- Combined effect for 60 activities: 10,620 → ~1,860 calls per arrange (5.7× reduction). With cache hits on repeat clicks, near-zero on subsequent runs.
- 91/91 tests passing.

---

## [2026-05-10] Arrange: fix Distance Matrix v2 read; lift commute cap; meal/balance nudges; restaurant generation cap

User report: "289 min walk between @cosme and Omotesando Hills" (they're on the same street), 4 lunches scheduled back-to-back, one day nearly empty while 20 unplaced, too many food activities overall.

- `src/services/distanceMatrix.js`: `resolveCommuteQuery` now reads `activity.location.lat/lng/address` (v2 schema) and falls back to `venue_name + city` before reaching the legacy `start_location`/`end_location` path or the `name + city` last-resort query. Yesterday's removal of `start_location`/`end_location` from the LLM schema left this resolver flying blind on every v2 activity, which is why the @cosme query resolved to garbage geocodes producing the 289-min phantom walks.
- `src/services/arrangePromptDirect.js`: `buildCommuteBlock` no longer caps at top 30 pairs — emits ALL pairs ≥15 min. With ~60 activities, the 30-pair cap was hiding ~95% of long commute pairs from Sonnet, which then defaulted to "walking distance" and stacked geographically distant lunches.
- `src/services/arrangePromptDirect.js` PLACEMENT STRATEGY: added `AT MOST 1 lunch and 1 dinner per day` rule with explicit instruction to move excess meal candidates to unplaced rather than stack. Added `Distribute activities evenly across days` directive — flags the 0–2 vs 8+ imbalance and tells Sonnet to rebalance before reaching for unplaced.
- `src/claude.js`: ACTIVITY COUNT block now says EXACTLY `${minMeals}` meals — no additional food/restaurant activities beyond the meal count. Restaurant block reinforces this: pick `${minMeals}` named restaurants, one per meal slot, do not generate extras. Source of "too many food activities" was Sonnet treating the restaurant research as a list to extract from rather than a list to pick from.
- 91/91 tests passing.

---

## [2026-05-09] Arrange: feed commute matrix into prompt; relax validator

Auto-arrange was returning ~50 of 60 activities as `physics_unresolved` because (1) Sonnet was scheduling without real transit data — the commute matrix was being computed via `/api/commute-matrix`, shipped in the request body, then discarded in `src/routes/activities.js` instead of passed to the prompt builder; (2) the validator added a hardcoded 20-min `MIN_BUFFER_BETWEEN` to every overlap check, fighting dense placements Sonnet (correctly) produced; (3) the cleanup loop dropped both sides of every overlap pair, doubling the unplaced count.

- `src/services/arrangePromptDirect.js`: new `buildCommuteBlock` renders the top 30 pairs with shortest-mode duration ≥15 min into a `COMMUTE TIMES` block, sorted by duration descending. The prompt now tells Sonnet to use these as ground truth and treat unlisted pairs as walking distance.
- `src/routes/activities.js`: pass `matrix` to `buildDirectArrangePrompt` (was previously assigned to a local and ignored). Rewrote the validator-cleanup loop: for each overlap pair, drop only the later-starting one (earlier placements anchor day structure) instead of dropping both.
- `src/arrangeConstants.js`: dropped `MIN_BUFFER_BETWEEN: 20` — kept `DEFAULT_COMMUTE_MIN: 20` (used elsewhere as Distance Matrix fallback).
- `src/arrangeValidator.js`: `overlapsWithBuffer` → `overlaps` (true overlap, no buffer). Removed `bufferBetween` and `venueKey` (same-venue special case is no longer needed). `withinAnyWindow` → `startsWithinAnyWindow` — opening hours check is now "start within window" rather than "fit entirely"; venues seat patrons past listed close.
- `src/arrangeValidator.test.js`: updated assertions for the new contract. Two new tests pin the start-within-window behavior and the no-buffer back-to-back-allowed behavior. 91/91 tests passing (was 90).

---

## [2026-05-08] Right-size activity counts + prompt audit (planning + arrange)

Generation prompt was telling Claude to produce a hard floor of ~72 activities for a 9-day trip with no upper bound, causing the arrange step to receive an over-stuffed payload it couldn't schedule. Prompt also carried legacy noise (5-axis Decision Framework table, redundant `verdict` field, `start_location`/`end_location` for stationary venues, `duration` string + `duration_hours` number for the same data, `dedicated_time_block` derivable from duration) that confuses Sonnet and competes with profile/grounding signal.

- `src/claude.js` SYSTEM_PROMPT — dropped the Decision Framework table; replaced with one-sentence "fit-to-person beats fit-to-tourist-list" + "skip prestige picks when likely to feel flat." Dropped `verdict`, `start_location`, `end_location`, `duration` (string), and `dedicated_time_block` from the schema. Dropped `breakfast` from the type enum (lunch + dinner only). Schema is now ~1/3 shorter.
- `src/claude.js` planCity user prompt — `minMeals` now `2 * tripDays` instead of `3 * tripDays`. Added `maxTotal = round(minTotal * 1.15)` ceiling. Replaced the run-on MANDATORY ACTIVITY COUNT block with a 3-line ACTIVITY COUNT directive: target + range + meal-drop rule for arrival/departure days. Updated restaurantBlock + lockedBlock to drop breakfast and overspecified ordering rules. Reworked shoppingBlock: shopping activities now count *within* the non-meal target, not on top of it.
- `src/claude.js` `normalizeActivity` — `dedicated_time_block` derived from `durationHours >= 2`. Dropped `verdict` field. Address fallback chain widened to `start_location || location?.address || venue_name`.
- `shared/activityMigration.js` — same `dedicated_time_block` derivation; dropped `verdict`.
- `src/services/arrangePromptDirect.js` — softened "look harder for a fit" overcorrection (was calibrated for the over-stuffed case). Replaced explicit "6-8/4-5" density numbers with "4–8 depending on pace" — let Sonnet derive from the pace label two lines above. Removed "increase density before reaching for unplaced" (no longer needed). Removed "would require backtracking" from NOT VALID REASONS (it's already covered as a SOFT PREFERENCE).
- `src/services/calendarIcs.js`, `src/calendarSync.js` — calendar event location now reads `location.address || venue_name` first, falls back to legacy `start_location/end_location` for old itineraries.
- `public/app.js` — removed the LLM-verdict badge from activity card render and the Verdict / Start / End rows from placed-card tooltips. The user-state "verdict" filter (approved/declined/unreviewed) is unaffected — different concept.
- For a 9-day pace-4 trip: floor was 72, now 63 (45 non-meal + 18 meals); ceiling 72.
- 90/90 tests still passing.

---

## [2026-05-08] Insider tips field + shopping vertical

- `src/claude.js`: added `insider_tips` field to SYSTEM_PROMPT schema (1-2 sentences, null when no real tip — "never fabricate"). Added MANDATORY shopping rule (specific store/district/market, tax-free refund + price-vs-home-country guidance for shopping activities). Added `shopping` to allowed type list. `normalizeActivity` and `blankActivity` pass `insider_tips` through. `planCity` now fires `searchInsiderTips` always and `searchShoppingDistricts` conditionally on `profile.answers.shoppingPerson >= 3`; injects `insiderBlock` and `shoppingBlock` (with computed shopping-activity floor of 1-3 across the stay) into the user prompt.
- `src/braveSearch.js`: new `searchInsiderTips(cityName, {year})` and `searchShoppingDistricts(cityName, interests, {year})` — query templates target locals-only travel tips and category-specific shopping respectively.
- `shared/activityMigration.js`: `insider_tips` propagated through legacy migration path.
- `src/arrangeConfig.js`: added `shopping` CATEGORY_HINT regex (shop|shopping|boutique|department store|mall|outlet).
- `public/js/arrangeView.js`: added `shopping: { durationHours: 1.5, openingHours: '10:00-21:00' }` to DEFAULT_ARRANGE_CATEGORY_CONFIG.
- `public/js/profileWizard.js`: added `shoppingPerson` (1-5 dot scale, 7th interest slider) and `shoppingInterests` (text, "fragrance, fashion, vinyl…") to PROFILE_QUESTIONS.
- `src/services/profilePrompt.js`: extended `formatProfileForEnrichment` to include shopping slider + interests so the AI summary regenerates with shopping context.
- `public/app.js`: activity card and expand modal render `insider_tips` with 💡 icon ("Insider tip:" prefix). Finalize modal expanded row shows it too. Review-step search now indexes the field.
- `public/styles.css`: `.activity-insider-tip` accent style (light yellow background, gold left-border, lightbulb icon).
- 90/90 tests still passing.

---

## [2026-04-28] Wave 1: ground opening hours, fix same-venue buffer, parameterize Brave year

- `src/services/placesEnrich.js`: rewritten. New `enrichWithPlaceDetails` (price-tier alias kept for bw-compat) widens the Google Places call to fetch `priceLevel + regularOpeningHours + location` in one round-trip. New `VENUE_CATEGORIES` set extends beyond food to include `museum, gallery, landmark, market, show, shopping, spa, sports, cultural`. Tours/walks/parks/sunsets skipped — they inherit from venues or are open-air. `formatOpeningHoursFromPlaces` converts Places `periods[]` to the `"HH:MM-HH:MM,HH:MM-HH:MM"` string the validator already parses (dedupes across days, clamps overnight close to 23:59). LLM-vs-Places hour mismatches logged as `[places-hours-delta]`.
- `src/services/placesCache.js`: cache value shape widened from `{priceTier}` to `{priceTier, openingHours, location}`. 90-day TTL unchanged.
- `src/services/placesEnrich.test.js`: rewritten — 10 cases covering food/non-food/venue detection plus four Places-period formatting cases.
- `src/arrangeValidator.js`: `overlapsWithBuffer` now takes an explicit buffer argument; new `venueKey()` (lat/lng → venue_name → address fallback) + `bufferBetween()` returns 0 for same-venue pairs and `MIN_BUFFER_BETWEEN` otherwise. Two new validator tests assert same-venue passes and different-venue still fails.
- `src/braveSearch.js`: `searchCityActivities` and `searchTopRestaurants` accept `{ year }`; default to `new Date().getFullYear()`. `src/claude.js` derives `tripYear` from `city.startDate` and threads it through.
- Deleted `src/services/arrangePrompt.js` (dead code, no importers — confirmed via grep).
- `public/app.js`: new `friendlyUnplacedReason()` mapping (`physics_unresolved` → "Couldn't fit into the day without conflicts", plus three other known reasons; unknown reasons pass through).
- 90/90 tests pass (was 88/88, +2 same-venue validator tests).

## [2026-04-27] Strip remaining deterministic scaffolding from arrange

- Deleted `src/arrangeTimeAssigner.js` (~170 lines) and `src/arrangeTimeAssigner.test.js`. The third-tier deterministic fallback in `/api/arrange` is gone — when LLM + repair both fail validation, broken activities now go to `unplaced` with reason `physics_unresolved` instead of being auto-placed by stale rules.
- `src/arrangeConstants.js`: removed `MEAL_BANDS` (was forcing American meal customs globally via opening-hours intersection). Kept `MIN_BUFFER_BETWEEN: 20` and `DEFAULT_COMMUTE_MIN: 20`.
- `src/arrangeValidator.js`: inlined `effectiveDayStart`, `effectiveDayEnd`, `getDuration`, `parseOpeningHours` (previously imported from the deleted assigner). Validator is now fully self-contained.
- `src/arrangeConfig.js`: `inferCategory` now trusts a non-empty LLM-provided `category` directly instead of gating it on the `DEFAULT_ACTIVITY_CATEGORY_CONFIG` keyset. Added `PACE_LABELS` + `paceDescFromValue` exports.
- `src/claude.js` and `src/services/arrangePromptDirect.js` both now import `paceDescFromValue` instead of redefining the same `paceLabels` dict.
- `src/routes/activities.js`: removed `assignTimes` import, the `derivePlansFromPlacements` helper, the `fallbackUsed` telemetry flag, and the unused `minutesFromTime` import.
- 88/88 tests pass (-11 from assigner removal).

## [2026-04-27] Restaurant price tiers + pace-driven activity-count floor

- New `src/services/placesCache.js` — file-backed cache at `data/places-cache.json`, 90-day TTL, debounced flush. Mirrors `commuteCache.js`.
- New `src/services/placesEnrich.js` — `enrichWithPriceLevel(activities, cityName)` calls Google Places Text Search with FieldMask `places.priceLevel,places.displayName`, maps `PRICE_LEVEL_INEXPENSIVE`–`VERY_EXPENSIVE` → `price_tier` 1–4 on food activities (breakfast/lunch/dinner/restaurant/food/cafe/nightlife). Cached + parallelized; failures swallowed.
- `src/claude.js`: `planCity` calls `enrichWithPriceLevel` after normalization. `max_tokens` bumped 16384 → 32768 to fit larger trips.
- `src/claude.js` prompt: replaced vague "proportional to length of stay" line with a hard floor — ≥(`nonMealPerDay × tripDays + 3 × tripDays`) activities, where `nonMealPerDay` is `{1:2, 2:3, 3:4, 4:5, 5:6}` keyed off pace 1–5. Meals counted as activities; partial-day meal-skip allowed when natural meal time falls outside the day's window.
- `public/app.js`: itinerary row builder passes `priceTier` through; card subtitle now renders `address · $$$` when present.
- New test `src/services/placesEnrich.test.js` (3 cases: food detection, non-food rejection, price-level map). Lives in nested dir; not picked up by current `npm test` glob.

## [2026-04-26] Undo arrange hybrid — LLM picks times, validator is physics-only

- New `src/services/arrangePromptDirect.js` — replaces `arrangePromptHybrid.js`. LLM now outputs `{placements: {<id>: {date, time}}}` directly with full judgment over timing; the rule list (H1–H5, S1–S5) is gone. Semantic intent (sunset, nightcap, meal customs) is named as a consideration, not a rule.
- `src/arrangeValidator.js` stripped to physics: overlap, lock_overlap, day window, opening hours. Removed: `meal_cap` and `category_cap` (those were taste, not physics).
- `src/routes/activities.js` `/api/arrange`: three-tier flow — LLM proposes times → validate → one repair pass on physics violations → deterministic `assignTimes` only on still-broken days as a fallback floor. `arrangeTimeAssigner` retained for the fallback path.
- Deleted `src/services/arrangePromptHybrid.js`.
- Tests updated: removed two cap-violation assertions, added an `opening_hours` assertion, added a negative test confirming meal caps are no longer enforced. 99/99 pass.

## [2026-04-26] Phase 5 — Arrange polish

- §1 Intensity alternation: `src/services/arrangePromptHybrid.js` now emits `intensity:<low|medium|high>` per activity and S2 prohibits two consecutive `high`-intensity activities. Soft constraint, no validator change.
- §2 Repair-pass telemetry: new `src/services/arrangeTelemetry.js` (`logRun`, `readRecent`, `summarize`); `/api/arrange` appends per-call entries to `logs/arrange.jsonl` (`firstPassValid`, `issues`, `repairUsed`, `secondPassValid`, counts). New `GET /api/admin/arrange-stats` gated by `ADMIN_TOKEN` env + `x-admin-token` header (404 when env unset).
- §3 Distance Matrix caching: new `src/services/commuteCache.js` — file-backed cache at `data/commute-cache.json`, keyed by `(origin|destination|mode)`, 30-day TTL, debounced flush. `fetchDistanceMatrixDuration` checks the cache before calling Google and writes back on success.
- §4 Unplaced recovery UI: `state.arrangeUnplaced[city]` holds structured `{id, name, reason}` items. `renderArrangeDiagnostics` (in `public/app.js`) renders an "Unplaced (N)" chip in the arrange header; clicking opens a panel; clicking an item scrolls the matching staging card into view and flashes it. CSS in `public/styles.css`.
- `.gitignore`: added `logs/`.

## [2026-04-26] Phase 4 — Hybrid arrange scheduler

- New: `src/arrangeConstants.js` (MIN_BUFFER_BETWEEN, DEFAULT_COMMUTE_MIN, MEAL_BANDS).
- New: `src/arrangeTimeAssigner.js` — deterministic time assignment from per-day `ordered_ids`. Handles opening hours, meal bands, locked occupied intervals, commute matrix lookups, day window bounds.
- New: `src/arrangeValidator.js` — validates overlaps, lock overlaps, day window, meal cap (≤1 per breakfast/lunch/dinner), non-meal category cap (≤2).
- New: `src/services/arrangePromptHybrid.js` — `buildHybridArrangePrompt` (ordered_ids only, no times) + `buildRepairPrompt`.
- New: `POST /api/commute-matrix` in `src/routes/commute.js` — N×N matrix using existing `getCommuteBetweenActivities`, batched concurrency 6.
- Rewrote `POST /api/arrange` in `src/routes/activities.js` to hybrid flow: build prompt → Claude → sanitize → assignTimes → validate → single repair pass on failure → respond with `{placements, unplaced, diagnostics}`.
- Client (`public/app.js`): `autoArrangeActiveCity` now POSTs to `/api/commute-matrix` first, includes the matrix in the `/api/arrange` body, and surfaces `diagnostics` alongside `unplaced`.
- Tests: `arrangeTimeAssigner.test.js` (12 cases), `arrangeValidator.test.js` (6 cases). 99/99 pass.
- CLAUDE.md updated: trust-the-LLM-for-scheduling decision replaced with hybrid-scheduling description.

## [2026-04-25] Fix six booking-checklist and arrange-step bugs

- **Location revert**: `buildChecklistFromState` was unconditionally overwriting `activityLocation` with the derived value on every rebuild. Fixed with `items[idx].activityLocation || item.activityLocation` to preserve user edits.
- **Price not saving**: Same root cause — `budgetUsd` was overwritten on every rebuild. Fixed with `items[idx].budgetUsd ?? activityEstimatedCost` so user-entered prices survive rebuilds.
- **Declined items in checklist**: `buildChecklistFromState` included all approved activities but never filtered out ones subsequently declined. Fixed by adding `.filter` that removes items where `state.reviewed[id]?.approved === false`; `renderArrange` also clears `state.placements[id]` immediately on decline.
- **Finalize overlap**: After lock override pass, LLM could still place flexible activities overlapping locked ones. Fixed by running `hasOverlapInDay` on each flexible placement after locks are applied and bumping conflicting ones.
- **Cross-city placement (Granada in Seville)**: `renderArrange` matched `placement.dayId === d.id` without a city check, allowing an activity assigned to Granada to render in Seville's column. Fixed with `cityMatches(a.city, d.city)` guard; `autoArrangeActiveCity` also sweeps and clears cross-city placements on entry.
- **City date order**: Booking checklist groups and the Review step city-filter dropdown were sorted alphabetically. Both now use `state.cities` index order (trip date order).
- Files: `public/app.js`

---

## [2026-04-25] Phase 3 frontend modularization — arrangeView extracted (final module)

- `public/js/arrangeView.js`: new module (230 LOC). Holds pure helpers and constants for the arrange step: `DAY_START_HOUR/END/PX_PER_HOUR/GRID_HEIGHT`, `DEFAULT_ARRANGE_CATEGORY_CONFIG`, `COMMUTE_MODE_ORDER/LABEL`, `expandDays`, `daysMatchCities`, `getArrangeCategoryDefaults`, `inferActivityCategory`, `parseDurationHoursFromText`, `normalizeActivityMetadata`, `parseOpeningWindows`, `formatDuration`, `formatDurationHoursLong`, `formatTypeLabel`, `commutePairKey`, `resolveSelectedCommuteMode/Details`, `formatCommuteBadge`, `normalizeCommuteStateMap`, `timeFromY`, `yFromTime`, `rangesOverlap`, `citySlug`, `logistics*Id` builders.
- `public/app.js`: 8208 → 8028 LOC. Removed those helpers; kept thin wrappers for `getArrangeCategoryDefaults` / `inferActivityCategory` / `normalizeActivityMetadata` that bind `state.arrangeConfig` and `actPreferredTime` / `actDurationHours`. All DOM-rendering, event-binding, and state-mutating functions (`renderArrange`, `makePlacedCard`, `bindPlacedCardInteractions`, `autoArrangeActiveCity`, `openFinalizeModal`, `getIncomingCommuteForActivity`, etc.) intentionally kept in `app.js` per the Phase 3 hard rule (extract only single-state-slice helpers).
- `public/planner.html`: added `<script src="/js/arrangeView.js">` before `app.js`.
- 82/82 tests pass.

---

## [2026-04-25] Phase 2 backend modularization complete

- `src/server.js`: 1837 → 51 lines. Now only Express setup, middleware mounts, route registrations, and `listen` guard.
- Services extracted (`src/services/*`): `calendarIcs.js`, `imageQuery.js`, `profilePrompt.js`, `chatPrompt.js`, `distanceMatrix.js`, `arrangePrompt.js`, `tripHealthEmail.js` (plus pre-existing `bookingLinks.js`).
- Middleware extracted (`src/middleware/*`): `auth.js`, `llmSemaphore.js`, `nominatim.js`, `attachmentUpload.js`.
- Routes extracted (`src/routes/*`): `status.js`, `email.js`, `geocode.js`, `attachments.js`, `activities.js` (plan/activity/arrange/places), `image.js`, `commute.js`, `preferences.js` (preferences/userdata/profile/enrich), `chat.js`, `itinerary.js`, `calendar.js`. Each exports `register(app)`.
- `shared/timeHelpers.js`: new dual-export module (CJS + browser global) for `parseTimeTo24`, `minutesFromTime`, `timeFromMinutes`, `extractTimeFromDateTime`. Replaces the duplicated copies in `public/app.js` and `src/services/distanceMatrix.js`. Wired into `planner.html` ahead of `app.js`.
- All 82 tests pass; server boots clean after each commit; route ordering around the auth gate preserved.

---

## [2026-04-24] Fix Phase 1 runtime errors found during smoke testing

- `shared/arrangeBuffers.js` + `shared/arrangeArrivalBuffers.js`: wrapped each file in an IIFE to prevent `const _exports` top-level collision when both are loaded as `<script>` tags on the same page
- `public/app.js`: moved `overlayManager.register('activityMapOverlay', ...)` from line 8 (before the `let` declaration) to immediately after `let activityMapOverlay = null` at line 251, eliminating temporal dead zone ReferenceError

---

## [2026-04-24] Phase 1 repo cleanup — dedup + safety net

- Consolidated byte-equivalent client/server duplicates into `shared/`: `arrangeBuffers.js`, `arrangeArrivalBuffers.js`, `activityMigration.js` (6 files → 3; dual CJS/window exports). Server and `/shared/*` static route added. `planner.html` script srcs updated.
- Wired `public/js/statePersistence.js`: 5 localStorage JSON load/save sites in `public/app.js` (geocode cache, places cache, minimal offline store, chat session map, snapshot) now route through `persist.loadJson` / `persist.saveJson`.
- Wired `public/js/overlayManager.js`: registered 11 modals (prefsModal, checklistModal, budgetOptOverlay, addActivityModal, activityMapOverlay, attachmentViewerModal, textareaExpandModal, myTripsPanel, planningOverlay, confirmDialog); show/hide routed through `overlayManager.open/close`. `refreshOverlayInterlocks()` now delegates to `overlayManager.refresh()`. Added `body.overlay-active { overflow: hidden }` to `public/styles.css`.
- Deleted unused `public/js/apiService.js` (`apiFetch` in app.js is canonical).
- Server dedup: collapsed `pickFirstAccommodation` + `pickLastAccommodation` → `pickAccommodation`. Extracted booking-link URL builder to `src/services/bookingLinks.js` (used by `/api/activity/refine` and `/api/plan`).
- Smoke harness: `src/server.smoke.test.js` covers all 42 `/api/*` routes (assert !== 404). Added `supertest` devDependency. `server.js` now exports app and guards `listen` behind `require.main === module`.
- Fixed stale requires in `src/claude.js` and `src/itineraryStore.js` pointing at old `./activityMigration` path.
- Tests: 82 passing.

---

## [2026-04-23] Rename "confidence" → `bookingChecklist` + `tripHealth`

- Renamed `src/confidenceCheck.js` → `src/tripHealth.js`; `computeConfidence()` → `computeTripHealth()`; `src/confidenceCheck.test.js` → `src/tripHealth.test.js`
- Renamed `public/confidence.css` → `public/tripHealth.css`; CSS classes `.confidence-badge` → `.trip-health-badge`, `.confidence-popover` → `.trip-health-popover`, `.confidence-issue-card` → `.trip-health-issue-card`, `.confidence-issue-actions` → `.trip-health-issue-actions`
- `src/itineraryStore.js`: `updateItineraryConfidence()` → `updateBookingChecklist()`; persisted field `itinerary.confidence` → `itinerary.bookingChecklist`
- `src/server.js`: routes `/api/itinerary/:id/confidence` (GET/PUT) → `/api/itinerary/:id/trip-health`; `/confidence/email-summary` → `/trip-health/email-summary`; response key `{confidence}` → `{tripHealth}`; `sendConfidenceSummaryEmail()` → `sendTripHealthSummaryEmail()`
- `public/planner.html`: DOM ids renamed (`confidenceBadge` → `tripHealthBadge`, `confidencePopover*` → `tripHealthPopover*`, `openConfidenceReviewBtn` → `openTripHealthReviewBtn`, `confidenceSummary` → `tripHealthSummary`, `confidenceIssues` → `tripHealthIssues`, `confidenceChecklist` → `bookingChecklist`)
- `public/app.js`: state keys (`state.confidence` → `state.tripHealth`, `state.confidenceChecklist` → `state.bookingChecklist`, `state.confidenceNotificationPrefs` → `state.bookingChecklistNotificationPrefs`, `state.confidenceIssueMeta` → `state.bookingChecklistIssueMeta`, `state.confidenceIssueSignatures` → `state.tripHealthIssueSignatures`); functions `computeConfidenceLocal` → `computeTripHealthLocal`, `renderConfidence`/`renderConfidenceBadge` → `renderTripHealth`/`renderTripHealthBadge`; PUT/snapshot payload keys updated; deleted dead `#saveConfidenceBtn` listener (no matching DOM element)
- `CLAUDE.md`, `PROJECT_NOTES/architecture.md`: updated to reference new module/route/field names
- Per debug-mode policy, no migration shim; legacy `itinerary.confidence` records will silently lose their checklist on next save

## [2026-04-23] Checklist persists via main snapshot save

- `public/app.js` `saveSnapshot()`: PUT `/api/itinerary/:id` body now includes `bookingChecklist: { checklist, notificationPrefs, issueMeta }` so checklist edits persist through container restarts (no longer reliant on the dead `saveConfidenceBtn` handler)

## [2026-04-23] Persist arrange-step commutes across save/reload

- `public/app.js` `saveSnapshot()`: PUT `/api/itinerary/:id` body now includes `commutes: state.commutes` so transit cards survive a server-side save
- `public/app.js` `loadItineraryById()`: hydrates `state.commutes` from `itinerary.commutes` via `normalizeCommuteStateMap`; removed legacy fallback that rebuilt `activities`/`reviewed`/`placements` from `itinerary.days[]` (debug-mode cleanup, no legacy itineraries to support)

## [2026-04-23] Checklist activity end-time field

- `public/app.js` — added `activityEndTime` to checklist activity schema (normalizer, save handler, edit form input next to start time)
- `public/app.js` — `checklistActivityEndTime()`: prefers user-entered `activityEndTime` over derived duration
- `public/app.js` — `openFinalizeModal()`: propagates checklist end-time override into modal row (`endOverride`), used by `deriveEndTime`
- `public/app.js` — Finalize Confirm writes modal end-time back to the checklist item
- `public/app.js` — `autoArrangeActiveCity`: `lockedActivities.duration_minutes` now derived from modal start/end instead of raw activity duration, so server `ALREADY OCCUPIED` block matches user intent

---

## [2026-04-21] Phase 3: Finalize Modal + time locks

- `public/app.js` — added `state.lastFinalizeLocks` field
- `public/app.js` — `findLockedOverlaps(locked)`: overlap detector for the modal's live validation
- `public/app.js` — `openFinalizeModal()`: full Finalize modal — activity rows grouped by day, checkboxes, inline time picker, lock icons, live conflict banner, Confirm handler
- `public/app.js` — Finalize button now calls `openFinalizeModal()` instead of showing "coming soon" toast
- `public/app.js` — `autoArrangeActiveCity(opts={})`: accepts `finalize` + `lockedSet`; partitions into locked/flexible; skips LLM if all activities locked; merges locked placements client-side after fetch; stores/clears `lastFinalizeLocks`
- `public/app.js` — `makePlacedCard`: shows `placed-lock-badge` and `placed-card--locked` class for locked activities
- `public/app.js` — `bindPlacedCardInteractions`: mousedown guard blocks drag on locked cards with toast
- `src/server.js` — `/api/arrange`: accepts `lockedActivities` array; injects `ALREADY OCCUPIED` lines into daysText; adds rule 2a; defensively drops locked IDs from LLM placements
- `src/findLockedOverlaps.js` + `src/findLockedOverlaps.test.js`: server-side module + 7 unit tests (all passing)
- `public/styles.css` — `.placed-lock-badge`, `.placed-card--locked`, finalize modal styles
- `npm test`: 40/40 passing

## [2026-04-20] Checklist save fix + arrive-early buffer + Draft/Finalize buttons

- `public/app.js` — added `syncChecklistDateTimeToPlacement`: writes checklist date/time edits back to `state.placements` before the `buildChecklistFromState` rebuild (fixes silent save bug)
- `public/app.js` — `syncItemFromExpanded`: calls `syncChecklistDateTimeToPlacement` alongside existing notes sync
- `public/app.js` — `autoArrangeActiveCity`: merges `state.reviewed[id].notes` into each activity as `user_notes` for the arrange payload
- `src/arrangeArrivalBuffers.js` + `public/js/arrangeArrivalBuffers.js`: new `showUpEarlyMins(bookingType)` helper (15 min for tour/attraction, 0 otherwise)
- `src/arrangeArrivalBuffers.test.js`: 6 unit tests, all passing
- `src/server.js`: `activityForPrompt` now exposes `booking_type` and `user_notes`; activitiesText emits `arrive:N min early (ticketed)` and `USER NOTE` lines; two new RULES (10, 11)
- `public/planner.html`: renamed Auto-arrange button to "Draft"; added "Finalize" button (disabled by default); loads `arrangeArrivalBuffers.js`
- `public/app.js` — `updateFinalizeBtn`: enables Finalize when ≥1 verified checklist activity or `timing.fixed` activity exists in active city; called from `renderArrange` and checklist Save
- `public/app.js` — Finalize button shows "coming soon" toast until Phase 3 ships

## [2026-04-20] Phase 2: transport mode + arrival/departure buffers

- `src/arrangeBuffers.js`: new module with buffer tables and `arrivalBufferMins`/`departureBufferMins` helpers
- `public/js/arrangeBuffers.js`: client mirror of above (plain script); loaded via `planner.html`
- `src/arrangeBuffers.test.js`: 5 unit tests, all passing
- `public/app.js` — `normalizeCityLogistics`: coerces `mode` (default `'flight'`) and `international` (default `true`) on arrival/departure
- `public/app.js` — city drawer: added mode `<select>` and international `<checkbox>` per logistics row; intl toggle hides/shows based on flight selection
- `public/app.js` — `autoArrangeActiveCity`: applies mode-based arrival/departure buffers on top of transit commute; Distance Matrix failure uses mode-aware fallback + surfaces diagnostic toast; same-day arrival+departure with no schedulable window aborts with warning

## [2026-04-19] Replace Brave price scraping with Google Places for pins and price signal

- `src/server.js`: dropped `searchActivityPricesBatch` / `searchActivityPrice` imports; removed Brave price enrichment branches in `/api/plan` (~L1113) and `/api/activity/refine` (~L891); added `/api/places/resolve` endpoint (Google Places "Find Place From Text" proxy) with in-memory LRU cache (max 500)
- `src/braveSearch.js`: removed `parseFirstPrice`, `searchActivityPrice`, `searchActivityPricesBatch`, and the `CURRENCY_TO_USD` constant
- `src/claude.js`: added required `venue_name` field to the SYSTEM_PROMPT activity schema and example; `normalizeActivity` now emits `venue_name`, auto-backfilled for meals as `"<name>, <city>"`
- `public/app.js`: added `resolvePlace()`, `priceLevelBadge()`, `representativeCostUsd()`, `renderActivityCostCell()`, and `stripMealPrefix()` helpers; reordered `geocodeActivity` candidates so `venue_name` wins over `start_location`; bumped `GEO_CACHE_KEY` → `_v2` to flush stale pins; added `PLACES_CACHE_KEY` localStorage cache; activity/opt cards now show `$`–`$$$$` badge or GetYourGuide link instead of numeric estimate; budget rollup seeds via `representativeCostUsd` keyed off `price_level` / booking type; removed the now-unused cost-per-person numeric input editor on activity cards

## [2026-04-18] Itinerary view overhaul (formerly "Execution" mode)

- `public/planner.html`: renamed `#executionModeBtn` → `#itineraryModeBtn` (text "Execution" → "Itinerary"), `#executionModeView` → `#itineraryModeView`, all child IDs/classes; added `#attachmentViewerModal`, `#attachmentFileInput`
- `public/styles.css`: renamed all `.execution-*` → `.itinerary-mode-*`; added `.itinerary-item` card layout, `.itinerary-item-head`, `.itinerary-title`, `.itinerary-time`, `.itinerary-subtitle`, `.itinerary-notes`, `.itinerary-reference`, `.itinerary-file-actions .btn-ghost`, `.attachment-viewer-card`, `.attachment-row`; renamed `body.execution-mode` → `body.itinerary-mode`
- `public/app.js`: renamed DOM refs, functions (`getExecutionRows` → `getItineraryRows`, `renderExecutionMode` → `renderItineraryMode`, etc.); rewrote card render to show name + time range, location subtitle, notes, reference # with `ph-bold ph-ticket`, Upload/View buttons with `ph-bold ph-upload-simple`/`ph-bold ph-folder-open`, Navigate link with `ph-bold ph-navigation-arrow`; added `formatTimeRangeLabel`, `getActivityReferenceNum`, `uploadActivityAttachments`, `openAttachmentViewer`, `renderAttachmentViewerList`, `deleteAttachment`; updated `formatChecklistDate` to accept optional end time; added `checklistActivityEndTime` to derive end from `duration_hours`; backward-compat for old `mode=execution` share links and `localStorage` value
- `src/attachmentStore.js`: new module — `saveAttachment`, `getAttachmentFile`, `listAttachments`, `deleteAttachment` backed by `/data/attachments/{userId}/manifest.json` + flat files
- `src/server.js`: 4 new routes — `POST /api/itinerary/:id/activity/:actId/attachments`, `GET /api/itinerary/:id/activity/:actId/attachments`, `GET /api/attachments/:attachmentId`, `DELETE /api/attachments/:attachmentId`; multer 2.x with 10 MB limit + MIME allowlist
- `package.json`: added `multer@^2`

## [2026-04-17] My Profile — stale AI summary on profile deletion

- `public/app.js` `deleteActiveProfile()`: added `state.learnedPrefs = null` and `POST /api/preferences/reset` call on deletion so the old AI-generated summary is wiped from both memory and the server file before the forced wizard opens
- `public/styles.css`: fixed profile icon visibility — `#profileMenuBtn` now has `color: var(--text-on-dark)` (eggshell white) and `font-size: 1.5rem`; replaced undefined `var(--text-primary)` with `var(--text)` (#1E293B) in dropdown item and email styles so text is legible on white background

## [2026-04-17] My Profile — UI consolidation, question layout fix, single-profile enforcement

- `public/planner.html`: replaced `#authControls` div + `#preferencesLink` text button with `#profileMenu` (icon + dropdown); dropdown contains Account Information (email), My Profile, red Sign Out
- `public/planner.html`: removed `profile-selector-row` (profile dropdown, name input, New Profile button); moved save button (`#profileEditBtn`) into modal title row alongside close button
- `public/styles.css`: added profile menu dropdown styles (`.profile-menu`, `.profile-menu-dropdown`, `.profile-menu-account-info`, `.profile-menu-signout`, etc.); added `.modal-header-actions`
- `public/styles.css`: `.profile-question` changed from flex-row to `flex-direction: column` — question label now stacks above textarea/dot-scale on all question types; removed `flex: 1; min-width: 0` from `p`; removed `flex-shrink: 0` from `.dot-scale-wrap`
- `public/app.js` `els`: removed `authUserLabel`, `profileSelector`, `profileNameInput`, `newProfileBtn`; added `profileMenu`, `profileMenuBtn`, `profileMenuDropdown`, `profileMenuEmail`, `profileMenuMyProfile`
- `public/app.js` `renderAuthUi()`: rewritten to toggle `#signInBtn`/`#profileMenu` visibility and populate `#profileMenuEmail`
- `public/app.js` `defaultProfilesStore()`: now returns `{ activeId: null, profiles: [] }` — no auto-created default profile
- `public/app.js` `normalizeProfilesStore()`: empty profiles returns `{ activeId: null, profiles: [] }` instead of calling `defaultProfilesStore()`
- `public/app.js` `renderPreferencesModal()`: early return if `store.profiles` is empty; removed profile selector/name/newProfile logic; delete button always enabled
- `public/app.js` `openProfileWizard()`: added `{ forced }` option — hides cancel button and ignores Escape when forced; suggested name simplified to `'My Profile'`
- `public/app.js` `deleteActiveProfile()`: removed single-profile guard; deletes to empty store, closes modal, opens forced wizard
- `public/app.js` `openPreferencesModal()`: redirects to forced wizard if no profiles exist
- `public/app.js` `initClerkAuth()`: after `syncFromServer`, opens forced wizard if `store.profiles` is empty
- `public/app.js` event listeners: replaced `preferencesLink` click with profile menu dropdown toggle + `profileMenuMyProfile` click; removed `profileSelector` change and `newProfileBtn` click listeners

## [2026-04-17] Trip Health overhaul — misinput double-checker

- `public/app.js` `normalizeChecklistItem()`: added `arrivalDate`, `arrivalTime`, `returnArrivalDate`, `returnArrivalTime` to transportation item shape
- `public/app.js` transportation checklist form: added arrival date/time inputs (and return arrival for round-trips) in 2-column layout alongside departure fields
- `public/app.js` `collectChecklistFields()`: collects four new arrival time fields on save
- `public/app.js` `computeConfidenceLocal()`: fully replaced — Check A runs always on all booking-required items detecting transport↔transport, transport↔activity, activity↔activity, accommodation↔accommodation overlaps using absolute-minute arithmetic (handles cross-day flights); Check B runs only on verified items flagging missing `referenceNum`; status: Conflicts found > Missing details > Ready > Needs review
- Previous Trip Health checks (missing times, suspicious gaps, city date gaps) removed — scope tightened to misinput double-checker only

## [2026-04-17] Budget Tracker + Trip Health UX fixes

- `public/confidence.css`: hardcoded popover colors (`#FAF8F5` bg, `#1E293B` text) to fix invisible text (was inheriting dark topbar var)
- `public/planner.html`: removed `#openChecklistBtn` from Trip Health popover; added `id="tripHealthSection"` to inline panel
- `public/app.js`: "Open Trip Health" button now calls `setStep(4)` + `scrollIntoView` on `#tripHealthSection` via `requestAnimationFrame`
- `public/app.js` `renderBudgetTracker()`: renamed "Budget Lens" → "Budget Tracker"; removed "$XXX over" text; replaced caveat text with info icon + tooltip; added border around progress bar
- `public/styles.css`: budget tracker two-row layout with bordered progress bar; info icon tooltip styles

## [2026-04-16] Budget Optimization flow

- `public/planner.html`: added `#budgetOptOverlay` mount point (fixed overlay)
- `public/app.js`: `budgetOptState` module-level variable; "Optimize" button injected into Budget Lens bar
- `public/app.js`: 9 new functions — `exitBudgetOptMode`, `mountBudgetOptOverlay`, `enterBudgetOptMode`, `buildBudgetOptCard`, `renderBudgetOptCards`, `onConfirmLocks` (batch `/api/activity/refine` with `budget_target`), `transitionToFlipPhase`, `updateBudgetOptProgressBar`, `onConfirmSelections`
- `public/styles.css`: full overlay styles — lock/flip icon buttons, 3D flip card faces, sticky progress footer
- No backend changes — existing `/api/activity/refine` with `budget_target` param handles batch refinement

## [2026-04-16] Named restaurant recommendations with must-order dishes

- `braveSearch.js`: added `searchTopRestaurants(cityName)` — focused Brave query for top restaurants + must-order dishes, 7 results per city
- `claude.js`: fires `searchTopRestaurants` in parallel with `searchCityActivities`; injects results as dedicated `restaurantBlock` in the planning prompt
- `claude.js` system prompt: added MANDATORY RULE — all food/breakfast/lunch/dinner activities must name a specific restaurant; `why_it_fits` must mention 1–2 must-order dishes; `booking_type: "none"` banned for meal types

## [2026-04-16] Fix Budget Lens and Booking Checklist population

- `buildChecklistFromState`: removed `booking_type` filter (was `tour`/`attraction` only) and placement gate — all approved activities now enter the checklist regardless of type or whether they've been arranged
- `buildChecklistFromState`: placement is now optional — falls back to `a.city` for location and empty string for date when no placement exists yet
- `buildChecklistFromState`: merge now always overwrites `budgetUsd` from live `activityEstimatedCost` (was `??` which kept stale prices after activity refinement)
- Activity cards: per-person cost rendered as inline editable `<input>` — blur/Enter commits new value to `state.activities`, updates `= $total` display, and refreshes Budget Lens
- Approve/decline card handlers now call `renderBudgetTracker()` so Budget Lens updates on single-card toggles
- Files: `public/app.js`, `public/styles.css`

## [2026-04-16] Modify vs Replace split on activity cards

- `/api/activity/refine` upgraded: switched from `claude-haiku-4-5` to `gpt-5.4-mini` (via OpenAI SDK); terse reasoning-reliant prompt; unconditional `search()` grounding when Brave is configured; accepts optional `budget_target` for budget-optimization path; `ACTIVITY_REFINE_MODEL` constant added
- Frontend card markup: single shared textarea placeholder updated to "Tweak or replace this activity…"; single `confirm-decline` button replaced with `confirm-modify` (pencil icon, Modify) + `confirm-replace` (arrows icon, Replace)
- `confirmModify` handler: POSTs to `/api/activity/refine`, merges `{ updates }` into existing activity preserving `id`, calls `renderActivities()`
- `confirmReplace` handler: renamed from `confirmDecline`, unchanged behavior → `/api/activity/replace`
- Expanded modal (`openCardExpand`) updated identically — picks up new markup via innerHTML clone, handlers re-wired
- All 11 existing tests pass
- Files: `src/server.js`, `public/app.js`

## [2026-04-16] Fix AI-generated summary disappearing in My Profile

- Bug 1: `profileChanged` always false — slider dot-click handler mutates `state.profile` live, so by save time `prev === state.profile` already had new values, skipping enrich. Fix: capture `profileSnapshot = JSON.stringify(state.profile)` when modal opens; compare `next` against parsed snapshot in save handler; update snapshot after each save.
- Bug 2: `GET /api/preferences` on every modal open could silently overwrite in-memory `profileInstruction` with empty string (server returned `profileInstruction: ''` for unknown reason — likely race or stale write). Fix: merge incoming prefs, keeping existing `state.learnedPrefs?.profileInstruction` if server returns empty.
- Files: `public/app.js`

## [2026-04-16] Unified preference system rewrite

- `src/preferences.js` rewritten: removed `signals`, `liked`, `disliked`, `distilledProfile`, `signalsSinceDistill`, `tokenize`, `topFrequent`, `deriveSummaries`, `recordSignal`, `needsDistillation`, `distill`. New shape: `{ profileInstruction, preferences, constraints }`
- `getSummary()` now takes `userId` only — single path, no branching on distillation state
- `src/server.js`: removed `POST /api/preferences/signal` endpoint; removed `recordSignal`, `needsDistillation`, `distillProfile` imports; `PUT /api/preferences` now accepts `profileInstruction`; `/api/profile/enrich` saves generated instruction server-side; `/api/activity/replace` extracts `preferences`/`constraints` arrays from LLM response instead of `signals`; chat system prompt drops approve/decline signal shape; fixed stale `distilledProfile` reference in `/api/arrange`
- `public/app.js`: removed `profileInstruction` from localStorage profile shape and `defaultProfile()`; `renderPreferencesModal` reads AI summary from `state.learnedPrefs.profileInstruction` (server); profile save handler PUTs `profileInstruction` to server after enrich; added `blur` listener on AI summary textarea to save manual edits; enrich only fires when `answers` or `aboutMe` changed; removed `postPreferenceSignal()` function and all 6 call sites

## [2026-04-15] Fix add-activity enrichment returning wrong activity

- Root cause: `userAdded` path on `/api/activity/replace` used `claude-haiku-4-5` + `max_tokens: 600` — insufficient for precise instruction-following on enrichment task; returned unrelated city activities
- Fix: `userAdded` path now uses `claude-sonnet-4-6` + `max_tokens: 1024`; decline/replace path unchanged (Haiku)
- Simplified `userAdded` prompt to positive framing — removed brittle negative constraints that compensated for Haiku's weaker instruction-following
- File: `src/server.js`

## [2026-04-15] Enrich user-added activities and ground Replace/Modify via Brave search

- `/api/activity/replace` now runs `search("${name} ${city}")` (3 results) before every LLM call, injecting results as grounding context — applies to both replace/modify and user-added flows
- Added `userAdded` flag to `/api/activity/replace`: when true, prompt asks agent to flesh out a real-world match; when false (default), prompt asks for a replacement addressing the decline reason; signals extraction skipped for userAdded
- `search` added to braveSearch import in `src/server.js`
- `submitAddActivity()` in `public/app.js` now pushes an `enriching: true` stub, then calls `/api/activity/replace` with `userAdded: true`; on success swaps stub with enriched activity in-place; on failure removes enriching flag and keeps stub
- `buildActivityCard()` short-circuits to a spinner card when `a.enriching === true`
- Added `.activity-card-enriching` and spinner CSS to `public/styles.css`
- Files: `src/server.js`, `public/app.js`, `public/styles.css`

## [2026-04-15] Add user-initiated "Add Activity" card to review step

- Added blank add-activity card at end of review grid (dashed border, centered `ph-plus-circle` icon, hover accent)
- Added `#addActivityModal` to `public/planner.html` with 4 fields: name, city dropdown, est. cost ($ + per person/group), why it fits
- Added `buildAddActivityCard()`, `openAddActivityModal()`, `closeAddActivityModal()`, `submitAddActivity()` to `public/app.js`
- User-added activities pushed to `state.activities` with `userAdded: true`; grid re-renders on submit; success toast shown
- Added CSS for `.add-activity-card` and all modal field styles to `public/styles.css`
- Files: `public/app.js`, `public/planner.html`, `public/styles.css`

## [2026-04-15] Frontend split: isolate boundary helpers while keeping app.js orchestration

- Extracted overlay/modal concerns to `public/js/overlayManager.js`
- Extracted API/service wrapper concerns to `public/js/apiService.js`
- Extracted top-level state/persistence helpers to `public/js/statePersistence.js`
- Kept core planner orchestration intentionally in `public/app.js` (step flow, render pipeline, review/arrange/finalize logic, chat/maps/checklist integration)
- Scope was intentionally minimal and revertible to reduce risk during active mobile-hardening work
- In current workspace state, `public/planner.html` still loads `/app.js` directly and does not wire helper scripts yet; `app.js` retains fallback paths/defaults when helper globals are absent
- Files: `public/js/overlayManager.js`, `public/js/apiService.js`, `public/js/statePersistence.js`, `public/app.js`, `PROJECT_NOTES/current_state.md`, `PROJECT_NOTES/decisions.md`, `PROJECT_NOTES/changelog.md`

## [2026-04-15] Fix checklist auto-population to rely solely on backend booking_type

- Removed fragile frontend heuristic from `buildChecklistFromState()` that inferred booking requirement from `a.type`/`a.category` when `booking_type` was missing
- Now uses only `['tour', 'attraction'].includes(a.booking_type)` — the authoritative backend field set by Claude at generation time
- File: `public/app.js`

## [2026-04-15] Booking checklist complete overhaul per checklist.md spec

- New typed data model in `normalizeChecklistItem`: transportation (startLocation, endLocation, isRoundTrip, departureDate/Time, returnDate/Time), accommodation (accommodationCity, checkInDate, checkOutDate), activity (activityLocation, activityDate/Time) — each type has its own primary fields
- `buildChecklistFromState`: updated to populate new typed fields from state; uses stable type-aware keys to avoid duplicates
- Replaced old `renderConfidence` checklist section with `renderChecklistModal()` — fully self-contained, called only when modal opens
- Category containers (Transportation, Accommodation, City Activities) — always rendered even when empty, with Phosphor empty state icons
- Collapsed rows: single scannable line per item type; location truncation to 28 chars; checked-off items get strikethrough + muted color (no opacity, WCAG AA safe); 200-350ms transition
- Expanded form: click row to expand; primary zone always visible; secondary zone (Reference #, Price, Notes) behind "More details" ghost button; auto-expands if any secondary field has data
- Google Maps autocomplete: reuses existing `attachPlaceAutocompleteElement` for startLocation, endLocation, accommodationCity, activityLocation
- Search bar: pill-shaped, Phosphor magnifying-glass icon, searches item names only, autofill dropdown with category badge, scroll + accent flash on select
- Container collapse/expand: click header collapses to title + item count badge
- Delete: ghost Phosphor trash icon, undo toast (4s) with Undo button
- + Add Item: ghost button, minimum 44px touch target; new item opens expanded in sorted position
- Per-container subtotals + grand total: only visible when prices exist
- CSS: full rewrite of `confidence.css`; modal is now a flex column with fixed header/footer and scrollable body; responsive: compact (<768) stacks all form rows, wide uses 2-col grid
- Old event listeners for `addChecklistItemBtn` (removed from HTML) replaced with modal-level event delegation
- Files: `public/app.js`, `public/confidence.css`, `public/planner.html`

## [2026-04-15] Fix activity notes — separate from decline flow, passed to Replace/Modify LLM call

- Notes textarea (`activity-notes-text`) moved out of `.decline-feedback` into its own `.activity-notes` section — always visible, saves without declining the activity
- "Save Notes" now only writes to `state.reviewed[id].notes`; no longer sets `approved: false`
- Decline flow retains its own `.decline-reason` textarea + "Replace/Modify" button (renamed from "Replace Activity")
- Notes are included in the `/api/activity/replace` payload and injected into the LLM prompt as additional context
- Both inline card and mobile expand overlay handlers updated; notes pre-populated from `state.reviewed` on card build
- Files: `public/app.js`, `public/styles.css`, `src/server.js`

## [2026-04-15] Fix decline button — one-click toggle, mobile ReferenceError, removed Customize section

- Removed `pointer-events: none` from `.btn-decline.inactive` — was blocking all hover and click events (`public/styles.css`)
- Decline button is now a simple one-click toggle matching approve: click to decline, click again to un-decline (`public/app.js`)
- Removed hidden feedback reveal step — `decline-feedback` section always visible, no disable/enable of the button
- Removed the "Customize" section (notes textarea + apply-note button) and all related event wiring — superseded by the feedback section
- Moved `syncVerdictClasses` from inside `buildActivityCard` closure to module scope — it was inaccessible to `openCardExpand`, causing a silent ReferenceError on mobile when decline/approve was tapped in the expanded overlay (`public/app.js`)
- Added "Saved" confirmation flash (1.5s) on Save Notes button — both inline card and expand overlay

## [2026-04-15] Activity card UX — decline flow, mobile map button, mobile card state fix

- Replaced "Cancel" button in decline feedback panel with "Save Notes" — marks card as declined with reason saved, no API call or replacement fetched (`public/app.js`)
- "Replace Activity" button remains as the only path that triggers the replace API
- Switched apply-note checkmark `✔` to Phosphor `ph-floppy-disk` icon (`public/app.js`)
- Showed `flip-btn` (map icon) on mobile so it sits in the same row as type/verdict badges — was `display: none` (`public/styles.css`)
- Map overlay goes full edge-to-edge on mobile (`padding: 0`, `border-radius: 0`) with larger close button tap target (`public/styles.css`)
- Fixed approve/decline in mobile expanded card overlay: buttons now mutate `state` directly instead of delegating to source card DOM clicks — source card is destroyed by `renderActivities()` before delegation could complete (`public/app.js`)
- Full decline flow (Save Notes + Replace Activity) wired in expanded overlay, not just approve/decline

## [2026-04-14] Fix mobile UI scaling — buttons oversized, fields clipped, chat panel cut off

- Root cause: the `@media (max-width: 767px)` block in `styles.css` applied `min-height: 44px` globally to all buttons with no padding reduction, causing them to stack large; drawer grid sections (`accommodation-row`, `arrival-row`, `departure-row`) used `minmax` columns that overflowed on narrow screens; chat panel used `position: absolute` relative to its `position: fixed; right: 24px` parent, causing `left: 0; right: 0` to be offset and clip the panel
- Fix 1: reduced button `min-height` to 40px, `padding` to `7px 12px`, `font-size` to `0.88rem` on mobile; tightened `.setup-actions` gap; gave `.step-nav-split` buttons `width: 100%`
- Fix 2: added `width: 100%; min-width: 0` to `input[type="date"]` inside city rows to prevent grid cell overflow
- Fix 3: changed `#chatPanel` mobile override to `position: fixed; left: 0; right: 0; bottom: 0` — decouples it from the offset parent so it anchors to the full viewport edge
- File: `public/styles.css`

## [2026-04-14] Fix mobile crash when rapidly tapping step header navigation

- Root cause 1: no transition lock on `setStep()` — rapid mobile taps fired multiple concurrent render calls (renderArrange, renderItinerary, renderConfidence) in the same frame, causing DOM thrashing and crash
- Root cause 2: `renderArrange()` created new Sortable instances on every call without destroying previous ones — accumulated orphaned drag handlers corrupted the DOM under rapid navigation
- Root cause 3: step indicator lacked mobile touch CSS — missing `touch-action: manipulation` caused 300ms delay + double-tap zoom; missing `user-select: none` caused text selection flicker
- Fix 1: added `requestAnimationFrame`-based transition lock in `setStep()` — drops any `setStep` call that arrives before the previous frame completes
- Fix 2: introduced `_arrangeSortables` array; all Sortable instances are tracked and `.destroy()`-ed at the start of each `renderArrange()` call
- Fix 3: added `touch-action: manipulation`, `user-select: none`, `-webkit-tap-highlight-color: transparent` to `.step` in `styles.css`
- Files: `public/app.js`, `public/styles.css`

## [2026-04-14] Fix structural navigation bug — setStep() as single source of truth for step rendering

- Root cause: 3 independent navigation systems (Next/Back buttons, step tab clicks, browser back/popstate) each had their own ad-hoc render logic; step tabs and browser back only handled steps 3/4, never step 2 — navigating to Review via tab or browser back showed a blank/stale panel
- Fix: `setStep()` now owns all step-entry rendering (`renderCities` for step 1, `renderActivities` for step 2, `renderArrange` for step 3, `renderItinerary` for step 4) gated on `n !== prev`
- Removed redundant render calls from `goToPreviousStep()`, step tab click handler, and `popstate` handler — all three now just call `setStep()`
- File: `public/app.js`

## [2026-04-14] Fix mobile navigation and layout bugs (iOS WebKit / Brave on iPhone)

- Back button caused full page reload on iOS: added `history.replaceState({ spa: true, step: 1 })` seed at init; `setStep()` now calls `pushState({ spa: true, step: n }, '')` (null URL, no address bar change); `popstate` handler guards on `e.state?.spa` to prevent real navigation
- Header buttons unclickable on mobile: added `position: relative; z-index: 100` to `.topbar`
- Chat concierge panel shifted off-screen: changed mobile `#chatPanel` from `right: -24px` to `right: 0; left: 0`
- City card row layout collapsed to unlabeled stacked fields: replaced `grid-template-columns: 1fr` with explicit `nth-child` grid placement — toggle+city+remove on row 1, dates side-by-side on row 2, notes full-width on row 3
- Files: `public/app.js`, `public/styles.css`

## [2026-04-14] Full UI overhaul — premium light theme per UI.md design system

- Replaced dark theme (navy bg) with egg-shell light base (#F5F0EB) + navy navigation anchors (#0B2545)
- Added Plus Jakarta Sans for headings, kept Inter for body; three-tier shadow system (sm/md/lg)
- Restyled all components per UI.md: pill buttons, outlined secondary buttons, generous card padding, soft shadows, no heavy borders
- Updated landing page (index.html) Tailwind config and all utility classes to light palette
- Updated planner.html inline styles for Trip Health panels to use new tokens
- Rewrote home.css hero gradient for light theme
- Rewrote confidence.css with new palette tokens
- Added three-tier responsive breakpoints: compact (<768), medium (768-1024), wide (>1024)
- 44px min touch targets on compact, bottom-sheet modals on mobile, pill search inputs in chat
- No functional changes — all IDs, JS class references, and core behavior preserved
- Files: `public/styles.css`, `public/styles/home.css`, `public/confidence.css`, `public/index.html`, `public/planner.html`

## [2026-04-14] Trip Health refresh (Confidence Check reposition)

- Reframed Confidence Check UI to Trip Health (same core feature, refreshed IA/UX)
- Replaced topbar text badge with Phosphor heartbeat icon entrypoint and status-tinted state styling
- Renamed step label and page content from Confidence to Trip Health
- Reorganized Trip Health into separate surfaces:
  - health summary (status, open issues, unresolved bookings, verified count, top issue)
  - budget summary (checklist running total, total budget, over/under)
  - editable checklist area
  - issue review area with fix/verify/dismiss/note actions
- Expanded checklist editor fields: type, location, reservation name, date/time, notes, booking reference, budget USD, status, verified
- Added issue triage persistence (`confidence.issueMeta`) through snapshot, itinerary payload, and confidence API save route
- Extended checklist normalization in frontend/server confidence modules to preserve richer fields
- Updated confidence tests for new status migration model (`resolved`) and richer migrated field expectations
- Files: `public/planner.html`, `public/app.js`, `src/confidenceCheck.js`, `src/server.js`, `src/confidenceCheck.test.js`, `PROJECT_NOTES/architecture.md`, `PROJECT_NOTES/current_state.md`

## [2026-04-14] Fix budget/travelers lost on reload for existing trips

- Root cause: snapshot saved budget/travelers locally but the page reload showed the My Trips list instead of auto-resuming — user had to click "Open" which loaded stale server data
- Fix 1: `saveSnapshot()` now PUTs trip metadata to the server when `currentItineraryId` exists
- Fix 2: `renderMyTrips()` now auto-hydrates from the snapshot when it matches a saved itinerary, immediately restoring the user's edits instead of showing the trip list
- File: `public/app.js`

## [2026-04-14] Fix budget/travelers lost on reload for existing trips

- Root cause: when snapshot matched a saved itinerary, the draft was suppressed from My Trips — user had to click "Open" which loaded stale server data, losing edits
- Fix 1: `saveSnapshot()` now PUTs trip metadata to the server when `currentItineraryId` exists
- Fix 2: `renderMyTrips()` auto-hydrates from the snapshot when it matches a saved itinerary, restoring the user's in-progress edits (including the step they were on) instead of forcing them through the trip list
- File: `public/app.js`

## [2026-04-14] Fix snapshot causing duplicate trip on My Trips after editing existing trip

- Root cause: `saveSnapshot()` didn't include `currentItineraryId` in the payload, so a snapshot saved while viewing an existing trip appeared as an orphaned draft — `renderMyTrips` showed it as a separate "Draft" entry alongside the real saved itinerary
- Fix 1: added `currentItineraryId` to snapshot payload in `saveSnapshot()`
- Fix 2: `renderMyTrips()` now suppresses the draft entry when `snapshot.currentItineraryId` matches an already-saved itinerary
- Fix 3: `hydrateFromSnapshot()` now restores `currentItineraryId` from the snapshot so resuming a draft re-links it to the saved trip (enabling PUT instead of POST on next save)
- File: `public/app.js`

## [2026-04-14] Fix transit pills lost on Arrange step re-entry

- Root cause: `state.commutes = {}` on every step 2→3 transition wiped all commute data, including user-selected transit modes and previously fetched pills
- Fix: removed the unconditional `state.commutes = {}` from the step 2→3 path in `goToNextStep()` — commutes are preserved across Review↔Arrange navigation; full resets still occur in `resetToFresh()` and `clearPlannedResultsKeepSetup()`
- File: `public/app.js`

## [2026-04-14] Fix budget and traveler count not saved correctly

- Root cause: `state.tripBudget`/`numTravelers`/`numChildren` were only read from DOM inputs inside `planTrip()` and `saveSnapshot()`. Two paths in `goToNextStep()` that skip replanning (no-change shortcut, user declines regeneration) went directly to `setStep(2)` without syncing state. `generateItinerary()` then used stale state values.
- Fix: extracted `syncTripMetaFromInputs()` helper; called at start of all step-advance paths (both shortcut branches, `planTrip`, `generateItinerary`, `saveSnapshot`)
- File: `public/app.js`

## [2026-04-13] Replace profile sliders with dot scale in My Profile

- Replaced `<input type="range">` sliders in My Profile with a 5-dot clickable scale (`public/app.js`)
- Added dot-scale CSS (`.dot-scale-wrap`, `.dot-scale`, `.dot-scale-dot`, `.dot-scale-label`, `.dot-scale-end-label`) to `public/styles.css`
- Removed old `.rating-slider`, `.rating-slider-wrap`, `.rating-meta`, `.rating-value`, `.rating-label` styles
- Dot scale shows low-end label on left, current value label on right; supports click and keyboard (Enter/Space)

## [2026-04-11] Replace Leaflet with Google Maps on activity cards

- Removed Leaflet CSS/JS CDN from `public/planner.html`
- Updated Google Maps SDK loading to include `marker` library (`public/app.js`, `public/planner.html`)
- Replaced `ensureMiniMapForCard()` with Google Maps implementation using `AdvancedMarkerElement`
- Replaced `openActivityMapOverlay()` with Google Maps, `AdvancedMarkerElement`, `InfoWindow`, `LatLngBounds`
- Renamed `markerIcon()` to `markerContent()` returning DOM element for AdvancedMarkerElement
- Simplified `destroyMiniMaps()` (Google Maps doesn't need explicit removal)
- Added `isGoogleMapsReady()` helper

## [2026-04-13] Polish Confidence Check checklist UI

- Checklist sections reordered: Transportation → Accommodation → Cities (for activity items)
- "General" section eliminated — items with no city fall under their type section or "Other" city group
- Only activities with `booking_type` of `tour` or `attraction` auto-added (restaurants/none excluded)
- Items sorted by date/time ascending within each section
- Each section has its own "+ Add item" button; pre-fills type and city for the section
- "Conflicts found" card at top lists each issue message; shows "No conflicts found" when clean
- Removed "Live issues" panel from `planner.html` and all dead references (`confidenceIssuesList`)
- Files: `public/app.js`, `public/planner.html`

## [2026-04-13] Simplify checklist editor: 4 fields, auto-populate from itinerary, city-only grouping

- Replaced 9-type / 5-state checklist model with 5 types (transportation, accommodation, dining, activity, other) and 2 statuses (open, finalized)
- New `buildChecklistFromState()` auto-populates checklist from approved activities, city accommodations, and travel entries — no placeholder seeding, no manual re-entry
- Checklist now grouped by city only (removed category→city nesting)
- Editor row trimmed to 4 fields: Type, Date/Time (native `<input type="date">` + `<input type="time">`), Notes (freeform), Status
- Migration logic in `normalizeChecklistItem` maps old types/states and merges name/bookingReference/notes into single notes field for backward compatibility
- Updated `src/confidenceCheck.js`: same simplified model server-side; `groupChecklistByCity` replaces `groupChecklist`; `deriveChecklistSummary` uses open/finalized counts
- Updated `public/confidence.css`: 5-column grid, city-level `<h4>` as top-level section header, `confidence-datetime-inputs` flex pair
- Updated and expanded `src/confidenceCheck.test.js` (8/8 passing): covers migration, empty state, ready state
- Files: `public/app.js`, `src/confidenceCheck.js`, `public/confidence.css`, `src/confidenceCheck.test.js`

## [2026-04-13] Fix duplicate trips on reload

- Root cause: `generateItinerary()` always called `POST /api/itinerary`, which always created a new record — even when `state.currentItineraryId` was already set (e.g. after loading a saved trip and navigating back to step 3)
- Fix: `generateItinerary()` now uses `PUT /api/itinerary/:id` when `state.currentItineraryId` exists, falling back to `POST` for new trips
- Added `updateItinerary(id, payload, userId)` to `src/itineraryStore.js` — overwrites existing item in-place, preserves `bookings`/`generatedAt`
- Added `PUT /api/itinerary/:id` route in `src/server.js`
- Files: `src/itineraryStore.js`, `src/server.js`, `public/app.js`

## [2026-04-13] Fix step 5 Save Progress creating a new trip instead of updating

- Root cause: all Save Progress buttons shared `saveSnapshot()` which only writes to localStorage — no server call. By step 5, the itinerary already exists on the server (created in step 4), so the handler was effectively creating a new record.
- Fix: gave step 5 button a distinct id (`saveConfidenceBtn`) in `public/planner.html` and wired it to `PUT /api/itinerary/:id/confidence` in `public/app.js`; falls back to `saveSnapshot()` if no `currentItineraryId` exists
- Files: `public/planner.html`, `public/app.js`

## [2026-04-13] Fix Confidence Check checklist hidden by `.panel` CSS rule

- Root cause: inner `<section class="panel confidence-checklist-panel">` and `<section class="panel confidence-issues-panel">` inside step 5 were invisible because `.panel { display: none }` applies globally — `setStep` only adds `.active` to top-level step panels, never nested ones
- Fix: replaced `class="panel"` on both inner sections with `class="card-panel"` in `public/planner.html`
- Added `.card-panel` to `public/styles.css` — same visual style as `.panel` but always visible
- Files: `public/planner.html`, `public/styles.css`

## [2026-04-13] Strengthen Confidence Check checklist and checklist-driven summary

- Verified existing checklist existed, but it was too shallow (title/status/notes/details only) and summary was mostly a status card
- Upgraded confidence checklist schema in `src/confidenceCheck.js` to support: `type`, `name`, `dateTime`, `state`/verified, `source`, `notes`, optional `bookingReference`
- Auto-seeded checklist with critical booking types (flight, hotel, car rental, train, attraction, restaurant, tour, transfer) when missing
- Added checklist-aware issue detection (`missing_details`, `booking_problem`) and booking summary buckets: needs booking / confirmed / broken / can fix now
- Updated Confidence Check UI (`public/app.js`, `public/confidence.css`, `public/planner.html`) to keep checklist as a core visible section and drive summary cards/actions from checklist + issues
- Expanded confidence tests (`src/confidenceCheck.test.js`) for new checklist shape and critical-type seeding

## [2026-04-13] Build Confidence Check Mode MVP

- Added `src/confidenceCheck.js` with always-on validation for overlapping dates/activities, missing date-time fields, conflicting reservations, and suspicious gaps/impossible timing
- Added persistent confidence checklist + notification preference persistence to itinerary records (`updateItineraryConfidence` in `src/itineraryStore.js`)
- Added confidence API endpoints in `src/server.js`:
  - `GET /api/itinerary/:id/confidence`
  - `PUT /api/itinerary/:id/confidence`
  - `POST /api/itinerary/:id/confidence/email-summary`
- Added optional email summary sender via Resend for unresolved confidence issues
- Added UI confidence surfaces in `public/planner.html` + `public/app.js`:
  - Step 5 workflow panel (“Confidence Check Mode”)
  - global confidence status badge and compact popover with CTA
  - editable checklist rows (status/notes/details + add/delete)
  - immediate in-app warnings when new issues appear
- Added dedicated styles in `public/confidence.css`
- Added tests in `src/confidenceCheck.test.js`

## [2026-04-12] Fix geocoding rate limits causing "Location unavailable" on last city

- Added server-side Nominatim queue (`nominatimFetch`) enforcing 1.1s spacing between requests — prevents 429s when geocoding all activities across multiple cities
- Removed redundant 500ms client-side delay in `geocodeQueryQueued` (server now owns rate limiting)
- Files: `src/server.js`, `public/app.js`

## [2026-04-12] Fix map overlay blank screen — proxy Nominatim geocoding through server

- Added `GET /api/geocode?q=...` proxy endpoint in `src/server.js` to forward Nominatim requests server-side (fixes CORS block on VPS domain + 429 rate limit from browser IP)
- Updated `geocodeQueryQueued` in `public/app.js` to call `/api/geocode` instead of Nominatim directly
- Files: `src/server.js`, `public/app.js`

## [2026-04-12] Parallel city planning with global LLM semaphore

- `/api/plan` now processes cities in parallel batches of 3 (was sequential)
- Added global semaphore (`MAX_CONCURRENT_LLM_CALLS = 10`) in `server.js` to cap total in-flight Anthropic calls across all users
- `releaseLlmSlot()` called in `finally` block to prevent slot leaks on error
- Added Scalability section to `PROJECT_NOTES/ROADMAP.md` documenting job queue path for 100+ users
- Files: `src/server.js`, `PROJECT_NOTES/ROADMAP.md`

## [2026-04-12] Decline with feedback and activity replacement

- Decline button now shows inline feedback form instead of immediately declining; textarea capped at 200 chars
- New `POST /api/activity/replace` endpoint: generates one replacement activity for the same city based on the decline reason
- LLM response includes `signals[]` array (same schema as concierge): `{type,verdict}` / `{preference}` / `{constraint}`; processed via existing `processChatSignals()` — non-learnable reasons produce empty signals array
- `normalizeActivity` and `SYSTEM_PROMPT` exported from `src/claude.js` for reuse
- `postPreferenceSignal()` updated to accept optional `reason` field
- Files: `src/claude.js`, `src/server.js`, `public/app.js`, `public/styles.css`

## [2026-04-12] Fix booking type taxonomy and add children traveler support

- Replaced `is_bookable` boolean with `booking_type` enum in LLM schema: `tour` (GetYourGuide+Viator), `attraction` (Google tickets search), `restaurant` (Google Maps), `none` (no links)
- Strengthened `cost_type` prompt with explicit per_person/per_group examples to fix misclassifications (e.g. teamLab, theme parks)
- Added Children input to Step 1 alongside Adults; children cost estimated at 60% of adult price
- `computeApprovedCost()` applies children discount; card display shows adult + child breakdown
- `numChildren` threaded through plan/arrange API payloads, LLM budget context, and GetYourGuide/Viator booking link params
- Files: `src/claude.js`, `src/server.js`, `src/braveSearch.js`, `public/planner.html`, `public/app.js`

## [2026-04-12] Add regenerate confirmation dialog on step 1 changes

- `step1Fingerprint()` expanded to include `budget` and `travelers` (read from DOM inputs)
- `goToNextStep()` step 1 branch: shows `showRegenerateConfirmDialog()` when fingerprint changed and activities exist
- "No, keep existing" skips to step 2; "Yes, regenerate" proceeds with re-plan
- `showRegenerateConfirmDialog()`: promise-based modal, backdrop-click dismisses as "No"
- Files: `public/app.js`

## [2026-04-12] Add budget feature with per-activity costs and booking links

- Added Total Budget (USD) and Number of Travelers inputs to Step 1 (`public/planner.html`, `public/app.js`)
- LLM (`src/claude.js`) now returns 3 new fields per activity: `estimated_cost_usd`, `cost_type` (per_person/per_group), `is_bookable`; with explicit examples in prompt to prevent weak-model misclassification
- Added `searchActivityPrice()` and `searchActivityPricesBatch()` to `src/braveSearch.js` with multi-currency regex parsing (USD/EUR/GBP/JPY → USD) and range support (takes higher end)
- `/api/plan` (`src/server.js`): extracts budget/numTravelers, passes to `planCity()`; runs parallel Brave price batch post-generation; overrides LLM cost with Brave if higher; constructs booking links (GetYourGuide + Viator for tours, Google Maps for named restaurants) using `is_bookable` flag
- `/api/activity/refine` (`src/server.js`): refine prompt includes cost fields; re-runs Brave price search and reconstructs booking links after customize
- `/api/arrange` (`src/server.js`): includes cost info in activities text and budget context rule
- `public/app.js`: `computeApprovedCost()` helper; `renderBudgetTracker()` sticky bar with green/yellow/red states; cost display on cards with per-person multiplication; booking link pills; post-arrange date refresh on booking links
- `public/styles.css`: budget tracker styles, booking link pills, trip meta row layout
- Files: `src/braveSearch.js`, `src/claude.js`, `src/server.js`, `public/planner.html`, `public/app.js`, `public/styles.css`

## [2026-04-11] Tighten concierge chat prompt and add hyperlink rendering

- Concierge system prompt: capped at 2-3 sentences, banned hedging phrases, added CRITICAL instruction to use markdown links instead of raw URLs inside JSON reply
- Frontend `renderChatMessages`: converts markdown `[text](url)` to `<a>` tags, plus fallback auto-linking for raw URLs
- Files: `src/server.js`, `public/app.js`

## [2026-04-11] Replace resume popup with "My Trips" section on Step 1

- Removed `resumeModal` dialog from `planner.html`
- Added `#myTripsPanel` section inside Step 1 showing drafts + saved itineraries
- Replaced `maybePromptSnapshot()` with `renderMyTrips()` in `app.js`
- Draft trips shown with yellow badge; saved itineraries with Open/Delete actions
- Panel auto-hides when no trips exist
- Removed unused `.resume-card` / `.resume-actions` CSS
- Files: `public/planner.html`, `public/app.js`, `public/styles.css`

## [2026-04-11] Add cross-device data sync for localStorage-only data

- Created `src/userDataStore.js` — flat JSON store at `data/userdata.json` keyed by Clerk userId
- Added REST endpoints in `src/server.js`: `GET/PUT /api/userdata`, `GET/PUT /api/userdata/:field`
- Updated `public/app.js`:
  - `syncToServer()` pushes to server on every local save (profiles, snapshot, viewMode, chatSessions)
  - `syncFromServer()` hydrates localStorage from server after Clerk auth completes
  - Updated `saveProfiles`, `saveSnapshot`, `clearSnapshot`, `setViewMode`, `saveChatSessionMap` to dual-write
- Files: `src/userDataStore.js` (new), `src/server.js`, `public/app.js`

## [2026-04-11] Add map-first activity review UX (Step 2 card flip + full-screen map)

- Added Leaflet + OpenStreetMap to planner UI (CDN) for map rendering with no API key
- Reworked Step 2 activity cards into a 3D flip-card layout:
  - Front keeps existing activity details/approve-decline/notes controls
  - Back adds mini-map with pinned activity location and full-map launch action
- Implemented client-side Nominatim geocoding (`https://nominatim.openstreetmap.org/search`) with:
  - query candidate fallback (`start_location`, `end_location`, activity+city)
  - localStorage cache (`travelplanner_geo_cache_v1`)
  - serialized request queue + spacing to reduce API hammering
- Added full-screen map overlay showing all activities in the current itinerary:
  - numbered marker labels by city/order
  - selected activity highlighted using star marker
  - clickable pins that scroll/highlight corresponding activity card
- Added supporting styles for smooth CSS 3D transforms and map UI overlays
- Files: `public/app.js`, `public/styles.css`, `public/planner.html`, `PROJECT_NOTES/current_state.md`, `PROJECT_NOTES/ROADMAP.md`, `PROJECT_NOTES/changelog.md`

## [2026-04-11] Wire up Brave Web Search API for planning agent + chat concierge

- Created `src/braveSearch.js` — thin wrapper around Brave Web Search API with `search()`, `searchCityActivities()`, `searchForChat()` helpers; graceful no-op when key missing
- Wired into `src/claude.js` `planCity()` — fetches web research for the city before LLM call, injected as supplementary context in the user prompt
- Wired into `src/server.js` chat endpoint — every chat message triggers a Brave search, results appended to system prompt so the concierge can cite real-time info
- Added `BRAVE_API_KEY` to `.env.example` with comment (free tier: 2000/month)
- Updated `CLAUDE.md` with new module and updated request flow
- Files: `src/braveSearch.js` (new), `src/claude.js`, `src/server.js`, `.env.example`, `CLAUDE.md`

## [2026-04-10] Add Robust Calendar & Sync Mode MVP (Proposal A)

- Added calendar metadata mode toggle (compact/full) in step 4 itinerary actions
- Upgraded ICS export to accept `metadata` query param and conditionally include full notes fields
- Added Google Calendar OAuth scaffolding endpoints using env credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `GOOGLE_REDIRECT_URI`)
- Added Google Calendar connection status endpoint
- Added pre-export conflict detection endpoint that checks overlap against existing Google calendar events
- Added one-way Google sync endpoint with dedupe-safe fingerprint mapping to avoid duplicate event creation
- Added local persistence for Google tokens + sync fingerprints (`data/google-calendar-tokens.json`, `data/calendar-sync-state.json`)
- Added UI controls: Connect Google, Sync Google, conflict warning/continue prompt, sync status message
- Files: `src/server.js`, `src/calendarSync.js`, `public/planner.html`, `public/app.js`, `public/styles.css`, `PROJECT_NOTES/architecture.md`, `PROJECT_NOTES/current_state.md`, `PROJECT_NOTES/changelog.md`

## [2026-04-09] Add Clerk auth + user-scoped itineraries + email forwarding ingest

- Integrated Clerk auth boundary in planner app (frontend sign-in gate + Bearer token API calls)
- Added server-side Clerk middleware and protected `/api/*` routes (except status + inbound webhook)
- Converted itinerary persistence to authenticated user ownership (`userId`) for save/list/load/delete/ICS
- Added per-user forwarding inbox generation using hashed alias + configurable forwarding domain
- Added `/api/auth/session` to return user auth context + forwarding address
- Added `/api/email/inbound` webhook with shared-secret verification for forwarded booking emails
- Implemented booking parser (flight/hotel/car/other heuristics) and itinerary attachment flow
- Added optional Resend outbound confirmation email after successful ingest
- Relaxed userId validator to accept Clerk-style IDs
- Files: `src/server.js`, `src/itineraryStore.js`, `src/emailForwarding.js`, `src/preferences.js`, `public/planner.html`, `public/app.js`, `public/styles.css`, `package.json`

## [2026-04-09] Build Smart Minimal Itinerary extension on top of Execution Mode

- Extended existing Execution Mode (not a parallel view) into a "Smart Minimal Itinerary" surface
- Added mobile-friendly execution toolbar actions: Share link, Copy text, Save Offline, Print
- Added compact trip summary cards (trip/date range/cities/item count)
- Added "Consolidated Confirmations" block (accommodation + arrival/departure details per city)
- Grouped execution schedule by day/city for lightweight on-trip scanning
- Added URL-share flow via `?itinerary=<id>&mode=execution`
- Added offline fallback pack in localStorage for shared links and service worker shell caching (`public/sw.js`)
- Files: `public/planner.html`, `public/styles.css`, `public/app.js`, `public/sw.js`

## [2026-04-08] Add apply-note button to refine activities from user notes

- New `/api/activity/refine` endpoint: sends activity + user note to Haiku, returns only changed fields
- Checkmark button appears next to notes textarea on approved activities
- On click, merges LLM-returned field updates into the activity in-place, clears note, re-renders
- Refined activity (e.g. specific restaurant) flows into auto-arrange with correct name/location/details
- Files: `public/app.js`, `public/styles.css`, `src/server.js`

## [2026-04-08] Fix chat response showing raw JSON

- `parseChatResponse` now strips markdown code fences before `JSON.parse`
- Matches the same fallback strategy used in `claude.js` for activity generation
- Files: `src/server.js`

## [2026-04-08] Fix pace slider crash (paceLabel collision)

- Renamed new profile pace function to `pacePrefLabel` to avoid collision with existing `paceLabel` at line 3128
- Existing `paceLabel` returns an object `{label, className}` for itinerary insights; later declaration was shadowing it
- Files: `public/app.js`

## [2026-04-08] Add pace preference and LLM-reasoned activity counts

- Added "How packed do you like your days?" slider to user profile (1–5: very relaxed → non-stop)
- Removed hardcoded "6-8 activities" constraint; LLM now reasons from date range + pace
- Pace description injected into activity generation and auto-arrange prompts
- Auto-arrange rule 9 now gives pace-specific scheduling guidance (gaps vs. tight packing)
- Pace flows through `getSummary()`, `formatProfileForEnrichment()`, and arrange API call
- Files: `public/app.js`, `src/claude.js`, `src/preferences.js`, `src/server.js`

## [2026-04-08] Replace time-of-day presets with exact time field

- Removed `TIME_OF_DAY_PRESETS` (morning/afternoon/evening), `normalizeTimeOfDay`, and the `timeOfDay`+`customTime` dual-field system
- Replaced with single `time` field (HH:MM) on `logistics.arrival` and `logistics.departure`
- Time inputs start empty — user must select an exact time before progressing
- Validation blocks "Next" if either arrival or departure time is missing
- Server reads `.time` first with fallback to `.customTime` for old saved data
- Updated `cityDropdownValidation.js` and its tests to match
- Files: `public/app.js`, `src/server.js`, `src/cityDropdownValidation.js`, `src/cityDropdownValidation.test.js`

## [2026-04-08] Bias Google Places autocomplete to selected city

- Added `cityLocationBias()` helper — creates 50km radius circle from city lat/lng
- Passed `locationBias` to `PlaceAutocompleteElement` for accommodation, arrival, departure, and travel entry inputs
- City name input intentionally unbiased (global search)
- Files: `public/app.js`

## [2026-04-08] Improve activity images and clean up review UI

- Frontend now sends activity `type` to `/api/image` for more relevant Unsplash results
- Unsplash fetches 5 candidates per query (was 1); `usedUrls` Set prevents duplicates across activities
- Removed "Clear Visible" button from review toolbar
- Removed "Cultural Time Budget" bar and all related CSS (`.budget`, `.progress` classes)
- Files: `public/app.js`, `public/planner.html`, `public/styles.css`, `src/unsplash.js`

## [2026-04-08] Overhaul auto-arrange prompt for better scheduling

- Upgraded arrange model from claude-haiku-4-5 to claude-sonnet-4-6, max_tokens 1024→2048
- Injected traveler profile (distilledProfile + constraints) into arrange prompt
- Stripped noise from activity payload: omit empty fields, filter default suggested_time (10:00am)
- Restructured prompt: numbered priority rules, explicit per-day activity target, concrete meal windows
- Removed redundant/aggressive instructions suited for weaker model
- Files: `src/server.js`, `public/app.js`

## [2026-04-08] Fix 0-min logistics commutes; clean up commute system

- Root cause: `buildLogisticsPseudoActivities` set arrival pseudo's end_location to accommodation (not arrival point), so commute pipeline computed accommodation→accommodation = 0 min. Same issue for departure pseudo's start_location.
- Fix: each pseudo-activity now uses its own physical location for both start/end coords
- Extracted `renderCommuteSelector()` — single source for commute dropdown HTML
- Simplified `updateCommutesForCityDays`: merged two fragile cleanup passes into one
- Removed dead `makeLogisticsTransit` function
- Files: `public/app.js`

## [2026-04-08] Simplify auto-arrange: LLM-driven scheduling with commute-aware inputs

- Pre-fetch arrival→accommodation and accommodation→departure commute times via Google Maps before `/api/arrange` call
- fixedStart/fixedEnd times now offset by actual transit duration so LLM receives accurate available windows
- Activity locations sent in arrange payload for LLM geographic clustering
- Prompt updated: LLM estimates inter-activity travel time, groups nearby activities per day
- Deleted `applyCommuteTimeAdjustments` — LLM scheduling trusted, hardcoded post-processing removed
- Files: `public/app.js`, `src/server.js`

## [2026-04-08] Real commute times for arrival/departure logistics legs

- Logistics pseudo-activities injected into commute calculation pipeline
- Google Maps Distance Matrix calculates real transit/driving/walking times for these legs
- Commute mode selector rendered between logistics cards and first/last activities
- Files: `public/app.js`

## [2026-04-08] Arrival/departure logistics cards and auto-arrange constraints

- Render fixed arrival and departure cards on arrival/departure days in the arrange view
- `/api/arrange` prompt includes FIXED FIRST/LAST annotations
- Fixed Google Places library init
- Added editable AI-generated summary section in profile modal
- Files: `public/app.js`, `public/styles.css`, `src/server.js`

## [2026-04-07] Summary of earlier work

- Fix activity images not loading at step 2
- Chat-driven preference learning with profile distillation
- Optimize concierge context window for cost efficiency
- Evolving context window for concierge chatbot
- Replace Auto Arrange heuristic with LLM call
- Trigger fresh plan generation when step 1 data changes
- Overhaul Auto Arrange logic and meal scheduling
- Fix arrival/departure location autocomplete
- Add Google Places location inputs for accommodation, arrival, departure
- Simplify trip setup date/time UX
- Scaffolded PROJECT_NOTES/

## [2026-04-20] Phase 1 activity schema migration

- Created `src/activityMigration.js`: `isLegacyActivity`, `migrateActivity`, `parseTimeString`, `parseDurationToMinutes`, `inferMealType`
- Rewrote `normalizeActivity` in `src/claude.js` to emit new v2 shape; added `blankActivity` helper and `normalizeLegacyActivity` export
- Updated `src/itineraryStore.js`: in-memory migration on load, `_schemaVersion: 2` on save/update
- Added `activityForPrompt` adapter in `src/server.js` before `/api/arrange` prompt assembly; updated booking-link enrichment and `/refine` to handle both shapes
- Created `public/js/activityMigration.js` (plain JS, no imports); wired into `planner.html` before `app.js`
- Added `actDurationHours`, `actPreferredTime`, `actAddress`, `actCostUsd`, `actCostType`, `actBookingType`, `actBookingLinks`, `actOpeningHours` accessor helpers in `public/app.js`; updated all ~40 legacy field read sites
- Applied client-side migration at state hydration path (snapshot load and SSE city event)
- Added `src/activityMigration.test.js` with 11 tests (all passing); `npm test` 22/22 green
- Pushed branch `feature/arrange-schema-migration`

## [2026-06-09] Arrange reliability: thinking + caching + few-shot + stronger repair
- Branch `feature/arrange-reliability-thinking` (pushed). A real Kyoto run (18 flexible + 4 locked, 5 meals) produced a 16-violation first pass and dropped 7 activities incl. 3 of 5 meals; root cause was forced `tool_choice` blocking extended thinking, so the model never reasoned through meal opening_hours or commute ordering.
- `src/routes/activities.js`: `callLlmForJson` now uses `tool_choice:auto` + `thinking:{type:'adaptive'}` + `output_config:{effort:'high'}` (forced tool use is incompatible with thinking). Hoisted `SCHEDULE_TOOL` to module scope; passes a cached `system` block (`cache_control:ephemeral`) carrying the static rules + few-shot. Repair loop now runs up to 2 iterations. Added `forceDroppedCount` tracking → `forceDropped` in success-path `logRun`; `LLM_RESPONSE` log now includes cache_write/cache_read tokens.
- `src/services/arrangePromptDirect.js`: extracted `STATIC_ARRANGE_SYSTEM` constant (static rules + commute-aware-ordering rule + worked few-shot example centered on opening-hours-aware meal slotting); `buildDirectArrangePrompt` now returns only the volatile per-request body; `buildRepairPrompt` rewritten to group issues by type and emit a surgical directive per type.
- `src/services/arrangeTelemetry.js`: `summarize()` now reports `forceDropPct`.
- SDK stays at `@anthropic-ai/sdk` 0.39.0; verified `messages.create` forwards the body verbatim (no field whitelist), so untyped `thinking`/`output_config` reach the wire.

## [2026-06-09] Arrange: reverted thinking, fixed empty-repair clobber, added deterministic meal protection
- Reverted adaptive thinking from the Arrange call (commit 8c1cae5) after it ran for minutes and hit max_tokens without emitting a schedule across one-call and two-call structures (interleaved thinking has no hard cap on Sonnet 4.6). `src/routes/activities.js` now uses a single fast forced-tool `submitSchedule(prompt)` (no thinking, max_tokens 16384) with the static system block and the per-request prompt both cached. Removed the streaming/`reasonAboutSchedule` paths.
- Fixed a placed=0 bug: a repair pass returning an empty schedule validated as ok (no placements → no conflicts) and silently wiped a good first pass. The 2-iteration repair loop now rejects a degenerate empty repair and keeps prior placements.
- Added deterministic meal protection (commit 29f3b4b) in `src/services/arrangeTimeAdjuster.js`: `anchorMeals` + `findSlotStart` pin each meal into a lunch (11:00–14:30) or dinner (17:00–22:00) slot by opening_hours, ≤1 each per day, before non-meals are timed; non-meal placement generalized to push past all obstacles (locks + meal anchors). Meals with no feasible slot drop with `no_meal_slot_on_day`. Added 2 meal tests to `src/arrangeTimeAdjuster.test.js` (9/9 pass).
- Kept from the earlier 54bacff work: prompt caching, few-shot example + commute-aware ordering rule in `STATIC_ARRANGE_SYSTEM`, per-issue-type `buildRepairPrompt`, `forceDropPct` telemetry.
- Investigated meal generation (`claude.js` planCity): meals are generated as neutral named restaurants + opening_hours with slot assignment deliberately deferred to arrange. Decided not to add a breakfast slot or generator meal-slot tags (no demand — trips assume breakfast-at-hotel).

## [2026-06-10] Arrange redesign: LLM day-assignment + deterministic scheduler
- NEW `src/services/arrangeScheduler.js` `schedule({assignment,days,activitiesById,lockedActivities,commuteMatrix})` → `{placements,unplaced,diagnostics,mealRedistributed}`. Cross-day meal redistribution, brute-force/NN per-day ordering, meal anchoring, time assignment. 14 unit tests in `src/arrangeScheduler.test.js` (all pass).
- NEW `src/services/geo.js` — shared `activityCoords`/`haversineKm`; deduped from distanceMatrix.js, placesEnrich.js, arrangePromptDirect.js.
- `src/services/arrangePromptDirect.js` — gutted to `buildAssignPrompt` + minimal `STATIC_ARRANGE_SYSTEM` (day-assignment only). Deleted few-shot, commute block, repair prompt, time-math rules.
- `src/routes/activities.js` — `ASSIGN_TOOL` (assign_days), `sanitizeAssignment` (backfills LLM-omitted ids to least-loaded day), calls `schedule()`. Deleted repair loop, force-drop, sanitizePlacements.
- `src/arrangeValidator.js` — demoted `validate()` to a self-check assertion; exported `parseOpeningHoursContains`.
- `src/services/arrangeTelemetry.js` — new field set (placedPct, avgUnplacedPerRun, mealRedistributedTotal, droppedByReason); dropped zombie fields.
- DELETED `src/services/arrangeTimeAdjuster.js` + `src/arrangeTimeAdjuster.test.js`.
- Full local suite: 126/126 pass.

## [2026-07-07] Cost consistency across all surfaces + category summary + price sorting

Branch `claude/budget-optimization-loading-screens-4hc6a3` (same-day follow-up).

- **Bug — $90 in budget-opt vs $180 in checklist (2-person trip)**: unified every per-activity $ surface onto `activityCardCostUsd` (party total, user-edited checklist value wins). New helpers in `public/app.js`: `budgetOptEligible`, `budgetOptApprovedActivities`, `sumCardCosts`, `budgetOptCurrentCostUsd` (refined candidates use `activityBudgetUsd`, not the id-keyed checklist lookup), and shared `priceComparator`. Fixed the actual reported surface — finalize open-items `app.js:7171` used raw per-person `actCostUsd` with a `||` that skipped both the traveler multiplier and user edits → now `(linkedActivity ? activityCardCostUsd(...) : null) ?? item.budgetUsd ?? 0`. Budget-opt card chip via `faceHtml(act, label, isRefined)`; footer bar + targeting math (`onConfirmLocks`) moved to `sumCardCosts`; `updateBudgetOptProgressBar` made zero-arg (fixes a latent bug where the flip-toggle denominator jumped because it received only the unlocked subset). Deleted now-unused `computeApprovedCost`. Budget-opt eligibility widened to include price-level-only meals.
- **Category-spend summary**: `renderBudgetOptCategorySummary` groups approved activities by `mapTypeToFinalizeCat` (6 finalize buckets), sums `budgetOptCurrentCostUsd`, sorts descending, renders stat chips (label/$/%/mini fill bar; largest warn-colored) into the overlay header; live-updates via `updateBudgetOptProgressBar`. New `.budget-opt-cat-summary`/`.opt-cat-chip` CSS.
- **Sort by price**: Review step `#reviewSortFilter` select (planner.html) + `state.reviewFilters.sort` applied at the end of `getFilteredReviewActivities` (keeps the `openCardExpand` closure index-consistent); budget-opt cycling Default→Price↓→Price↑ toggle button (`.budget-opt-header-actions` hook) with `budgetOptState.sortMode`/`lastRender` so `renderBudgetOptCards` sorts a cached copy across both phases. Nulls/unpriced sort last in both directions.
- Verified via Playwright (embed mode, 2-traveler Kyoto seed spanning grounded/legacy/per_group/price-level/unpriced): the $90 Wagyu now reads $180 identically on review chip, checklist, finalize open-item, and budget-opt chip; a user edit to $150 propagates to all four; price-level meal is eligible, unpriced excluded; category summary sorts (Food $360 top / Tour $220) and sums correctly; flip denominator stable across toggles; refined face shows $40 (party) not the original override; both sort surfaces order by cost with unpriced last. 176/176 unit tests.

## [2026-07-07] Price estimate chip on Review activity cards

Branch `claude/budget-optimization-loading-screens-4hc6a3` (follow-up to the same-day budget fix).

- Review activity cards now show a concrete `~$<amount>` cost chip on the image (bottom-right, matching the budget-optimization card chip), sourced identically to the checklist rollup. New shared helpers in `public/app.js`: `activityBudgetUsd(a)` (whole-party estimate: real `optActivityCost` else type-based `representativeCostUsd` × travelers — extracted from `buildChecklistFromState`, which now calls it) and `activityCardCostUsd(a)` (prefers a user-edited checklist `budgetUsd` so the card matches the checklist exactly, else the derived estimate) + `activityCostChipHtml(a)`. Truly unpriced activities render a hidden placeholder chip (refreshed in the late `resolvePlace` callback when a meal's `price_level` arrives). Expanded card inherits the chip via the existing front-face clone.
- Budget-meter "N unpriced" caveat now counts activities with no estimate at all (`activityCardCostUsd == null`) instead of no real `actCostUsd`, so it agrees with the cards (a meal with a representative estimate is no longer double-messaged as both "$40 on the card" and "unpriced" in the meter).
- Partially extends decisions [2026-04-19] (which withheld a per-activity dollar figure from cards): the figure is now shown as a clearly-tilde'd estimate with an "Estimated cost / total for your party" tooltip; the GetYourGuide affiliate link and `$$$$` price-level badge remain. `.activity-cost-chip` CSS mirrors `.opt-cost-chip`.
- Verified via Playwright (embed mode): chips read ~$100 (real), ~$40 (meal price_level), ~$25 (representative landmark), hidden for a truly-unpriced activity; meter reads "1 unpriced $165" matching the three chip sums. 176/176 unit tests.

## [2026-07-07] Review toolbar: one row + Approve All moved below the grid

Branch `claude/budget-optimization-loading-screens-4hc6a3`. The new price-sort select pushed the review toolbar to wrap onto a second row. Moved `#approveVisibleBtn` out of `.review-toolbar` into a new centered `.review-approve-all-row` after `#activitiesGrid` (planner.html), so the toolbar is now a single row (search + 4 selects) and the bulk-approve CTA sits at the bottom of the list — nudging users to scroll through activities first. Generalized the `.approve-all` CSS selector (was `.review-toolbar .approve-all`; class is used only on this button). Playwright-verified: toolbar is 40px (one row) at 1024px and 1440px; button renders below the grid.

## [2026-07-07] Never show an impossible $0 cost — fall back to the representative estimate

Branch `claude/budget-optimization-loading-screens-4hc6a3`. A refined meal (e.g. a pizzeria the model priced at `estimated_cost_usd: 0`) rendered a `$0` chip because `activityBudgetUsd` treated a real cost of 0 as a valid price (`partyCost != null`), short-circuiting the representative fallback. Changed the guard to `partyCost != null && partyCost > 0`, so a non-positive/missing real cost falls back to the type-based representative estimate (e.g. price-level meal) and, when no representative exists, returns null (chip hidden, counted as unpriced) — `$0` can no longer appear on any per-activity surface. Playwright-verified: a $0 meal with price_level shows its representative estimate, a refined $0 meal face shows ~$30 instead of $0, unpriceable items stay hidden, real prices unchanged, and no "$0" appears in the budget-opt overlay. 176/176 tests.

## [2026-07-07] Refine route now grounds the replacement venue's Google price level

Branch `claude/budget-optimization-loading-screens-4hc6a3`. Root cause of the guesswork behind the $0 pizzeria: `/api/activity/refine`'s rename block already called `enrichWithPlaceDetails` (Google Places) for the new venue but only copied back coords/opening-hours/timing — the fetched `price_level` was dropped, so a refined restaurant kept the REPLACED venue's price level (or nothing). Now: `merged.price_level` is cleared before enrichment so a post-enrich value is provably the new venue's; if Places returns a tier it is copied into `updates.price_level`; if Places has no tier (or no match) the inherited level is explicitly nulled so the old venue's $$$$ can't leak onto the new one (the review card's lazy `resolvePlace` backfills later). Combined with the $0 fallback fix, a model-priced-$0 meal now shows the real Google price tier's representative figure. Verified by running the real route in-process with OpenAI stubbed via `OPENAI_BASE_URL` and Places stubbed at global fetch: tier→`updates.price_level=1`, no-tier→null, no-match→null (distinct venue names per case to bypass the places LRU).

## [2026-07-07] Budget-opt: ~$ estimate prefix + drop same-price "alternatives"

Branch `claude/budget-optimization-loading-screens-4hc6a3`. Two honesty/clarity fixes in the budget optimizer:
- **Tilde prefix**: budget-opt card chips (`opt-cost-chip`), the category-summary amounts, and the footer meter's estimate side now render `~$` (matching the review card chip) so coarse price-level estimates don't read as exact prices. The footer keeps the user's exact `tripBudget` without a tilde.
- **Drop non-cheaper refinements**: `onConfirmLocks` now discards any refinement whose estimated cost isn't strictly below the original's (e.g. a `$$` restaurant swapped for another `$$` — identical representative figure), which previously showed an unchanged price and read as broken. If none of the alternatives are actually cheaper, an explanatory banner fires and the overlay stays in the lock phase; mixed cases advance to flip with only the genuine savings. Extracted a small `abortToLock(message)` helper for the two back-to-lock paths.
- Verified via Playwright (embed): chips show `~$`; a `$$$→$` swap is kept and shows a lower `~$30` while a same-price `$$→$$` swap is dropped; an all-same-price run shows the banner and stays in lock. Consistency/sort/zero-cost regression suites still green. 176/176 unit tests.

## [2026-07-07] Fix stale price after confirming a budget swap

Branch `claude/budget-optimization-loading-screens-4hc6a3`. Bug: the budget-opt flip phase showed the new alternative's lower price, but after "Confirm Selections" the review card reverted to the original price. Cause: `onConfirmSelections` replaced the activity (new name/photo/description) but left the old checklist entry in place; when that entry's stored `budgetUsd` didn't match the freshly-derived value (e.g. saved under a different traveler count or an earlier cost basis, or with a missing `budgetUsdAuto`), the refresh heuristic in `buildChecklistFromState` mistook it for a manual override and froze the original price — which `activityCardCostUsd` then returned for the (different) new venue. Fix: `onConfirmSelections` now drops the checklist entries for swapped activities so the rebuild re-derives each new venue's cost from scratch. Verified via Playwright: with a checklist entry whose stored budget differs from the derived value, the review chip now updates to the new price after confirm (was reverting); pizzeria/nested/normal confirm flows and the cheaper/parity/consistency suites remain green. 176/176 unit tests.

## [2026-08-08] Engineering practices: mechanical enforcement + real profile in the harness

Branch `claude/guide-me-setup-stuck-mszkyo`.
- `scripts/checkPractices.js` + `.claude/settings.json`: PostToolUse hook on Edit|Write failing any
  write that leaves a TODO/FIXME/XXX/HACK marker or placeholder stub, reporting `file:line` back
  into the session. One rule by design — a checker that guesses at readability or function size
  produces false positives, gets disabled, and takes the real check with it. Repo starts at zero
  markers and `src/checkPractices.test.js` asserts it stays there.
- `.gitignore`: `.claude/` was listed twice and git cannot re-include a file beneath an excluded
  directory, so both entries became `.claude/*` plus `!.claude/settings.json`. `settings.local.json`
  stays ignored.
- The hook caught two defects in its own construction: a false positive on the test that must
  contain the markers it detects (exemption scoped to the detector and its test only), and a
  module-level stdin listener that hung any test requiring the module (`require.main` guard).
- Audited commit 5a8402d against the practices and removed 31 comment lines that restated the
  commit message, `decisions.md` and the tests.
- `scripts/planCityBakeoff.js` now carries the owner's real profile instead of an invented literal:
  food 5, outdoors 5, shopping 4 (fragrances/clothes/Pokemon cards), museums 2, performances 2,
  structured tours 1, nightlife 1, plus budget style and aboutMe. Earlier runs predate 5a8402d, so
  they measured a traveler the planner knew nothing about — they are not a content baseline.
- `CLAUDE.md` Engineering Practices now states always-active status and points at the hook.
249/249 tests.

## [2026-08-08] Phase 1A — deterministic fields out of the plan prompt

Branch `claude/guide-me-setup-stuck-mszkyo`. Plan:
`PROJECT_NOTES/plan-deterministic-prompt-split.md`.

Removed from all three prompts and from the user prompt built in `planCity`:
- **`opening_hours`** — `placesEnrich.applyDetails` overwrites it from Google, and screening on it
  before enrichment is what deleted a full 12-restaurant meal list.
- **`cost_type`** — `normalizeActivity` collapsed anything but the exact string `per_group` to
  `per_person` regardless.
- **`booking_type`** — now derived from type *and cost*. The type-only mapping already in
  `normalizeActivity` disagreed with the model on **36 of 135** saved activities, in both
  directions: it put an affiliate link on free hikes and viewpoints (`sports`/`landmark`
  `none → attraction`) and stripped it from ticketed parks the model had typed `neighborhood`
  (`attraction → none`). Cost was the signal the model was reading. `bookingTypeFor` is now
  meal→restaurant, tour→tour, shopping→none (its cost is spend, not admission), everything else
  `attraction` when it costs something and `none` when it does not.
- **`city`** — `planCity` now passes `shortCity(name)` as the fallback, so `activity.city` stays
  `Lijiang` rather than becoming the qualified `Lijiang, Yunnan, China` that broke image queries.
- **The "no Lunch at / Dinner at prefix" rule** — `stripMealPrefix` in `normalizeActivity` does it
  exactly, mirroring the client-side stripper in `public/js/activityCard.js`.
- **The "each venue appears at most once" rule** — `dedupeByName` was renamed `dedupeActivities`
  and now collapses a repeated non-null `venue_name` as well as a repeated name. Coordinates cannot
  make this call (a district centroid is the correct point for every activity in that district) and
  a null `venue_name` is a design feature, so only a named venue repeating counts as padding.

`suggested_time` stays as intent; the rule that it must fall inside `opening_hours` is gone, since
the model no longer emits hours and `arrangeScheduler` assigns the real time against Google's.

Prompt sizes: `SYSTEM_PROMPT` 4444→2807, `SYSTEM_PROMPT_GPT` 5954→4914, `..._LEAN` 3909→3366.
Output tokens drop by roughly four fields × ~30 activities per city on top of that.

New tests assert no prompt — including the assembled user prompt — mentions a field the pipeline
decides, and that code now supplies each one. 261/261.

**Not yet verified:** `booking_type` drives the GetYourGuide affiliate link, and the derived mapping
differs from the model wherever the model deviated from it (`sports` is the likely case: the mapping
says `attraction`, a free hike arguably wants `none`). Compare the distribution against the saved
bake-off lists before deploying.

## [2026-08-08] Phase 1B — cache aliasing and negative caching; normalisation reverted on measurement

Branch `claude/guide-me-setup-stuck-mszkyo`. `scripts/cacheHitRate.js` (step 0, no API spend)
replayed the 222 venue names in `data/bakeoff/` through each keying scheme:

```
exact key      hits 42  18.9%   distinct 180
normalised     hits 43  19.4%   distinct 179
  gained by normalising: 1
label-only lookups, skippable: 77 (34.7% of all calls)
```

**Reverted: aggressive key normalisation.** Diacritics, punctuation, a leading "The" and the
trailing city qualifier were built, tested and then measured — one extra hit, on a single pair
(`Dukezong Ancient Town` == `Dukezong Ancient Town, Shangri-La`), in exchange for re-keying all 180
existing entries. The production key is back to case and whitespace. The normaliser lives on in
`scripts/cacheHitRate.js` so the comparison stays runnable as the corpus grows or new lookup paths
appear — the measurement only covers plan-generated names, not the add/refine/client paths where the
same venue is queried without a city suffix.

**Correction:** the earlier claim that the hit rate was "near zero by construction" was wrong. It is
**18.9%** — canonical venue names repeat across runs and models far more than that reasoning
assumed. The cache was working; it was the two-calls-per-miss and the label-only lookups that made
the request count large.

**Kept, on structural grounds rather than this measurement:**
- **Alias on resolve** — entries also written under Google's `displayName`. Not measurable offline
  (it needs Places responses), and unlike normalisation it adds keys rather than re-keying, so it
  carries no cold-cache cost.
- **Negative caching** — a genuine `no_place` is remembered for 7 days. `fetchPlaceDetails` now
  returns `{miss:'no_place'}` for that case specifically, so a missing key, HTTP error or timeout
  cannot be frozen in.
- **Ghost flagging** — `unverified: true` rather than deletion, since deleting on `no_place` would
  empty an itinerary during a Places outage.

**Next, and now clearly the priority:** item 3, skipping venue resolution for `venue_name: null`
activities. The measurement puts it at **34.7% of all Places calls** — larger than every caching
layer combined, and it needs no cache at all.

## [2026-08-08] Phase 1B item 3 — venue-less activities ask for the coordinate only

Branch `claude/guide-me-setup-stuck-mszkyo`. Step 0 put label-only lookups at **77 of 222 (34.7%)**
of all Places calls — larger than every caching layer combined, and needing no cache.

An activity with `venue_name: null` is unstructured by design, so its query is a sentence describing
an activity rather than a place. Google still returns its closest text match, and asking for the
full field set bought three problems: a district's gate hours written over the model's time-of-day
intent (7 of the 11 `preferred_time` contradictions found in the blind read), a "venue photo" of
whatever business sounded similar, and a second billed `/media` call to fetch it.

Those lookups now send `places.displayName,places.location` and skip the photo resolve entirely —
one cheaper call instead of two, for a third of all traffic. The coordinate still arrives, so the
map pin survives; the image correctly falls through to the Unsplash city pool. Cached minimal
entries carry `minimal: true` so the photo-migration check does not treat them as permanently stale,
and the in-flight coalescing map is keyed by shape so a minimal and a full lookup of one name cannot
share a promise.

**Removed: ghost flagging.** It set `unverified: true` on the plan path, but nothing in `public/`
renders that field — `/api/activity/replace` already returned it and the frontend already ignored
it. Adding a second producer to an unconsumed field is how the `opening_hours` situation started.
Negative caching stays: unlike the flag it changes behaviour (a ghost is no longer re-billed every
run), though with `ghost 0.0` across every measured run it is insurance rather than a measured
saving, and should be read that way.

Existing `placesEnrich` tests set `name` but not `venue_name` on fixtures whose photos and hours were
under test, so they were taking the new minimal path; `venue_name` added where the fixture is a
venue. New tests pin both paths: the field mask a venue-less lookup sends, that no `/media` call
follows it, that Places hours never reach it, and that a named venue still gets the full set. 271/271.

## [2026-09-09] Landing page visual overhaul (`claude/skill-doctor-1dzu19`)
- Removed the display serif from the landing: dropped `--font-display`, consolidated 13 duplicated
  `.serif` rules into one token-layer rule, and dropped Instrument Serif from the font request
  (`tokens.css`, 6 landing stylesheets, `index.html`).
- Replaced the hero's div-built fake app window (fake tabs, `Itinerary · v03`, fake booking refs,
  "Jane & Jerry") with a real photograph at a ratio that downscales rather than upscales, and cut
  the hero to headline, subtext and two CTAs.
- Deleted the fabricated "Trusted by" logo strip (decisions above).
- Removed all 36 em-dashes from `index.html` and all 57 from the display strings in
  `landing-reel.js` / `landing-demo-profile.js`, rewriting each sentence rather than swapping the
  character; hyphenated 27 en-dash time ranges (`arrangeValidator`'s parser matches `[-–]`, so
  scheduling is unaffected).
- Dropped the three `01/02/03` section-number kickers, 3 dead `data-screen-label` attributes and
  2 decorative status dots; kept the dots that mark live demo state.
- Unified the page theme: chapter 2 is no longer dark, so all content sections are light with a
  dark footer. Removed the now-unreachable `.chapter--dark` rules.
- Fixed WCAG AA on the primary CTA: `--accent` #2F7DFB carried white text at 3.86:1 and is now
  #1560D8 at 5.68:1. All 12 measured text/background pairs now pass.
- Fixed a pre-existing mobile defect: the page scrolled horizontally to 584px at a 375px viewport.
  The chapter grid now uses `minmax(0, 1fr)` and the fixed-width demo panels scroll inside their
  own container; the nav collapses below 640px.
- Added a global `prefers-reduced-motion` reset (safe because the demo choreography is timer-driven
  and never waits on `transitionend`); removed 4 neon accent glows.
- Deleted 683 lines of dead CSS from `landing.css` (911 to 167): `.stage*`, `.features*`, `.feat*`,
  `.flow*`, `.hero__stats*`, `.hero__trust*`, `.heroapp*`, `.hstop*`, `.vis-*`, `.cta*`, `.marquee*`.
- Net: 10 files, +215 / -1104 lines. No file under `src/` touched.

## [2026-09-10] Planner motion pass: easing tokens and reduced motion
- Adopted the existing easing tokens across `public/styles.css`: 62 replacements over 36 lines
  (53 bare `ease`, 4 `ease-in-out`, 3 bare `ease-out`, 2 literal `cubic-bezier(.2,.8,.2,1)`).
  Of 115 transition/animation declarations, 53 had been running on the browser default curve.
  Verified `.panel.active` now computes `cubic-bezier(0.2, 0.8, 0.2, 1)` rather than `ease`.
- Left all 6 `linear` timings alone: they drive spinners, the orbiting plane, the flowing route
  dashes and two progress bars, all of which are correct as linear and would read as broken eased.
- Replaced the enumerated `prefers-reduced-motion` block with a global duration-based collapse,
  closing the 9 of 22 keyframes that escaped it (`btn-spin`, `enrichSpin`, `staging-flash`,
  `cardExpandIn`, `cardExpandOut`, `panelFadeIn`, `chat-panel-in`, `wiz-scrim-in`, `wiz-card-in`).
  Spinners exempted. See decisions above for why duration and not `animation: none`.
- Scope: `public/styles.css` only, which is loaded only by `planner.html`. The landing page and
  `src/` are untouched.
