const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { resolveSwap, tallyOutcomes, comparePair, buildJudgePrompt, PLAN_CRITERIA } = require('../scripts/lib/judge');
const { verdictFor, invariantDeltas, JUDGE_LOSS_MARGIN } = require('../scripts/lib/evalReport');
const { baselineKey, loadBaseline, saveBaseline, isStale } = require('../scripts/lib/baselineCache');
const { costUsd, targetActivityCount, distinctVenues, summariseOutcomes } = require('../scripts/lib/planArm');

// --- the position swap, which is the whole reliability claim -----------------

test('the same content winning from both slots is a real win', () => {
  // Round 1 has baseline in slot A; round 2 has candidate there. Baseline
  // winning means A then B.
  assert.equal(resolveSwap({ winner: 'A' }, { winner: 'B' }).winner, 'baseline');
  assert.equal(resolveSwap({ winner: 'B' }, { winner: 'A' }).winner, 'candidate');
});

test('the same SLOT winning twice is position bias, recorded as a tie', () => {
  // A both times: baseline in round 1, candidate in round 2 — the judge is
  // picking the position, not the list.
  const slotA = resolveSwap({ winner: 'A' }, { winner: 'A' });
  assert.equal(slotA.winner, 'tie');
  assert.equal(slotA.positionBias, true);

  const slotB = resolveSwap({ winner: 'B' }, { winner: 'B' });
  assert.equal(slotB.winner, 'tie');
  assert.equal(slotB.positionBias, true);
});

test('an explicit tie in either ordering yields a tie', () => {
  assert.equal(resolveSwap({ winner: 'tie' }, { winner: 'B' }).winner, 'tie');
  assert.equal(resolveSwap({ winner: 'A' }, { winner: 'tie' }).winner, 'tie');
});

test('comparePair calls the judge twice with the lists in opposite slots', async () => {
  const prompts = [];
  const call = async (prompt) => {
    prompts.push(prompt);
    return { text: '{"profileFit":{"winner":"A","reason":"r"}}', inputTokens: 10, outputTokens: 2 };
  };

  const { outcome } = await comparePair({
    call,
    criteria: [PLAN_CRITERIA[0]],
    context: 'ctx',
    baseline: [{ name: 'BASE_ONLY', type: 'meal' }],
    candidate: [{ name: 'CAND_ONLY', type: 'meal' }]
  });

  assert.equal(prompts.length, 2);
  assert.ok(prompts[0].indexOf('BASE_ONLY') < prompts[0].indexOf('CAND_ONLY'), 'round 1 puts baseline first');
  assert.ok(prompts[1].indexOf('CAND_ONLY') < prompts[1].indexOf('BASE_ONLY'), 'round 2 puts candidate first');
  // "A" both rounds is the same slot twice, so it must not score a win.
  assert.equal(outcome.profileFit.winner, 'tie');
});

test('an unparseable judge response degrades to ties, never to a winner', async () => {
  const call = async () => ({ text: 'I cannot decide.', inputTokens: 1, outputTokens: 1 });
  const { outcome } = await comparePair({ call, context: 'c', baseline: [], candidate: [] });
  for (const criterion of PLAN_CRITERIA) {
    assert.equal(outcome[criterion.id].winner, 'tie');
  }
});

test('unparseable judge output is counted, so it cannot pass as agreement', async () => {
  // Degrading to ties is safe for the verdict but makes a broken judge look
  // identical to an agreeable one — a run of all ties could be either.
  const broken = async () => ({ text: 'I cannot decide.', inputTokens: 1, outputTokens: 1 });
  const brokenRun = await comparePair({ call: broken, context: 'c', baseline: [], candidate: [] });
  assert.equal(brokenRun.unparsed, 2, 'both orderings failed to parse');
  assert.match(brokenRun.unparsedHead, /I cannot decide/);

  const working = async () => ({ text: '{"profileFit":{"winner":"tie","reason":"even"}}', inputTokens: 1, outputTokens: 1 });
  const workingRun = await comparePair({ call: working, criteria: [PLAN_CRITERIA[0]], context: 'c', baseline: [], candidate: [] });
  assert.equal(workingRun.unparsed, 0, 'a genuine tie is not an unparsed response');
  assert.equal(workingRun.outcome.profileFit.winner, 'tie');
});

test('the judge prompt names every criterion and offers tie as an answer', () => {
  const prompt = buildJudgePrompt({ criteria: PLAN_CRITERIA, context: 'ctx', first: [], second: [] });
  for (const criterion of PLAN_CRITERIA) assert.ok(prompt.includes(criterion.id), `${criterion.id} in prompt`);
  assert.match(prompt, /Use "tie" honestly/);
});

