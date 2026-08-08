const test = require('node:test');
const assert = require('node:assert/strict');
const { planCity, normalizeActivity, SYSTEM_PROMPT, SYSTEM_PROMPT_GPT, SYSTEM_PROMPT_GPT_LEAN } = require('./claude');
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

test('no prompt asks for a field the pipeline decides itself', async () => {
  // The governing rule: if deterministic logic covers it, it is not in the prompt.
  // Asking and then overwriting wastes output tokens and lets prompt and code
  // disagree silently — which is how applyMealPoolCap deleted a full meal list.
  const deterministic = [
    [/opening_hours/, 'placesEnrich overwrites it from Google'],
    [/cost_type/, 'normalizeActivity always writes per_person'],
    [/booking_type/, 'normalizeActivity derives it from type and cost'],
    [/Lunch at/, 'stripMealPrefix removes the prefix'],
    [/appears at most once/, 'dedupeActivities collapses a repeated venue']
  ];
  const prompts = { SYSTEM_PROMPT, SYSTEM_PROMPT_GPT, SYSTEM_PROMPT_GPT_LEAN };
  for (const [label, prompt] of Object.entries(prompts)) {
    for (const [pattern, why] of deterministic) {
      assert.doesNotMatch(prompt, pattern, `${label} still asks for ${pattern} — ${why}`);
    }
  }
  const { prompt } = await capture(PROFILE);
  for (const [pattern, why] of deterministic) {
    assert.doesNotMatch(prompt, pattern, `user prompt still asks for ${pattern} — ${why}`);
  }
});

test('code supplies what the prompt stopped asking for', async () => {
  const seen = [];
  const generate = async ({ prompt }) => {
    seen.push(prompt);
    return {
      text: JSON.stringify([
        { name: 'Dinner at Heshu Restaurant', type: 'meal', venue_name: 'Heshu, Lijiang', why_it_fits: 'Order the stone pot fish.', duration_hours: 1.5, estimated_cost_usd: 25 },
        { name: 'Visit Mu Family Mansion', type: 'landmark', venue_name: 'Mu Family Mansion, Lijiang', duration_hours: 1.5, estimated_cost_usd: 8 },
        { name: 'Black Dragon Pool Dawn', type: 'neighborhood', duration_hours: 1, estimated_cost_usd: 0 }
      ]),
      stop_reason: 'end_turn'
    };
  };
  generate.modelId = 'test';
  const out = await planCity(CITY, PROFILE, 'strip-test', [], null, null, 1, 1, 0, [], null, { generate });
  const byName = Object.fromEntries(out.map((a) => [a.name, a]));

  assert.ok(byName['Heshu Restaurant'], 'meal-slot prefix stripped from the name');
  assert.ok(byName['Mu Family Mansion'], '"Visit " stripped too');
  assert.equal(byName['Heshu Restaurant'].booking.type, 'restaurant', 'a meal is always bookable');
  assert.equal(byName['Mu Family Mansion'].booking.type, 'attraction', '$8 admission is something to buy');
  assert.equal(byName['Black Dragon Pool Dawn'].booking.type, 'none', 'a free walk has nothing to book');
  assert.equal(byName['Heshu Restaurant'].cost.type, 'per_person');
  // The qualified name is what broke every image query, so the fallback shortens it.
  assert.equal(byName['Heshu Restaurant'].city, 'Lijiang');
});

test('booking type follows cost, not category', () => {
  // A type-only mapping disagreed with the model on 36 of 135 saved activities:
  // it put an affiliate link on free hikes and viewpoints, and stripped it from
  // ticketed parks the model had typed `neighborhood`.
  const bt = (type, cost) => normalizeActivity(
    { name: 'x', type, duration_hours: 1, estimated_cost_usd: cost }, 'Lijiang'
  ).booking.type;

  assert.equal(bt('sports', 0), 'none', 'a free hike is not an attraction');
  assert.equal(bt('landmark', 0), 'none', 'a free viewpoint is not an attraction');
  assert.equal(bt('neighborhood', 8), 'attraction', 'a ticketed park is');
  assert.equal(bt('museum', 6), 'attraction');
  assert.equal(bt('tour', 0), 'tour', 'an operator-led experience is bookable regardless');
  assert.equal(bt('meal', 0), 'restaurant');
  // Shopping cost is estimated spend, not admission.
  assert.equal(bt('shopping', 30), 'none');
  assert.equal(bt('landmark', null), 'none', 'unknown cost must not invent a booking link');
});

