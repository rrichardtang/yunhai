const test = require('node:test');
const assert = require('node:assert/strict');
const { planCity, SYSTEM_PROMPT, SYSTEM_PROMPT_GPT } = require('./claude');
const { formatProfileForEnrichment, sliderRating } = require('./services/profilePrompt');

const PROFILE = {
  answers: {
    pace: 3,
    museumPerson: 2,
    foodTravel: 5,
    livePerformances: 2,
    outdoorNature: 4,
    nightlifeBars: 3,
    dietaryRestrictions: 'no pork, severe shellfish allergy',
    mobilityConsiderations: 'no stairs'
  }
};

test('the profile block carries the numeric rating, not just a word', () => {
  const block = formatProfileForEnrichment(PROFILE);
  // "Slightly interested" alone read as "include a few"; the numeral is what the
  // GPT prompt's 1-2 / 3 / 4-5 thresholds key on.
  assert.match(block, /Museum person: 2\/5/);
  assert.match(block, /Travels for food: 5\/5/);
  assert.match(block, /Live performances: 2\/5/);
  assert.match(block, /Outdoor \/ nature activities: 4\/5/);
  assert.match(block, /Trip pace: 3\/5/);
});

test('constraints the meal planner has to honour survive into the block', () => {
  const block = formatProfileForEnrichment(PROFILE);
  assert.match(block, /severe shellfish allergy/);
  assert.match(block, /no stairs/);
});

test('an unanswered question is omitted, not reported as a neutral 3', () => {
  // planCity defaults unanswered shopping to 1 and plans none, so a block
  // claiming "Shopping: 3/5" would contradict the instructions in the same prompt.
  for (const empty of [{}, { answers: {} }, { answers: null }]) {
    const block = formatProfileForEnrichment(empty);
    assert.doesNotMatch(block, /Museum person/);
    assert.doesNotMatch(block, /Shopping while traveling/);
    assert.match(block, /Trip pace: 3\/5/, 'pace always renders — the planner always uses it');
  }
  const partial = formatProfileForEnrichment({ answers: { foodTravel: 5 } });
  assert.match(partial, /Travels for food: 5\/5/);
  assert.doesNotMatch(partial, /Museum person/);
});

test('sliderRating clamps to the 1-5 the labels assume', () => {
  assert.equal(sliderRating(undefined), 3);
  assert.equal(sliderRating(9), 5);
  assert.equal(sliderRating(0), 3);
  assert.equal(sliderRating(1), 1);
});

test('the GPT prompt turns the ratings into thresholds instead of a judgement call', () => {
  // The Claude-tuned prompt asks the model to guess when a prestige pick "would
  // feel flat"; GPT-5.6 answered by quoting the sentence and keeping the museums.
  assert.match(SYSTEM_PROMPT, /likely to feel flat/);
  assert.match(SYSTEM_PROMPT_GPT, /1-2 — actively avoid/);
  assert.match(SYSTEM_PROMPT_GPT, /At most ONE such activity for the entire city/);
  assert.match(SYSTEM_PROMPT_GPT, /reputation is NOT a reason/);
});