test('tallyOutcomes counts wins per criterion across scenarios', () => {
  const tally = tallyOutcomes([
    { outcome: { specificity: { winner: 'baseline' }, profileFit: { winner: 'tie' } } },
    { outcome: { specificity: { winner: 'baseline' }, profileFit: { winner: 'candidate' } } }
  ]);
  assert.deepEqual(tally.specificity, { baseline: 2, candidate: 0, tie: 0 });
  assert.deepEqual(tally.profileFit, { baseline: 0, candidate: 1, tie: 1 });
});

// --- the verdict rule --------------------------------------------------------

const findings = (check, count, severity) => Array.from({ length: count }, () => ({ check, severity, detail: `${check} detail` }));
const arm = (check, count, severity) => ({ byCheck: count ? { [check]: count } : {}, findings: findings(check, count, severity) });
const row = (scenario, base, cand) => ({ scenario, baselineChecks: base, candidateChecks: cand });

test('a new high-severity finding on the candidate is a regression', () => {
  const deltas = invariantDeltas([row('museum-lover', arm('typeMixVsProfile', 0), arm('typeMixVsProfile', 1, 'high'))]);
  const verdict = verdictFor({ deltas, tally: {} });
  assert.equal(verdict.status, 'DEGRADED');
  assert.match(verdict.reasons[0], /1 new high-severity invariant finding \(museum-lover\)/);
});

test('a new MEDIUM finding is advisory, not a regression', () => {
  // The null-change control failed on exactly this: two runs of the same prompt
  // differed by one medium finding and the harness reported DEGRADED.
  const deltas = invariantDeltas([row('museum-lover', arm('selfContradictingPitfall', 0), arm('selfContradictingPitfall', 1, 'medium'))]);
  assert.equal(verdictFor({ deltas, tally: {} }).status, 'PASS');
  assert.equal(deltas[0].regressed, false);
  assert.equal(deltas[0].cand, 1, 'still counted and printed');
});

test('a finding present on both arms is not a regression', () => {
  const deltas = invariantDeltas([row('owner-yunnan', arm('mealCoverage', 1, 'high'), arm('mealCoverage', 1, 'high'))]);
  assert.equal(verdictFor({ deltas, tally: {} }).status, 'PASS');
});

test('the candidate FIXING a finding is not a regression', () => {
  const deltas = invariantDeltas([row('owner-yunnan', arm('repeatedVenues', 3, 'high'), arm('repeatedVenues', 0))]);
  assert.equal(verdictFor({ deltas, tally: {} }).status, 'PASS');
});

test('a judge criterion must lose by the margin, not merely lose', () => {
  const oneLoss = { specificity: { baseline: 1, candidate: 0, tie: 4 } };
  assert.equal(verdictFor({ deltas: [], tally: oneLoss }).status, 'PASS');

  const marginLoss = { specificity: { baseline: JUDGE_LOSS_MARGIN, candidate: 0, tie: 3 } };
  const verdict = verdictFor({ deltas: [], tally: marginLoss });
  assert.equal(verdict.status, 'DEGRADED');
  assert.match(verdict.reasons[0], /specificity lost/);
});

test('all ties is a PASS — the null-change control must come back clean', () => {
  const allTies = Object.fromEntries(PLAN_CRITERIA.map((c) => [c.id, { baseline: 0, candidate: 0, tie: 5 }]));
  assert.equal(verdictFor({ deltas: [], tally: allTies }).status, 'PASS');
});

// --- the baseline cache ------------------------------------------------------

test('the cache key changes with the prompt, the model and the scenario', () => {
  const base = { scenarioId: 's', systemPrompt: 'p', modelId: 'm' };
  const key = baselineKey(base);
  assert.notEqual(key, baselineKey({ ...base, systemPrompt: 'p2' }));
  assert.notEqual(key, baselineKey({ ...base, modelId: 'm2' }));
  assert.notEqual(key, baselineKey({ ...base, scenarioId: 's2' }));
  assert.equal(key, baselineKey(base), 'same inputs give the same key');
  assert.match(key, /^s-[0-9a-f]{12}$/);
});

test('a cached baseline whose served model changed is discarded', () => {
  // This is what replaced "re-run the baseline every time": the provider-side
  // change that made re-running worthwhile is visible in servedModel.
  assert.equal(isStale({ servedModel: 'gpt-5.6-terra' }, 'gpt-5.6-terra'), false);
  assert.equal(isStale({ servedModel: 'gpt-5.6-terra' }, 'gpt-5.6-sol'), true);
  assert.equal(isStale(null, 'gpt-5.6-terra'), true);
  // An arm that reported no served model cannot prove staleness either way.
  assert.equal(isStale({ servedModel: 'gpt-5.6-terra' }, null), false);
});

