#!/usr/bin/env node
// Compares models for planCity on the trip that surfaced the slow-plan report.
//
//   node scripts/planCityBakeoff.js [--runs 3] [--arms sonnet-4-6,sonnet-5-medium]
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
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

const { planCity } = require('../src/claude');
const { extractText, tryParseJsonArray } = require('../src/services/llmJson');

const OUT_DIR = path.join(__dirname, '..', 'data', 'bakeoff');
const CASSETTE = path.join(OUT_DIR, 'brave-cassette.json');
const MAX_OUTPUT_TOKENS = 64000;

// Per million tokens. Sonnet 5 is on introductory pricing through 2026-08-31.
// GPT-5.6 is deliberately null: confirm it upstream rather than guess here.
const PRICING = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'gpt-5.6': null
};

const TRIP = {
  profile: { answers: { pace: 3, museumPerson: 2, foodTravel: 5, livePerformances: 2, outdoorNature: 4, nightlifeBars: 3 } },
  cities: [
    { name: 'Lijiang, Yunnan, China', startDate: '2026-10-08', endDate: '2026-10-13', leaveTime: '18:00', latitude: 26.8721, longitude: 100.2299, accommodation: { address: '' } },
    { name: 'Shangri-La City, Diqing Tibetan Autonomous Prefecture, Yunnan, China', startDate: '2026-10-13', endDate: '2026-10-17', leaveTime: '18:00', latitude: 27.8269, longitude: 99.7065, accommodation: { address: '' } }
  ]
};

function installBraveCassette() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const cassette = fs.existsSync(CASSETTE) ? JSON.parse(fs.readFileSync(CASSETTE, 'utf8')) : {};
  const realFetch = global.fetch;

  global.fetch = async (url, options) => {
    const target = String(url);
    if (!target.includes('api.search.brave.com')) return realFetch(url, options);

    const query = new URL(target).searchParams.get('q');
    if (cassette[query]) return { ok: true, json: async () => cassette[query] };

    const res = await realFetch(url, options);
    if (!res.ok) return res;
    const data = await res.json();
    cassette[query] = data;
    fs.writeFileSync(CASSETTE, JSON.stringify(cassette, null, 2));
    return { ok: true, json: async () => data };
  };

  return () => Object.keys(cassette).length;
}

function anthropicArm(model, effort) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const generate = async ({ system, prompt }) => {
    const params = { model, max_tokens: MAX_OUTPUT_TOKENS, system, messages: [{ role: 'user', content: prompt }] };
    if (effort) params.output_config = { effort };
    const final = await client.messages.stream(params).finalMessage();
    return {
      text: extractText(final.content),
      stop_reason: final.stop_reason,
      inputTokens: final.usage?.input_tokens || 0,
      outputTokens: final.usage?.output_tokens || 0
    };
  };
  generate.modelId = model;
  return generate;
}

function openaiArm(model) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const generate = async ({ system, prompt }) => {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }]
    });
    const choice = res.choices?.[0];
    return {
      text: choice?.message?.content || '',
      stop_reason: choice?.finish_reason,
      inputTokens: res.usage?.prompt_tokens || 0,
      outputTokens: res.usage?.completion_tokens || 0
    };
  };
  generate.modelId = model;
  return generate;
}

const ARMS = {
  'sonnet-4-6': () => anthropicArm('claude-sonnet-4-6', null),
  'sonnet-5-medium': () => anthropicArm('claude-sonnet-5', 'medium'),
  'sonnet-5-high': () => anthropicArm('claude-sonnet-5', 'high'),
  'gpt-5.6': () => openaiArm('gpt-5.6')
};

// What the prompt asks each city for, so a model that quietly under-delivers is
// visible rather than just looking fast.
function targetActivityCount(city, profile) {
  const nonMealPerDay = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }[
    Math.max(1, Math.min(5, Math.round(Number(profile?.answers?.pace) || 3)))
  ];
  const days = Math.round((new Date(city.endDate) - new Date(city.startDate)) / 86400000) + 1;
  return (nonMealPerDay + 2) * days;
}

// Wraps an arm so the harness can see what planCity does not return: how many
// generations it took (a second one means the JSON failed to parse), how many
// activities the model actually emitted before filtering, and token spend.
const RETRY_MARKER = 'IMPORTANT: Return ONLY a valid JSON array';
let SPLIT_DAYS = null;