test('a venue sold twice under two names collapses', async () => {
  // Sonnet sold Compass three times in one Shangri-La list. The prompt rule that
  // forbade it is gone, so this has to hold in code.
  const generate = async () => ({
    text: JSON.stringify([
      { name: 'Compass Yak Burger', type: 'meal', venue_name: 'Compass, Shangri-La', why_it_fits: 'Order the yak burger.', duration_hours: 1.5 },
      { name: 'Compass Goat Hot Pot', type: 'meal', venue_name: 'Compass, Shangri-La', why_it_fits: 'Order the goat hot pot.', duration_hours: 1.5 },
      { name: 'Dukezong Evening Wander', type: 'neighborhood', duration_hours: 2 },
      { name: 'Dukezong Dawn Walk', type: 'neighborhood', duration_hours: 1 }
    ]),
    stop_reason: 'end_turn'
  });
  generate.modelId = 'test';
  const out = await planCity(CITY, PROFILE, 'dedupe-test', [], null, null, 1, 1, 0, [], null, { generate });

  assert.equal(out.filter((a) => a.venue_name === 'Compass, Shangri-La').length, 1, 'repeated venue collapsed');
  // Two unstructured walks in one district are genuinely distinct — venue_name is
  // null by design there, so they must survive.
  assert.equal(out.filter((a) => a.type === 'neighborhood').length, 2);
});

test('the meals rule survives without the hours it used to hang on', () => {
  for (const prompt of [SYSTEM_PROMPT, SYSTEM_PROMPT_GPT, SYSTEM_PROMPT_GPT_LEAN]) {
    assert.match(prompt, /must-order dishes/);
    assert.doesNotMatch(prompt, /OMIT the restaurant/);
  }
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
    /whose own pitfall argues against doing it/,
    /day trip to a city that appears elsewhere/
  ]) {
    assert.match(SYSTEM_PROMPT_GPT, pattern);
  }
});

test('the venue_name rule still closes the grounding gap', () => {
  // GPT left venue_name null on 41% of activities, including priced ones, which
  // dodges Places grounding entirely. This is a correctness rule, not a
  // deterministic one — no code can tell whether a place has a gate.
  assert.match(SYSTEM_PROMPT_GPT, /If it charges admission or has a scheduled start, it HAS a venue/);
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

test('the lean prompt drops the coaching the verbose one added', () => {
  for (const coaching of [
    /roughly a third/,                    // a null rate invites nulling good tips to hit it
    /mornings are quieter/,               // five paraphrases of "crowd timing is not a tip"
    /departure buffers/,                  // enumerated padding shapes teach the test
    /national park with four viewpoints/, // worked example of a rule stated beside it
    /If you catch yourself writing/       // meta-instruction about its own reasoning
  ]) {
    assert.match(SYSTEM_PROMPT_GPT, coaching, 'verbose prompt should still carry it');
    assert.doesNotMatch(SYSTEM_PROMPT_GPT_LEAN, coaching);
  }
  assert.ok(SYSTEM_PROMPT_GPT_LEAN.length < SYSTEM_PROMPT_GPT.length);
});

test('the lean prompt keeps what is load-bearing or untested', () => {
  // Schema is unguessable, the meals rule fixed a contradiction, and the rating
  // thresholds are the still-unmeasured fix for museums holding at 4 against 2/5.
  for (const kept of [
    /1-2 — actively avoid/,
    /At most ONE such activity for the entire city/,
    /target, not a quota/,
    /One destination is one activity/,
    /tour \/ meal \/ sports \/ museum \/ landmark \/ neighborhood \/ shopping/,
    /must-order dishes/
  ]) {
    assert.match(SYSTEM_PROMPT_GPT_LEAN, kept);
  }
  assert.doesNotMatch(SYSTEM_PROMPT_GPT_LEAN, /OMIT the restaurant/);
});

test('all three prompts still demand a bare JSON array', () => {
  for (const prompt of [SYSTEM_PROMPT, SYSTEM_PROMPT_GPT, SYSTEM_PROMPT_GPT_LEAN]) {
    assert.match(prompt, /Return ONLY the JSON array/);
    assert.match(prompt, /tour \/ meal \/ sports \/ museum \/ landmark \/ neighborhood \/ shopping/);
    assert.match(prompt, /must-order dishes/);
  }
});