test('the restaurant research block does not re-open the meals escape hatch', async () => {
  // The same contradiction lived twice: SYSTEM_PROMPT line 38 and the user
  // prompt's restaurant block. Closing only the first took GPT-5.6 from 0 meals
  // to 6 against a target of 2/day — the user prompt was still saying "omit".
  const { prompt } = await capture(PROFILE, { systemPrompt: SYSTEM_PROMPT_GPT });
  assert.doesNotMatch(prompt, /omit that restaurant/);
  assert.doesNotMatch(prompt, /if hours aren't listed/);
});

test('the GPT prompt closes the escape hatch that produced zero meals', () => {
  // SYSTEM_PROMPT holds both "meals are MANDATORY" and "omit the restaurant if
  // hours are missing". GPT-5.6 obeyed the second one, in both cities.
  assert.match(SYSTEM_PROMPT, /OMIT the restaurant from your output rather than guessing/);
  assert.doesNotMatch(SYSTEM_PROMPT_GPT, /OMIT the restaurant/);
  assert.match(SYSTEM_PROMPT_GPT, /set opening_hours to null and STILL INCLUDE IT/);
  assert.match(SYSTEM_PROMPT_GPT, /never a reason to drop a meal/);
});

test('the GPT prompt states a null rate for insider_tips instead of permitting one', () => {
  // Permission alone bought zero nulls in 70 activities and ~17% platitudes.
  assert.match(SYSTEM_PROMPT_GPT, /Expect to return null for roughly a third/);
  assert.match(SYSTEM_PROMPT_GPT, /Crowd timing IS the platitude/);
  assert.match(SYSTEM_PROMPT_GPT, /A null is a correct answer/);
});

test('the GPT prompt names the padding shapes both models actually produced', () => {
  for (const pattern of [
    /return fewer and stop/,
    /Logistics as activities/,
    /Splitting one destination/,
    /Re-using a venue/,
    /whose own pitfall argues against doing it/,
    /day trip to a city that appears elsewhere/
  ]) {
    assert.match(SYSTEM_PROMPT_GPT, pattern);
  }
});

test('venue_name and suggested_time rules close the two grounding gaps', () => {
  // GPT left venue_name null on 41% of activities, including priced ones, which
  // dodges Places grounding entirely.
  assert.match(SYSTEM_PROMPT_GPT, /If it charges admission or has a scheduled start, it HAS a venue/);
  assert.match(SYSTEM_PROMPT_GPT, /must fall inside opening_hours/);
});

const CITY = {
  name: 'Lijiang, Yunnan, China',
  startDate: '2026-10-08',
  endDate: '2026-10-13',
  leaveTime: '18:00',
  accommodation: { address: '' }
};

// Captures what planCity actually sends, rather than what we believe it sends.
async function capture(profile, options = {}) {
  const seen = [];
  const generate = async ({ system, prompt }) => {
    seen.push({ system, prompt });
    return { text: '[]', stop_reason: 'end_turn', inputTokens: 0, outputTokens: 0 };
  };
  generate.modelId = 'test';
  await planCity(CITY, profile, 'plan-prompt-test', [], null, null, 1, 1, 0, [], null, { generate, ...options });
  return seen[0];
}

test('every profile answer reaches the model, not just pace', async () => {
  // The regression this guards: planCity read pace/shoppingPerson/shoppingInterests
  // and dropped the rest on the floor, so SYSTEM_PROMPT's "filter through what
  // they actually enjoy" was addressed to a model that had never been told.
  const { prompt } = await capture(PROFILE);
  assert.match(prompt, /Museum person: 2\/5/);
  assert.match(prompt, /Travels for food: 5\/5/);
  assert.match(prompt, /Live performances: 2\/5/);
  assert.match(prompt, /Outdoor \/ nature activities: 4\/5/);
  assert.match(prompt, /Nightlife and bars: 3\/5/);
  assert.match(prompt, /severe shellfish allergy/);
  assert.match(prompt, /no stairs/);
});

test('the profile is framed as a filter and still names the pace', async () => {
  const { prompt } = await capture(PROFILE);
  assert.match(prompt, /TRAVELER PROFILE — filter every candidate through this/);
  assert.match(prompt, /Trip pace: 3\/5/);
  assert.ok(prompt.indexOf('TRAVELER PROFILE') < prompt.indexOf('ACTIVITY COUNT'));
});

test('planCity uses SYSTEM_PROMPT unless an override is passed', async () => {
  const plain = await capture(PROFILE);
  assert.equal(plain.system, SYSTEM_PROMPT);
  const swapped = await capture(PROFILE, { systemPrompt: SYSTEM_PROMPT_GPT });
  assert.equal(swapped.system, SYSTEM_PROMPT_GPT);
  // The user message is the same either way — the arm moves one variable.
  assert.equal(swapped.prompt, plain.prompt);
});

test('both prompts still demand a bare JSON array', () => {
  for (const prompt of [SYSTEM_PROMPT, SYSTEM_PROMPT_GPT]) {
    assert.match(prompt, /Return ONLY the JSON array/);
    assert.match(prompt, /tour \/ meal \/ sports \/ museum \/ landmark \/ neighborhood \/ shopping/);
    assert.match(prompt, /must-order dishes/);
  }
});
