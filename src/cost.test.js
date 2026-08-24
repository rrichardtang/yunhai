const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PER_GROUP,
  ESTIMATED,
  STATED,
  ENTERED,
  makeCost,
  readBasis,
  statedCost,
  estimatedCost,
  enteredCost,
  resolveCost,
  withoutModelBasis,
  partyWeight,
  partyTotalUsd,
  perUnitUsd,
  compareCost
} = require('../shared/cost');

const solo = { adults: 1, children: 0 };
const family = { adults: 2, children: 2 };

test('a cost carries its own basis, so a group price is never multiplied by the party', () => {
  // The 320-vs-200 bug: a $200 per_group tour was stamped per_person on the way
  // back from the model, then scaled by party size and judged more expensive
  // than the $200 it replaced.
  const groupTour = makeCost(200, PER_GROUP, STATED);
  assert.equal(partyTotalUsd(groupTour, family), 200);
  assert.equal(partyTotalUsd(groupTour, solo), 200);

  const perHead = makeCost(50, 'per_person', STATED);
  assert.equal(partyTotalUsd(perHead, solo), 50);
  assert.equal(partyTotalUsd(perHead, family), 50 * partyWeight(family));
});

test('a party total cannot be turned into a party total again', () => {
  // The structural guard. Every factor-of-N bug in this area was a value that
  // had already been converted going through the conversion a second time, so
  // the output type deliberately differs from the input type.
  const total = partyTotalUsd(makeCost(50, 'per_person', STATED), family);
  assert.equal(typeof total, 'number');
  assert.throws(() => partyTotalUsd(total, family), TypeError);
  assert.throws(() => partyTotalUsd(200, solo), TypeError);
});

test('party weight has one definition', () => {
  assert.equal(partyWeight(solo), 1);
  assert.equal(partyWeight(family), 2 + 1.2);
  assert.equal(partyWeight({}), 1);
  assert.equal(partyWeight({ adults: 0, children: 0 }), 1);
  assert.equal(partyWeight({ adults: 3, children: -2 }), 3);
});

test('two table guesses that agree are not a verdict', () => {
  // The tie that emptied a whole batch: both the original and its replacement
  // were landmarks with no real price, so both fell back to the same $25 table
  // entry, and "not cheaper than" discarded every suggestion.
  const original = estimatedCost({ type: 'landmark' });
  const replacement = estimatedCost({ type: 'landmark' });
  assert.equal(original.source, ESTIMATED);
  assert.equal(compareCost(replacement, original, solo), null);

  const realPrice = makeCost(25, 'per_person', STATED);
  assert.equal(compareCost(realPrice, makeCost(25, 'per_person', STATED), solo), 0);
});

test('comparison converts both sides, so a unit price never meets a party total', () => {
  // The $160-ceiling-against-a-"$50"-price bug, stated as an invariant: a
  // per-person cost and a group cost are only ever compared after conversion.
  const perHead = makeCost(50, 'per_person', STATED);
  const group = makeCost(150, PER_GROUP, STATED);
  assert.equal(compareCost(group, perHead, solo), 1);
  assert.equal(compareCost(group, perHead, family), -1);
});

test('an explicit basis is honored rather than defaulted', () => {
  // normalizeActivity hardcoded per_person and ignored the cost_type it was
  // handed, so each caller had to repair it afterwards and one did not.
  assert.equal(readBasis({ cost: { estimated_usd: 10, type: PER_GROUP } }), PER_GROUP);
  assert.equal(readBasis({ estimated_cost_usd: 10, cost_type: PER_GROUP }), PER_GROUP);
  assert.equal(statedCost({ cost: { estimated_usd: 80, type: PER_GROUP } }).basis, PER_GROUP);
  assert.equal(statedCost({ estimated_cost_usd: 80, cost_type: PER_GROUP }).basis, PER_GROUP);
});

test('an unset basis is per_person, and that is a decision not an accident', () => {
  assert.equal(readBasis({}), 'per_person');
  assert.equal(readBasis({ cost: {} }), 'per_person');
  assert.equal(readBasis({ cost_type: 'nonsense' }), 'per_person');
});

test('both stored activity shapes read the same', () => {
  const nested = { cost: { estimated_usd: 40, type: 'per_person' }, type: 'meal' };
  const flat = { estimated_cost_usd: 40, cost_type: 'per_person', type: 'meal' };
  // Asserted on the values too: deepEqual alone passes if reading both shapes
  // broke and each returned null.
  assert.equal(statedCost(nested).usd, 40);
  assert.equal(statedCost(nested).basis, 'per_person');
  assert.deepEqual(statedCost(nested), statedCost(flat));
});

