#!/usr/bin/env node
// Compares models for planCity on the trip that surfaced the slow-plan report.
//
//   node scripts/planCityBakeoff.js [--runs 3] [--arms sonnet-4-6,sonnet-5-medium]
//                                   [--split N] [--prompt default|gpt|lean]
//
// Needs ANTHROPIC_API_KEY, OPENAI_API_KEY, BRAVE_API_KEY and GOOGLE_MAPS_API_KEY.
// Without the Maps key every venue lookup short-circuits and the venue-resolution
// column — the best automated quality signal here — reads zero for every arm.
//
// Brave results are recorded to a cassette on the first run and replayed after,
// so every arm answers the same prompt. Places lookups stay live: arms invent
// different venue names, and whether those names resolve is the measurement.
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const { planCity, SYSTEM_PROMPT_GPT, SYSTEM_PROMPT_GPT_LEAN } = require('../src/claude');
const { installBraveCassette } = require('./lib/braveCassette');
const {
  costUsd,
  anthropicArm,
  openaiArm,
  instrument,
  targetActivityCount,
  distinctVenues,
  summariseOutcomes
} = require('./lib/planArm');

const OUT_DIR = path.join(__dirname, '..', 'data', 'bakeoff');

const TRIP = {
  // The owner's real profile, mapped from their own description. Until 5a8402d
  // none of this reached the model, so runs before that one measured a traveler
  // the planner knew nothing about beyond the pace.
  profile: {
    answers: {
      pace: 3,
      foodTravel: 5,
      outdoorNature: 5,
      shoppingPerson: 4,
      museumPerson: 2,
      livePerformances: 2,
      structuredTours: 1,
      nightlifeBars: 1,
      shoppingInterests: 'fragrances, clothes, Pokemon cards',
      budgetStyle: 'Budget-conscious overall, with one exceptional splurge meal per city'
    },
    aboutMe: 'Food-focused explorer who seeks out local culinary scenes and prefers spicy cuisines. '
      + 'Happy to splurge on one standout meal per city and stay budget-conscious elsewhere. '
      + 'Wants nature and outdoor adventure at an unhurried pace.'
  },
  cities: [
    { name: 'Lijiang, Yunnan, China', startDate: '2026-10-08', endDate: '2026-10-13', leaveTime: '18:00', latitude: 26.8721, longitude: 100.2299, accommodation: { address: '' } },
    { name: 'Shangri-La City, Diqing Tibetan Autonomous Prefecture, Yunnan, China', startDate: '2026-10-13', endDate: '2026-10-17', leaveTime: '18:00', latitude: 27.8269, longitude: 99.7065, accommodation: { address: '' } }
  ]
};

const ARMS = {
  'sonnet-4-6': () => anthropicArm('claude-sonnet-4-6', null),
  'sonnet-5-medium': () => anthropicArm('claude-sonnet-5', 'medium'),
  'sonnet-5-high': () => anthropicArm('claude-sonnet-5', 'high'),
  'gpt-5.6': () => openaiArm('gpt-5.6')
};

let SPLIT_DAYS = null;
let SYSTEM_PROMPT_OVERRIDE = null;
let PROMPT_LABEL = 'default';

