#!/usr/bin/env node
// Prompt-vs-prompt regression check for planCity.
//
//   node scripts/evalPlan.js --candidate default
//   node scripts/evalPlan.js --smoke --candidate ./my-prompt.txt
//   node scripts/evalPlan.js --candidate gpt --refresh-baseline --judge opus
//
// The baseline arm is whatever planCity ships today. The candidate is the prompt
// under test. Both run through the real pipeline on the same scenarios, get
// checked against the invariants in src/evalChecks.js, and are then judged blind
// and pairwise on what those invariants cannot see.
//
// Needs OPENAI_API_KEY (generation), ANTHROPIC_API_KEY (judge), BRAVE_API_KEY and
// GOOGLE_MAPS_API_KEY. Without the Maps key no venue resolves and
// venueCityMismatch reads zero for every arm.
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const { planCity, SYSTEM_PROMPT, SYSTEM_PROMPT_GPT, SYSTEM_PROMPT_GPT_LEAN } = require('../src/claude');
const { runChecks } = require('../src/evalChecks');
const { installBraveCassette } = require('./lib/braveCassette');
const { openaiArm, instrument, costUsd, targetActivityCount } = require('./lib/planArm');
const { baselineKey, loadBaseline, saveBaseline, isStale, describeAge } = require('./lib/baselineCache');
const { anthropicJudge, comparePair, tallyOutcomes, JUDGE_MODELS, PLAN_CRITERIA } = require('./lib/judge');
const { renderReport } = require('./lib/evalReport');

const OUT_DIR = path.join(__dirname, '..', 'data', 'bakeoff');
const SCENARIO_DIR = path.join(__dirname, '..', 'evals', 'scenarios', 'plan');
const PLAN_MODEL = 'gpt-5.6';
const SMOKE_SCENARIO = 'museum-lover';

// The baseline is what planCity uses when no systemPrompt override is passed.
const NAMED_PROMPTS = { lean: SYSTEM_PROMPT_GPT_LEAN, default: SYSTEM_PROMPT, gpt: SYSTEM_PROMPT_GPT };
const BASELINE_PROMPT = SYSTEM_PROMPT_GPT_LEAN;

function resolvePrompt(spec) {
  if (NAMED_PROMPTS[spec]) return { text: NAMED_PROMPTS[spec], label: spec };
  if (fs.existsSync(spec)) return { text: fs.readFileSync(spec, 'utf8'), label: path.basename(spec) };
  console.error(`Unknown --candidate "${spec}". Use one of ${Object.keys(NAMED_PROMPTS).join(', ')} or a path to a prompt file.`);
  return process.exit(1);
}

function loadScenarios(only) {
  const files = fs.readdirSync(SCENARIO_DIR).filter((f) => f.endsWith('.json'));
  const all = files.map((f) => JSON.parse(fs.readFileSync(path.join(SCENARIO_DIR, f), 'utf8')));
  if (!only?.length) return all;
  const picked = all.filter((s) => only.includes(s.id));
  const missing = only.filter((id) => !all.some((s) => s.id === id));
  if (missing.length) {
    console.error(`Unknown scenario(s): ${missing.join(', ')}. Available: ${all.map((s) => s.id).join(', ')}`);
    process.exit(1);
  }
  return picked;
}

