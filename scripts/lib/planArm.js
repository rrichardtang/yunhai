// Arms, instrumentation and metrics shared by scripts/planCityBakeoff.js (model
// vs model) and scripts/evalPlan.js (prompt vs prompt). Both must price and
// count the same way or their numbers cannot be read side by side.
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

const { ALL_DAY } = require('../../src/services/placesEnrich');
const { extractText, tryParseJsonArray } = require('../../src/services/llmJson');

const MAX_OUTPUT_TOKENS = 64000;

// Per million tokens. Sonnet 5 is on introductory pricing through 2026-08-31.
// GPT-5.6 bills per tier and the tier decides the whole cost argument — Sol is
// twice Sonnet 4.6's output price, Luna is 40% of it. The bare 'gpt-5.6' key
// stays null so an unidentified tier prints an em dash instead of a wrong
// number; rows are priced on the model the provider says it served, so a run
// reveals the real tier IDs if these slugs are wrong.
const PRICING = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-opus-5': { in: 15, out: 75 },
  'gpt-5.6': null,
  'gpt-5.6-sol': { in: 5, out: 30 },
  'gpt-5.6-terra': { in: 2.5, out: 15 },
  'gpt-5.6-luna': { in: 1, out: 6 },
  'gpt-5.4-mini': { in: 0.25, out: 2 }
};

function costUsd(modelId, inputTokens, outputTokens) {
  const price = PRICING[modelId];
  if (!price) return null;
  return (inputTokens / 1e6) * price.in + (outputTokens / 1e6) * price.out;
}

function anthropicArm(model, effort) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const generate = async ({ system, prompt }) => {
    const params = { model, max_tokens: MAX_OUTPUT_TOKENS, system, messages: [{ role: 'user', content: prompt }] };
    if (effort) params.output_config = { effort };
    const final = await client.messages.stream(params).finalMessage();
    return {
      text: extractText(final.content),
      servedModel: final.model,
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
      // Without an explicit cap, a truncated array can't be told apart from the
      // model's real output ceiling — and the ceiling is the fact that decides
      // whether this arm is viable at all.
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }]
    });
    const choice = res.choices?.[0];
    return {
      text: choice?.message?.content || '',
      // The requested string can route to any tier, and the tiers differ 5x on
      // output price — bill on what the provider says it actually served.
      servedModel: res.model,
      stop_reason: choice?.finish_reason,
      inputTokens: res.usage?.prompt_tokens || 0,
      outputTokens: res.usage?.completion_tokens || 0
    };
  };
  generate.modelId = model;
  return generate;
}

// Wraps an arm so the harness can see what planCity does not return: how many
// generations it took (a second one means the JSON failed to parse), how many
// activities the model actually emitted before filtering, and token spend.
const RETRY_MARKER = 'IMPORTANT: Return ONLY a valid JSON array';

function instrument(generate) {
  const stats = { calls: [], rawActivities: 0, inputTokens: 0, outputTokens: 0, truncated: false, retried: false, servedModel: null };
  const wrapped = async (args) => {
    const result = await generate(args);
    if (result.servedModel) stats.servedModel = result.servedModel;
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

// What the prompt asks each city for, so a model that quietly under-delivers is
// visible rather than just looking fast.
function targetActivityCount(city, profile) {
  const nonMealPerDay = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }[
    Math.max(1, Math.min(5, Math.round(Number(profile?.answers?.pace) || 3)))
  ];
  const days = Math.round((new Date(city.endDate) - new Date(city.startDate)) / 86400000) + 1;
  return (nonMealPerDay + 2) * days;
}

// Rounded to ~11m. Places collapses distinct venues onto one point often enough
// that this is not an absolute quality number — three separate Lijiang Old Town
// restaurants came back on the same coordinate at the same price tier. Every arm
// plans the same cities through the same Places, so the collapse rate is a shared
// constant and the metric still ranks arms against each other.
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
  // A 24/7 result is Places saying it has no hours for this place, so scoring the
  // model against it counts a correct window as a miss.
  const comparable = outcomes.filter((o) => o.llmHours && o.placesHours && o.placesHours !== ALL_DAY);
  return {
    // Only counts activities where the model committed to a venue name. An
    // unstructured activity carries venue_name null by design, so its label
    // failing to geocode says nothing about the model.
    ghost: outcomes.filter((o) => o.status === 'no_place' && o.venueName).length,
    tooFar: outcomes.filter((o) => o.status === 'too_far').length,
    mealTotal: outcomes.filter(isMeal).length,
    mealResolved: outcomes.filter((o) => isMeal(o) && o.status === 'resolved').length,
    hoursComparable: comparable.length,
    hoursMatched: comparable.filter((o) => o.llmHours === o.placesHours).length
  };
}

module.exports = {
  MAX_OUTPUT_TOKENS,
  PRICING,
  costUsd,
  anthropicArm,
  openaiArm,
  instrument,
  targetActivityCount,
  distinctVenues,
  summariseOutcomes
};