async function runArm(armName, runIndex) {
  const generate = ARMS[armName]();
  const rows = [];
  // A prompt is as much an arm as a model is, so it rides in the row and filename.
  const armLabel = PROMPT_LABEL === 'default' ? armName : `${armName}+${PROMPT_LABEL}`;

  for (const city of TRIP.cities) {
    const { wrapped, stats } = instrument(generate);
    const outcomes = [];
    const started = Date.now();
    let activities = [];
    let error = null;

    try {
      activities = await planCity(
        city, TRIP.profile, 'bakeoff', [], null, null,
        TRIP.cities.length, 1, 0, [], null,
        { generate: wrapped, splitDays: SPLIT_DAYS, systemPrompt: SYSTEM_PROMPT_OVERRIDE, onEnrichOutcome: (o) => outcomes.push(o) }
      );
    } catch (err) {
      error = err.message;
    }

    const resolved = activities.filter((a) => Number.isFinite(a?.location?.lat) && a.location.lat !== 0).length;
    const withPhoto = activities.filter((a) => a?.imageUrl).length;
    const seconds = (Date.now() - started) / 1000;
    const cost = costUsd(stats.servedModel || generate.modelId, stats.inputTokens, stats.outputTokens);

    rows.push({
      arm: armLabel,
      run: runIndex,
      servedModel: stats.servedModel,
      city: city.name.split(',')[0],
      seconds,
      // The number the arms are actually comparable on: sec/city rewards a model
      // for generating fewer activities than asked.
      secondsPerActivity: activities.length ? seconds / activities.length : null,
      target: targetActivityCount(city, TRIP.profile),
      retried: stats.retried,
      truncated: stats.truncated,
      stopReasons: stats.calls.map((c) => c.stopReason),
      windows: stats.calls.length,
      raw: stats.rawActivities,
      kept: activities.length,
      resolved,
      distinctVenues: distinctVenues(activities),
      withPhoto,
      ...summariseOutcomes(outcomes),
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      cost,
      costPerActivity: cost != null && activities.length ? cost / activities.length : null,
      error
    });

    const slug = `${armLabel}-run${runIndex}-${city.name.split(',')[0].replace(/\s+/g, '_')}`;
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(activities, null, 2));
    // Insurance: with the raw text on disk, a metric neither of us thought of is
    // recomputable offline instead of costing another matrix.
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.raw.json`), JSON.stringify({ calls: stats.calls, outcomes }, null, 2));
  }

  return rows;
}

function mean(values) {
  const usable = values.filter((v) => v != null);
  return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null;
}

// Emitted to stdout and to a markdown file, because the run happens wherever the
// API keys live and the numbers have to travel back to whoever decides.
function report(rows) {
  const arms = [...new Set(rows.map((r) => r.arm))];
  const fmt = (v, digits = 1) => (v == null ? '—' : v.toFixed(digits));
  const lines = [];

  lines.push(`# planCity bake-off — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  lines.push('');
  lines.push('| arm | runs | sec/act | sec/city | kept/target | distinct% | resolved% | meals ok | hours ok% | ghost | tooFar | retry% | trunc% | photo% | $/act | $/city |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');

  for (const arm of arms) {
    const armRows = rows.filter((r) => r.arm === arm && !r.error);
    if (!armRows.length) {
      lines.push(`| ${arm} | — | all runs failed: ${rows.find((r) => r.arm === arm)?.error} | | | | | | | |`);
      continue;
    }
    const pct = (predicate) => (armRows.filter(predicate).length / armRows.length) * 100;
    const ratio = (num, den) => mean(armRows.map((r) => (r[den] ? (r[num] / r[den]) * 100 : null)));
    const cost = mean(armRows.map((r) => r.cost));
    const costPerAct = mean(armRows.map((r) => r.costPerActivity));

    lines.push([
      '', arm, armRows.length,
      fmt(mean(armRows.map((r) => r.secondsPerActivity)), 2),
      fmt(mean(armRows.map((r) => r.seconds))),
      `${fmt(mean(armRows.map((r) => r.kept)), 0)}/${fmt(mean(armRows.map((r) => r.target)), 0)}`,
      fmt(ratio('distinctVenues', 'resolved'), 0),
      fmt(ratio('resolved', 'kept'), 0),
      `${fmt(mean(armRows.map((r) => r.mealResolved)), 0)}/${fmt(mean(armRows.map((r) => r.mealTotal)), 0)}`,
      fmt(ratio('hoursMatched', 'hoursComparable'), 0),
      fmt(mean(armRows.map((r) => r.ghost)), 1),
      fmt(mean(armRows.map((r) => r.tooFar)), 1),
      fmt(pct((r) => r.retried), 0),
      fmt(pct((r) => r.truncated), 0),
      fmt(ratio('withPhoto', 'kept'), 0),
      costPerAct == null ? '—' : `$${costPerAct.toFixed(4)}`,
      cost == null ? '—' : `$${cost.toFixed(3)}`,
      ''
    ].join(' | ').trim());
  }

  lines.push('');
  lines.push('Read `sec/act`, not `sec/city` — a model that under-delivers against `kept/target`');
  lines.push('looks fast for the wrong reason. Sonnet 4.6 baselines at ~6.2 sec/act.');
  lines.push('');
  lines.push('`ghost` is the cleanest model signal: the model named a venue and Google has never');
  lines.push('heard of it. Activities the model left venue_name null are excluded — those are');
  lines.push('unstructured by design. `tooFar` is a real venue beyond the day-trip radius, usually');
  lines.push('not the model\'s fault — read it with the distance, since a hit 460km away is a ghost');
  lines.push('wearing a real venue\'s name. `meals ok` is resolved over generated, not a percentage, because a model can also\nproduce no meals at all — a 0/0 that a percentage column would hide behind a dash.\nIt matters on its own: restaurants carry the');
  lines.push('strictest naming rules and are where the baseline failed. `hours ok%` skips 24/7');
  lines.push('Places results, which mean "no hours on file" rather than "open always".');
  lines.push('');
  lines.push('`distinct%` catches a model padding to hit the target by selling one place three');
  lines.push('times. Compare it across arms, never read it as an absolute: Places itself collapses');
  lines.push('distinct venues onto one point often enough to set a floor no model can clear.');
  lines.push('');
  lines.push('No metric here catches a model putting the wrong city\'s venue in a list — Sonnet 4.6');
  lines.push('offered Shangri-La\'s Dukezong Old Town in Lijiang and Places snapped it to a Lijiang');
  lines.push('coordinate, so it scored as a clean resolve. That is what the blind read is for.');
  lines.push('');
  lines.push('Decision rule: quality first — `ghost`, `meals ok` and `hours ok%`, with `distinct%`');
  lines.push('as a cross-arm comparison. Not `resolved%`, which sat at 98% on the baseline and');
  lines.push('cannot separate the arms. On a quality tie, prefer Sonnet 5 (no prompt re-tuning) and');
  lines.push('choose the effort rung on `sec/act` and `$/act`. Faster but worse loses: splitting the');
  lines.push('call is a ~3x speed lever available to every arm, so speed is the cheap axis here.');
  lines.push('');
  lines.push(`Per-arm activity lists are in \`${path.relative(process.cwd(), OUT_DIR)}/\` — read a few blind before trusting the table.`);
  if (rows.some((r) => r.cost == null)) lines.push('A missing `$/city` means that model has no confirmed price yet.');
  if (rows.some((r) => r.truncated)) lines.push('**WARNING:** an arm hit its output cap. Raise `MAX_OUTPUT_TOKENS` and re-run before believing its yield.');

  const text = lines.join('\n');
  console.log('\n' + text);
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), text + '\n');
  console.log(`\nWritten to ${path.relative(process.cwd(), path.join(OUT_DIR, 'report.md'))} — paste that file to share the result.`);
}