test('a saved baseline round-trips and carries a timestamp', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-cache-'));
  saveBaseline(dir, 'k', { activities: [{ name: 'X' }], servedModel: 'gpt-5.6-terra' });
  const loaded = loadBaseline(dir, 'k');
  assert.equal(loaded.activities[0].name, 'X');
  assert.equal(loaded.servedModel, 'gpt-5.6-terra');
  assert.ok(loaded.savedAt > 0);
  assert.equal(loadBaseline(dir, 'missing'), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

// --- the committed corpus ----------------------------------------------------

// A typo in a scenario file should cost nothing. Without this it surfaces
// mid-run, after the generation call it invalidates has already been paid for.
const scenarioDir = (kind) => path.join(__dirname, '..', 'evals', 'scenarios', kind);
const loadAll = (kind) => fs.readdirSync(scenarioDir(kind))
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(scenarioDir(kind), f), 'utf8')) }));

test('every plan scenario is well-formed and runnable', () => {
  const { runChecks, stayDays } = require('./evalChecks');
  const seen = new Set();

  for (const { file, data } of loadAll('plan')) {
    assert.ok(data.id, `${file}: missing id`);
    assert.equal(`${data.id}.json`, file, `${file}: id must match filename so --scenarios matches the corpus`);
    assert.ok(!seen.has(data.id), `${file}: duplicate id`);
    seen.add(data.id);

    assert.ok(data.city?.name, `${file}: missing city.name`);
    assert.ok(Number.isFinite(data.city.latitude) && Number.isFinite(data.city.longitude), `${file}: city needs coordinates`);
    assert.ok(stayDays(data.city) > 0, `${file}: end date must not precede start date`);
    assert.ok(Object.keys(data.profile?.answers || {}).length >= 5, `${file}: profile needs the rating axes`);
    assert.ok(data.profile.aboutMe, `${file}: aboutMe is what the judge reads for fit`);

    // A scenario the checks throw on is worse than no scenario.
    assert.doesNotThrow(() => runChecks([], data), `${file}: runChecks failed`);
  }
  assert.ok(seen.size >= 4, 'the corpus must keep enough opposed profiles to catch an over-correction');
});

test('every chat scenario is well-formed and runnable', () => {
  const { runChatChecks } = require('./evalChatChecks');
  for (const { file, data } of loadAll('chat')) {
    assert.equal(`${data.id}.json`, file, `${file}: id must match filename`);
    assert.ok(data.message, `${file}: missing message`);
    assert.ok(data.tripContext?.cities?.length, `${file}: needs at least one city in tripContext`);
    assert.doesNotThrow(
      () => runChatChecks({ reply: 'A reply.', signals: [], expect: data.expect || {}, searchResults: data.searchResults }),
      `${file}: runChatChecks failed`
    );
  }
});

test('the smoke scenario named by evalPlan.js exists in the corpus', () => {
  // --smoke hardcodes one scenario id; renaming the file without it is a
  // failure that would only appear when someone reaches for the cheap run.
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'evalPlan.js'), 'utf8');
  const smokeId = source.match(/SMOKE_SCENARIO\s*=\s*'([^']+)'/)[1];
  assert.ok(loadAll('plan').some(({ data }) => data.id === smokeId), `--smoke points at "${smokeId}", which is not in the corpus`);
});

// --- metrics moved out of planCityBakeoff.js, which had no tests -------------

test('cost is null for a model with no confirmed price, not zero', () => {
  assert.equal(costUsd('gpt-5.6', 1e6, 1e6), null);
  assert.equal(costUsd('claude-sonnet-4-6', 1e6, 1e6), 18);
});

test('the activity target scales with pace and stay length', () => {
  const city = { startDate: '2026-10-08', endDate: '2026-10-10' };
  assert.equal(targetActivityCount(city, { answers: { pace: 3 } }), 18);
  assert.equal(targetActivityCount(city, { answers: { pace: 1 } }), 12);
  assert.equal(targetActivityCount(city, {}), 18, 'pace defaults to 3');
});

test('distinctVenues ignores unresolved and null-island coordinates', () => {
  assert.equal(distinctVenues([
    { location: { lat: 26.8721, lng: 100.2299 } },
    { location: { lat: 26.87211, lng: 100.22991 } },
    { location: { lat: 0, lng: 0 } },
    { location: { lat: null, lng: null } },
    { location: { lat: 27.8269, lng: 99.7065 } }
  ]), 2);
});

test('hours are only scored where Places actually had hours on file', () => {
  const summary = summariseOutcomes([
    { type: 'meal', status: 'resolved', llmHours: '09:00-17:00', placesHours: '09:00-17:00' },
    { type: 'meal', status: 'no_place', venueName: 'Ghost Diner' },
    { type: 'landmark', status: 'resolved', llmHours: '09:00-17:00', placesHours: '00:00-23:59' }
  ]);
  assert.equal(summary.mealTotal, 2);
  assert.equal(summary.mealResolved, 1);
  assert.equal(summary.ghost, 1);
  assert.equal(summary.hoursComparable, 1, 'the 24/7 result means "no hours on file" and is skipped');
  assert.equal(summary.hoursMatched, 1);
});