function instrument(generate) {
  const stats = { calls: [], rawActivities: 0, inputTokens: 0, outputTokens: 0, truncated: false, retried: false };
  const wrapped = async (args) => {
    const result = await generate(args);
    stats.inputTokens += result.inputTokens;
    stats.outputTokens += result.outputTokens;
    if (['max_tokens', 'length'].includes(result.stop_reason)) stats.truncated = true;
    if (String(args.prompt).includes(RETRY_MARKER)) stats.retried = true;
    const parsed = tryParseJsonArray(result.text);
    // A failed parse contributes nothing and its retry contributes the real
    // count, so summing stays correct across both retries and split windows.
    if (parsed) stats.rawActivities += parsed.length;
    stats.calls.push({
      promptChars: String(args.prompt).length,
      stopReason: result.stop_reason,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      parsed: parsed ? parsed.length : null,
      text: result.text
    });
    return result;
  };
  wrapped.modelId = generate.modelId;
  return { wrapped, stats };
}

function costUsd(modelId, inputTokens, outputTokens) {
  const price = PRICING[modelId];
  if (!price) return null;
  return (inputTokens / 1e6) * price.in + (outputTokens / 1e6) * price.out;
}

// Rounded to ~11m, the same key planCity dedupes on.
function distinctVenues(activities) {
  const keys = new Set();
  for (const a of activities) {
    const lat = Number(a?.location?.lat);
    const lng = Number(a?.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    keys.add(`${lat.toFixed(4)},${lng.toFixed(4)}`);
  }
  return keys.size;
}

function summariseOutcomes(outcomes) {
  const isMeal = (o) => String(o.type || '').toLowerCase() === 'meal';
  const comparable = outcomes.filter((o) => o.llmHours && o.placesHours);
  return {
    noPlace: outcomes.filter((o) => o.status === 'no_place').length,
    tooFar: outcomes.filter((o) => o.status === 'too_far').length,
    mealTotal: outcomes.filter(isMeal).length,
    mealResolved: outcomes.filter((o) => isMeal(o) && o.status === 'resolved').length,
    hoursComparable: comparable.length,
    hoursMatched: comparable.filter((o) => o.llmHours === o.placesHours).length
  };
}

async function runArm(armName, runIndex) {
  const generate = ARMS[armName]();
  const rows = [];

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
        { generate: wrapped, splitDays: SPLIT_DAYS, onEnrichOutcome: (o) => outcomes.push(o) }
      );
    } catch (err) {
      error = err.message;
    }

    const resolved = activities.filter((a) => Number.isFinite(a?.location?.lat) && a.location.lat !== 0).length;
    const withPhoto = activities.filter((a) => a?.imageUrl).length;
    const seconds = (Date.now() - started) / 1000;
    const cost = costUsd(generate.modelId, stats.inputTokens, stats.outputTokens);

    rows.push({
      arm: armName,
      run: runIndex,
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

    const slug = `${armName}-run${runIndex}-${city.name.split(',')[0].replace(/\s+/g, '_')}`;
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
  lines.push('| arm | runs | sec/act | sec/city | kept/target | distinct% | resolved% | meal res% | hours ok% | noPlace | tooFar | retry% | trunc% | photo% | $/act | $/city |');
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
      fmt(ratio('mealResolved', 'mealTotal'), 0),
      fmt(ratio('hoursMatched', 'hoursComparable'), 0),
      fmt(mean(armRows.map((r) => r.noPlace)), 1),
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
  lines.push('`distinct%` is unique venues over resolved ones: it catches a model padding to hit');
  lines.push('the target by selling the same place three times, which `resolved%` scores as a win.');
  lines.push('`resolved%` split into `noPlace` (invented venue — the real quality signal) and');
  lines.push('`tooFar` (real venue beyond the day-trip radius, usually not the model\'s fault).');
  lines.push('`meal res%` matters on its own: restaurants carry the strictest naming rules and are');
  lines.push('where the baseline failed. `hours ok%` is how often the model\'s opening hours matched');
  lines.push('Google — the baseline was 0 for 3 on Pudacuo, inventing evening hours for a park that');
  lines.push('shuts at 16:30.');
  lines.push('');
  lines.push('Decision rule: quality first — `distinct%`, `noPlace`, and `meal res%` together, not');
  lines.push('`resolved%` alone, which sat at 93% for the baseline and has little room to separate');
  lines.push('the arms. On a quality tie, prefer Sonnet 5 (no prompt re-tuning) and choose the');
  lines.push('effort rung on `sec/act` and `$/act`. Faster but worse loses: splitting the call is a');
  lines.push('~3x speed lever available to every arm, so speed is the cheap axis here.');
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
  const selected = args.includes('--arms')
    ? args[args.indexOf('--arms') + 1].split(',')
    : Object.keys(ARMS);

  const unknown = selected.filter((a) => !ARMS[a]);
  if (unknown.length) {
    console.error(`Unknown arm(s): ${unknown.join(', ')}. Available: ${Object.keys(ARMS).join(', ')}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const cassetteSize = installBraveCassette();

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