async function main() {
  const args = process.argv.slice(2);
  const runs = Number(args[args.indexOf('--runs') + 1]) || 3;
  // --split N generates the stay as parallel N-day windows instead of one call.
  // Off by default so the baseline arm stays comparable to production.
  SPLIT_DAYS = args.includes('--split') ? Number(args[args.indexOf('--split') + 1]) || null : null;

  // Run the same arms twice, once each way, and the pair isolates the prompt.
  PROMPT_LABEL = args.includes('--prompt') ? String(args[args.indexOf('--prompt') + 1] || 'default') : 'default';
  const PROMPTS = { default: null, gpt: SYSTEM_PROMPT_GPT, lean: SYSTEM_PROMPT_GPT_LEAN };
  if (!(PROMPT_LABEL in PROMPTS)) {
    console.error(`Unknown --prompt ${PROMPT_LABEL}. Available: ${Object.keys(PROMPTS).join(', ')}`);
    process.exit(1);
  }
  SYSTEM_PROMPT_OVERRIDE = PROMPTS[PROMPT_LABEL];

  const selected = args.includes('--arms')
    ? args[args.indexOf('--arms') + 1].split(',')
    : Object.keys(ARMS);

  const unknown = selected.filter((a) => !ARMS[a]);
  if (unknown.length) {
    console.error(`Unknown arm(s): ${unknown.join(', ')}. Available: ${Object.keys(ARMS).join(', ')}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const cassetteSize = installBraveCassette(OUT_DIR);

  console.log(`Arms: ${selected.join(', ')}`);
  console.log(`Runs per arm: ${runs}  |  Cities: ${TRIP.cities.length}`);

  const rows = [];
  for (const arm of selected) {
    for (let run = 1; run <= runs; run += 1) {
      process.stdout.write(`  ${arm} run ${run}/${runs} ... `);
      const armRows = await runArm(arm, run);
      const failed = armRows.filter((r) => r.error);
      console.log(failed.length ? `FAILED: ${failed[0].error}` : `${armRows.map((r) => `${r.seconds.toFixed(0)}s`).join(' + ')}`);
      rows.push(...armRows);
    }
  }

  console.log(`\nBrave cassette entries: ${cassetteSize()} (replayed identically to every arm)`);
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(rows, null, 2));
  report(rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
