// Blind pairwise judging with position swap.
//
// Absolute 1-5 scoring is not usable for regression detection: scores cluster at
// 4, the scale is re-invented on every call, and it silently re-scales when the
// judge model updates — which breaks exactly the across-time comparison this
// harness exists to make. Pairwise asks the question we actually have ("is the
// candidate worse?") and needs no calibration between runs.
//
// Judges also favour whichever list they see first, so every pair is judged
// twice with the slots flipped. A criterion only scores a win when the same
// *content* wins from both slots; if the same *slot* wins twice, that is
// position bias and it is recorded as a tie.
const Anthropic = require('@anthropic-ai/sdk');

const { tryParseJsonObject, extractText } = require('../../src/services/llmJson');
const { renderActivity } = require('../blindRead');

const JUDGE_MODELS = { sonnet: 'claude-sonnet-5', opus: 'claude-opus-5' };
const MAX_TOKENS = 2000;

// Only what Layer 1 cannot count. Anything a `for` loop can decide belongs in
// src/evalChecks.js, where it is exact and free.
const PLAN_CRITERIA = [
  { id: 'profileFit', ask: 'Which list better suits THIS traveler, given their ratings and their own description?' },
  { id: 'specificity', ask: 'Which list names concrete, particular places and details rather than generic filler?' },
  { id: 'tipAuthenticity', ask: 'Which list\'s insider tips read as real local knowledge rather than platitudes?' },
  { id: 'internalCoherence', ask: 'In which list do why_it_fits, pitfall and smarter_alternative actually agree with the activity they describe?' }
];

function renderList(activities) {
  return activities.map(renderActivity).join('\n\n');
}

function buildJudgePrompt({ criteria, context, first, second }) {
  const criteriaBlock = criteria.map((c) => `- ${c.id}: ${c.ask}`).join('\n');
  return `You are comparing two candidate activity lists produced for the same traveler and the same city. Judge only the lists in front of you.

TRAVELER AND TRIP
${context}

CRITERIA
${criteriaBlock}

LIST A
${renderList(first)}

LIST B
${renderList(second)}

For each criterion, answer "A", "B", or "tie". Use "tie" honestly — if the two lists are equally good on a criterion, say tie rather than inventing a preference. Give one short sentence of reasoning naming something concrete from the lists.

Respond ONLY with valid JSON:
{${criteria.map((c) => `"${c.id}":{"winner":"A|B|tie","reason":"..."}`).join(',')}}`;
}

function anthropicJudge(model) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const call = async (prompt) => {
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }]
    });
    return {
      text: extractText(response.content),
      servedModel: response.model,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0
    };
  };
  call.modelId = model;
  return call;
}

// An unparseable response degrades to ties, which is safe for the verdict but
// makes a broken judge indistinguishable from an agreeable one — a run that
// returned all ties could mean either. `unparsed` is counted and reported so the
// two can be told apart.
async function askJudge({ call, criteria, context, first, second }) {
  const result = await call(buildJudgePrompt({ criteria, context, first, second }));
  const parsed = tryParseJsonObject(result.text);
  const verdicts = {};
  for (const criterion of criteria) {
    const raw = (parsed || {})[criterion.id] || {};
    const winner = ['A', 'B', 'tie'].includes(raw.winner) ? raw.winner : 'tie';
    verdicts[criterion.id] = { winner, reason: String(raw.reason || '').trim() };
  }
  const recognised = parsed && criteria.some((c) => ['A', 'B', 'tie'].includes((parsed[c.id] || {}).winner));
  return { verdicts, parsed: Boolean(recognised), head: result.text.slice(0, 200), usage: result };
}

// Round 1 puts the baseline in slot A, round 2 puts the candidate there. The
// same content winning both times is a real preference; the same slot winning
// both times is bias.
function resolveSwap(roundOne, roundTwo) {
  const contentOf = { one: { A: 'baseline', B: 'candidate' }, two: { A: 'candidate', B: 'baseline' } };
  const first = contentOf.one[roundOne.winner];
  const second = contentOf.two[roundTwo.winner];

  if (first && first === second) return { winner: first, reason: roundOne.reason, agreed: true };
  return {
    winner: 'tie',
    reason: roundOne.reason,
    agreed: false,
    positionBias: Boolean(first && second && first !== second)
  };
}

async function comparePair({ call, criteria = PLAN_CRITERIA, context, baseline, candidate }) {
  const [one, two] = await Promise.all([
    askJudge({ call, criteria, context, first: baseline, second: candidate }),
    askJudge({ call, criteria, context, first: candidate, second: baseline })
  ]);

  const outcome = {};
  for (const criterion of criteria) {
    outcome[criterion.id] = resolveSwap(one.verdicts[criterion.id], two.verdicts[criterion.id]);
  }
  const unparsed = [one, two].filter((round) => !round.parsed);
  return {
    outcome,
    unparsed: unparsed.length,
    unparsedHead: unparsed[0]?.head || null,
    usage: {
      inputTokens: one.usage.inputTokens + two.usage.inputTokens,
      outputTokens: one.usage.outputTokens + two.usage.outputTokens,
      servedModel: one.usage.servedModel
    }
  };
}

// Wins per criterion across scenarios, which is what the verdict rule reads.
function tallyOutcomes(perScenario) {
  const tally = {};
  for (const { outcome } of perScenario) {
    for (const [criterion, result] of Object.entries(outcome)) {
      if (!tally[criterion]) tally[criterion] = { baseline: 0, candidate: 0, tie: 0 };
      tally[criterion][result.winner] += 1;
    }
  }
  return tally;
}

module.exports = {
  JUDGE_MODELS,
  PLAN_CRITERIA,
  anthropicJudge,
  askJudge,
  comparePair,
  resolveSwap,
  tallyOutcomes,
  buildJudgePrompt
};