// What the judge needs to tell "suits this traveler" from "is a nice list".
function judgeContext(scenario) {
  const answers = Object.entries(scenario.profile?.answers || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  const party = `${scenario.numTravelers || 1} adult(s)${scenario.numChildren ? `, ${scenario.numChildren} child(ren)` : ''}`;
  return [
    `City: ${scenario.city.name} (${scenario.city.startDate} to ${scenario.city.endDate})`,
    `Party: ${party}`,
    `Ratings (1 = dislikes, 5 = loves): ${answers}`,
    `In their own words: ${scenario.profile?.aboutMe || '(none given)'}`
  ].join('\n');
}

async function generate(scenario, systemPrompt) {
  const { wrapped, stats } = instrument(openaiArm(PLAN_MODEL));
  const started = Date.now();
  const activities = await planCity(
    scenario.city, scenario.profile, 'eval', [], null, null,
    1 + (scenario.otherCities?.length || 0), scenario.numTravelers || 1, scenario.numChildren || 0, [], null,
    { generate: wrapped, systemPrompt }
  );
  return {
    activities,
    servedModel: stats.servedModel,
    seconds: (Date.now() - started) / 1000,
    cost: costUsd(stats.servedModel || PLAN_MODEL, stats.inputTokens, stats.outputTokens),
    truncated: stats.truncated,
    retried: stats.retried
  };
}

// The candidate always runs. The baseline is reused unless the prompt changed,
// the cache is empty, --refresh-baseline was passed, or the provider served a
// different model than the cached run got — the last being the drift that
// re-running the baseline every time was meant to protect against.
async function baselineFor(scenario, { refresh, candidateServedModel }) {
  const key = baselineKey({ scenarioId: scenario.id, systemPrompt: BASELINE_PROMPT, modelId: PLAN_MODEL });
  const cached = loadBaseline(OUT_DIR, key);

  if (!refresh && cached && !isStale(cached, candidateServedModel)) {
    return { ...cached, source: `cached, ${describeAge(cached)}` };
  }
  const reason = refresh ? 'refresh requested' : (cached ? 'served model changed' : 'no cache');
  process.stdout.write(`baseline (${reason}) ... `);
  const fresh = await generate(scenario, null);
  saveBaseline(OUT_DIR, key, fresh);
  return { ...fresh, source: `fresh, ${reason}` };
}

function argValue(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const candidateSpec = argValue(args, '--candidate') || 'lean';
  const candidate = resolvePrompt(candidateSpec);
  const refresh = args.includes('--refresh-baseline');
  const skipJudge = args.includes('--no-judge');
  const judgeModel = JUDGE_MODELS[argValue(args, '--judge') || 'sonnet'] || JUDGE_MODELS.sonnet;

  const only = args.includes('--smoke')
    ? [SMOKE_SCENARIO]
    : (argValue(args, '--scenarios') || '').split(',').filter(Boolean);
  const scenarios = loadScenarios(only);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const cassetteSize = installBraveCassette(OUT_DIR);

  console.log(`Candidate: ${candidate.label}  |  baseline: lean (shipping)  |  model: ${PLAN_MODEL}`);
  console.log(`Scenarios: ${scenarios.map((s) => s.id).join(', ')}\n`);

  const perScenario = [];
  let generationCost = 0;
  let generationCalls = 0;

  for (const scenario of scenarios) {
    process.stdout.write(`  ${scenario.id}: candidate ... `);
    const candidateRun = await generate(scenario, candidate.text);
    generationCalls += 1;
    generationCost += candidateRun.cost || 0;

    const baseline = await baselineFor(scenario, { refresh, candidateServedModel: candidateRun.servedModel });
    if (baseline.source.startsWith('fresh')) {
      generationCalls += 1;
      generationCost += baseline.cost || 0;
    }

    perScenario.push({
      scenario: scenario.id,
      definition: scenario,
      baseline,
      candidate: candidateRun,
      baselineChecks: runChecks(baseline.activities, scenario),
      candidateChecks: runChecks(candidateRun.activities, scenario),
      target: targetActivityCount(scenario.city, scenario.profile)
    });

    fs.writeFileSync(path.join(OUT_DIR, `eval-${scenario.id}-candidate.json`), JSON.stringify(candidateRun.activities, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, `eval-${scenario.id}-baseline.json`), JSON.stringify(baseline.activities, null, 2));
    console.log(`${candidateRun.activities.length}/${targetActivityCount(scenario.city, scenario.profile)} activities · ${baseline.source}`);
  }

  let tally = {};
  const judgeNotes = [];
  let judgeCost = 0;

  if (!skipJudge) {
    console.log(`\nJudging (${judgeModel}, 2 orderings per scenario) ...`);
    const call = anthropicJudge(judgeModel);
    const outcomes = [];
    for (const row of perScenario) {
      const { outcome, usage } = await comparePair({
        call,
        context: judgeContext(row.definition),
        baseline: row.baseline.activities,
        candidate: row.candidate.activities
      });
      outcomes.push({ outcome });
      judgeCost += costUsd(usage.servedModel || judgeModel, usage.inputTokens, usage.outputTokens) || 0;
      for (const [criterion, result] of Object.entries(outcome)) {
        if (result.winner !== 'tie') judgeNotes.push({ criterion, scenario: row.scenario, winner: result.winner, reason: result.reason });
      }
    }
    tally = tallyOutcomes(outcomes);
  }

  const { text } = renderReport({
    title: `Prompt eval — lean → ${candidate.label}`,
    perScenario,
    tally,
    judgeNotes,
    outDir: OUT_DIR,
    run: {
      scenarios: scenarios.length,
      genCalls: generationCalls,
      genCost: `$${generationCost.toFixed(2)}`,
      judgeModel: skipJudge ? 'skipped' : judgeModel,
      judgeCost: skipJudge ? '—' : `$${judgeCost.toFixed(2)}`,
      cassette: `${cassetteSize()} Brave entries replayed`
    }
  });

  fs.writeFileSync(path.join(OUT_DIR, 'judge-report.md'), `${text}\n`);
  console.log(`\n${text}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
