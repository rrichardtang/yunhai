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

// Wraps an arm so the harness can see what planCity does not return: how many
// generations it took (a second one means the JSON failed to parse), how many
// activities the model actually emitted before filtering, and token spend.
function instrument(generate) {
  const stats = { calls: 0, rawActivities: 0, inputTokens: 0, outputTokens: 0, truncated: false };
  const wrapped = async (args) => {
    stats.calls += 1;
    const result = await generate(args);
    stats.inputTokens += result.inputTokens;
    stats.outputTokens += result.outputTokens;
    if (['max_tokens', 'length'].includes(result.stop_reason)) stats.truncated = true;
    const parsed = tryParseJsonArray(result.text);
    if (parsed) stats.rawActivities = parsed.length;
    return result;
  };
  wrapped.modelId = generate.modelId;
  return { wrapped, stats };
}

function costUsd(modelId, stats) {
  const price = PRICING[modelId];
  if (!price) return null;
  return (stats.inputTokens / 1e6) * price.in + (stats.outputTokens / 1e6) * price.out;
}

async function runArm(armName, runIndex) {
  const generate = ARMS[armName]();
  const rows = [];

  for (const city of TRIP.cities) {
    const { wrapped, stats } = instrument(generate);
    const started = Date.now();
    let activities = [];
    let error = null;

    try {
      activities = await planCity(
        city, TRIP.profile, 'bakeoff', [], null, null,
        TRIP.cities.length, 1, 0, [], null,
        { generate: wrapped }
      );
    } catch (err) {
      error = err.message;
    }

    const resolved = activities.filter((a) => Number.isFinite(a?.location?.lat) && a.location.lat !== 0).length;
    const withPhoto = activities.filter((a) => a?.imageUrl).length;

    rows.push({
      arm: armName,
      run: runIndex,
      city: city.name.split(',')[0],
      seconds: (Date.now() - started) / 1000,
      retried: stats.calls > 1,
      truncated: stats.truncated,
      raw: stats.rawActivities,
      kept: activities.length,
      resolved,
      withPhoto,
      cost: costUsd(generate.modelId, stats),
      error
    });

    const slug = `${armName}-run${runIndex}-${city.name.split(',')[0].replace(/\s+/g, '_')}`;
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(activities, null, 2));
  }

  return rows;
}

function mean(values) {
  const usable = values.filter((v) => v != null);
  return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null;
}

function report(rows) {
  const arms = [...new Set(rows.map((r) => r.arm))];
  const fmt = (v, digits = 1) => (v == null ? '—' : v.toFixed(digits));

  console.log('\n' + '='.repeat(94));
  console.log('arm               runs  sec/city  retry%  trunc%   raw   kept  resolved%  photo%   $/city');
  console.log('-'.repeat(94));

  for (const arm of arms) {
    const armRows = rows.filter((r) => r.arm === arm && !r.error);
    if (!armRows.length) {
      console.log(`${arm.padEnd(17)} all runs failed: ${rows.find((r) => r.arm === arm)?.error}`);
      continue;
    }
    const pct = (predicate) => (armRows.filter(predicate).length / armRows.length) * 100;
    const resolvedPct = mean(armRows.map((r) => (r.kept ? (r.resolved / r.kept) * 100 : null)));
    const photoPct = mean(armRows.map((r) => (r.kept ? (r.withPhoto / r.kept) * 100 : null)));
    const cost = mean(armRows.map((r) => r.cost));

    console.log(
      arm.padEnd(17) +
      String(armRows.length).padStart(4) +
      fmt(mean(armRows.map((r) => r.seconds))).padStart(10) +
      fmt(pct((r) => r.retried), 0).padStart(8) +
      fmt(pct((r) => r.truncated), 0).padStart(8) +
      fmt(mean(armRows.map((r) => r.raw)), 0).padStart(6) +
      fmt(mean(armRows.map((r) => r.kept)), 0).padStart(7) +
      fmt(resolvedPct, 0).padStart(11) +
      fmt(photoPct, 0).padStart(8) +
      (cost == null ? '—' : `$${cost.toFixed(3)}`).padStart(9)
    );
  }

  console.log('='.repeat(94));
  console.log('sec/city and resolved% are the deciding columns: they are speed and quality.');
  console.log('resolved% = share of activities whose venue name matched a real Google Place.');
  console.log(`Activity lists written to ${OUT_DIR} — read them blind before trusting the numbers.`);
  if (rows.some((r) => r.cost == null)) console.log('Missing $/city means no confirmed price for that model.');
  if (rows.some((r) => r.truncated)) console.log('WARNING: an arm hit its output cap; raise MAX_OUTPUT_TOKENS before believing its yield.');
}

async function main() {
  const args = process.argv.slice(2);
  const runs = Number(args[args.indexOf('--runs') + 1]) || 3;
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