test('a model cannot declare the basis, because nothing asked it to', () => {
  // No prompt requests cost_type, so a volunteered one was validated by nothing.
  // A nested cost is worse: readBasis would take the basis from it while the
  // normalizer reads the price from the flat field.
  const volunteered = { type: 'tour', estimated_cost_usd: 300, cost_type: PER_GROUP };
  assert.equal(readBasis(volunteered), PER_GROUP);
  assert.equal(readBasis(withoutModelBasis(volunteered)), 'per_person');
  assert.equal(statedCost(withoutModelBasis(volunteered)).usd, 300);
  assert.equal(withoutModelBasis({ cost: { type: PER_GROUP } }).cost, undefined);
});

test('a non-credible price is not a price', () => {
  // A model told to come in at or below $0 answers $0, which is not an estimate.
  assert.equal(statedCost({ estimated_cost_usd: 0 }), null);
  assert.equal(statedCost({ estimated_cost_usd: -5 }), null);
  assert.equal(statedCost({}), null);
  assert.equal(makeCost(Number.NaN, 'per_person', STATED), null);
  assert.equal(makeCost(Infinity, 'per_person', STATED), null);
});

test('an empty form field is not a free activity', () => {
  // Number('') is 0, exactly like Number(null): a blank cost input would mint a
  // $0 entered cost that outranks the real price behind it.
  assert.equal(makeCost('', 'per_person', ENTERED), null);
  assert.equal(makeCost('   ', 'per_person', ENTERED), null);
  assert.equal(makeCost(null, 'per_person', ENTERED), null);
  assert.equal(makeCost(undefined, 'per_person', ENTERED), null);
  assert.equal(makeCost(true, 'per_person', ENTERED), null);
  assert.equal(makeCost('40', 'per_person', ENTERED).usd, 40);
});

test('$0 means different things from a model and from a traveler', () => {
  // A model answering $0 to hit a budget target has told us nothing, so a stated
  // price of 0 is not a price. A traveler entering 0 is saying it is free, which
  // is a real statement — and it is what makes such an activity ineligible for
  // budget optimization rather than giving it a $0 target to shop against.
  assert.equal(statedCost({ estimated_cost_usd: 0 }), null);
  assert.equal(makeCost(0, PER_GROUP, ENTERED).usd, 0);
  assert.equal(partyTotalUsd(enteredCost(0, PER_GROUP), family), 0);
});

test('resolve prefers a real price over a guess and never invents one', () => {
  const landmark = { type: 'landmark', estimated_cost_usd: 60 };
  assert.equal(resolveCost(landmark).usd, 60);
  assert.equal(resolveCost(landmark).source, STATED);
  assert.equal(resolveCost({ type: 'landmark' }).source, ESTIMATED);
  assert.equal(resolveCost({ type: 'shopping' }), null);
});

test('an entered cost states its own basis, because only its producer knows it', () => {
  // A checklist budget is one figure for the whole party — per_group — no matter
  // what the activity is priced in. Taking the basis from the activity would
  // scale a party total by the party a second time.
  const checklistBudget = enteredCost(300, PER_GROUP);
  assert.equal(partyTotalUsd(checklistBudget, family), 300);

  const perHeadEntry = enteredCost(300, 'per_person');
  assert.equal(partyTotalUsd(perHeadEntry, family), 300 * partyWeight(family));
});

test('a party total converts back to the unit the prompts speak', () => {
  // The inverse of partyTotalUsd, and the reason it lives in the module: the
  // route prints and reads a per-unit price, while every figure the client holds
  // is a party total. Spelling the division at each call site is what let a
  // per_group activity be divided by the party it was never multiplied by.
  assert.equal(perUnitUsd(320, 'per_person', family), 100);
  assert.equal(perUnitUsd(320, PER_GROUP, family), 320);
  assert.equal(perUnitUsd(null, 'per_person', family), null);

  // Round-trips for both bases.
  for (const basis of ['per_person', PER_GROUP]) {
    const cost = makeCost(120, basis, STATED);
    assert.equal(perUnitUsd(partyTotalUsd(cost, family), basis, family), 120);
  }
});

test('a guess for a group-priced activity is still a per-head guess', () => {
  // The table holds what one traveler pays. Scaling it by the party is correct
  // for an activity with no real price, whatever basis it was declared in.
  const guess = resolveCost({ type: 'tour', cost_type: PER_GROUP });
  assert.equal(guess.source, ESTIMATED);
  assert.equal(guess.basis, 'per_person');
  assert.equal(partyTotalUsd(guess, family), 75 * partyWeight(family));
});

test('meal guesses follow price level, and absent one there is no guess', () => {
  assert.equal(estimatedCost({ type: 'meal', price_level: 2 }).usd, 40);
  assert.equal(estimatedCost({ type: 'meal', price_level: 0 }).usd, 0);
  assert.equal(estimatedCost({ type: 'meal' }), null);
  assert.equal(estimatedCost({ type: 'meal', price_level: null }), null);
});

test('a missing cost compares as unknown rather than free', () => {
  assert.equal(compareCost(null, makeCost(10, 'per_person', STATED), solo), null);
  assert.equal(compareCost(makeCost(10, 'per_person', STATED), null, solo), null);
});
