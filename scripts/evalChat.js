#!/usr/bin/env node
// Prompt-vs-prompt regression check for the chat concierge.
//
//   node scripts/evalChat.js
//   node scripts/evalChat.js --candidate ./my-chat-prompt.txt --judge opus
//
// Drives runChatTurn directly rather than POSTing /api/chat/message. That is
// the seam the route already exposes, and going through it means the eval never
// calls processChatSignals — so signals come back as a return value to assert on
// and nothing writes to /data/memory.
//
// Search results are canned per scenario, so every arm answers the same
// evidence and an invented URL is unambiguous rather than a stale-index excuse.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const { runChatTurn } = require('../src/routes/chat');
const { buildChatSystemPrompt } = require('../src/services/chatPrompt');
const { runChatChecks } = require('../src/evalChatChecks');
const { costUsd } = require('./lib/planArm');
const { anthropicJudge, comparePair, tallyOutcomes, JUDGE_MODELS } = require('./lib/judge');
const { renderReport, CHAT_JUDGE_LOSS_MARGIN } = require('./lib/evalReport');

const OUT_DIR = path.join(__dirname, '..', 'data', 'bakeoff');
const SCENARIO_DIR = path.join(__dirname, '..', 'evals', 'scenarios', 'chat');

const CHAT_CRITERIA = [
  { id: 'correctness', ask: 'Which reply is factually right about this trip and this app, given the itinerary and the website guide the assistant was shown?' },
  { id: 'decisiveness', ask: 'Which reply commits to a concrete answer instead of hedging or listing options?' },
  { id: 'usefulness', ask: 'Which reply would actually help this traveler take their next step?' }
];

function loadScenarios(only) {
  return fs.readdirSync(SCENARIO_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(SCENARIO_DIR, f), 'utf8')))
    .filter((s) => !only?.length || only.includes(s.id));
}

// A chat reply is one object, but the judge compares lists. Rendering it as a
// single-item list lets both runners share comparePair unchanged.
const asJudgeItem = (scenario, reply) => [{
  name: scenario.message,
  type: 'chat reply',
  venue_name: null,
  timing: {},
  why_it_fits: reply
}];

async function runArm({ openai, scenario, systemPrompt }) {
  const searchResults = scenario.searchResults;
  const braveConfigured = searchResults !== null && searchResults !== undefined;
  const usage = { inputTokens: 0, outputTokens: 0, servedModel: null };

  // The SDK client is the seam runChatTurn already takes; wrapping it is how the
  // eval sees token spend without runChatTurn needing to report it.
  const metered = {
    chat: {
      completions: {
        create: async (req) => {
          const res = await openai.chat.completions.create(req);
          usage.inputTokens += res.usage?.prompt_tokens || 0;
          usage.outputTokens += res.usage?.completion_tokens || 0;
          usage.servedModel = res.model;
          return res;
        }
      }
    }
  };

  const started = Date.now();
  const { reply, signals } = await runChatTurn({
    openai: metered,
    braveConfigured,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: scenario.message }
    ],
    search: async () => searchResults || ''
  });

  return {
    reply,
    signals,
    seconds: (Date.now() - started) / 1000,
    servedModel: usage.servedModel,
    cost: costUsd(usage.servedModel, usage.inputTokens, usage.outputTokens)
  };
}

function argValue(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const candidateSpec = argValue(args, '--candidate');
  const skipJudge = args.includes('--no-judge');
  const judgeModel = JUDGE_MODELS[argValue(args, '--judge') || 'sonnet'] || JUDGE_MODELS.sonnet;
  const only = (argValue(args, '--scenarios') || '').split(',').filter(Boolean);

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required.');
    process.exit(1);
  }

  const scenarios = loadScenarios(only);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const candidateOverride = candidateSpec ? fs.readFileSync(candidateSpec, 'utf8') : null;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Candidate: ${candidateSpec ? path.basename(candidateSpec) : 'shipping prompt (null-change control)'}`);
  console.log(`Scenarios: ${scenarios.map((s) => s.id).join(', ')}\n`);

  const perScenario = [];
  // Unpriced must not render as free. costUsd returns null for a served model
  // missing from PRICING, and coercing that to 0 reported five scenarios of real
  // calls as $0.000. The served model is printed so the key can be added.
  let cost = 0;
  let unpricedModel = null;

  for (const scenario of scenarios) {
    const baselinePrompt = buildChatSystemPrompt(scenario.tripContext || {}, scenario.prefSummary || '');
    // A candidate file replaces the base instructions; the trip and guide blocks
    // are assembled the same way for both arms so only the instructions vary.
    const candidatePrompt = candidateOverride
      ? candidateOverride + baselinePrompt.slice(baselinePrompt.indexOf('\n\n## Traveler'))
      : baselinePrompt;

    process.stdout.write(`  ${scenario.id} ... `);
    const [baseline, candidate] = await Promise.all([
      runArm({ openai, scenario, systemPrompt: baselinePrompt }),
      runArm({ openai, scenario, systemPrompt: candidatePrompt })
    ]);
    for (const armRun of [baseline, candidate]) {
      if (armRun.cost == null) unpricedModel = unpricedModel || armRun.servedModel || 'unknown';
      else cost += armRun.cost;
    }

    const checkArgs = { expect: scenario.expect || {}, searchResults: scenario.searchResults };
    perScenario.push({
      scenario: scenario.id,
      definition: scenario,
      baseline,
      candidate,
      baselineChecks: runChatChecks({ ...checkArgs, reply: baseline.reply, signals: baseline.signals }),
      candidateChecks: runChatChecks({ ...checkArgs, reply: candidate.reply, signals: candidate.signals })
    });

    fs.writeFileSync(
      path.join(OUT_DIR, `eval-chat-${scenario.id}.json`),
      JSON.stringify({ scenario, baseline, candidate }, null, 2)
    );
    console.log(`${candidate.reply.slice(0, 60).replace(/\s+/g, ' ')}…`);
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
        criteria: CHAT_CRITERIA,
        context: `The traveler asked: "${row.definition.message}"\nSearch results the assistant was given: ${row.definition.searchResults || '(none)'}`,
        baseline: asJudgeItem(row.definition, row.baseline.reply),
        candidate: asJudgeItem(row.definition, row.candidate.reply)
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
    title: `Chat eval — ${candidateSpec ? path.basename(candidateSpec) : 'null-change control'}`,
    perScenario,
    tally,
    judgeNotes,
    outDir: OUT_DIR,
    artifactName: (id) => `eval-chat-${id}.json`,
    reportName: 'chat-judge-report.md',
    margin: CHAT_JUDGE_LOSS_MARGIN,
    run: {
      scenarios: scenarios.length,
      genCost: unpricedModel ? `— (no price for "${unpricedModel}"; add it to PRICING)` : `$${cost.toFixed(3)}`,
      judgeModel: skipJudge ? 'skipped' : judgeModel,
      judgeCost: skipJudge ? '—' : `$${judgeCost.toFixed(3)}`
    }
  });

  fs.writeFileSync(path.join(OUT_DIR, 'chat-judge-report.md'), `${text}\n`);
  console.log(`\n${text}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
