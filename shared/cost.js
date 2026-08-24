// A cost is never a bare number here.
//
// The bug this exists to make impossible: a number like 200 means nothing on its
// own. It is $200 for one traveler or $200 for the whole party depending on a
// field stored elsewhere, and it is either a real price or a guess from a lookup
// table depending on where it came from. Every boundary that lost track of one of
// those facts produced a silent factor-of-N error rather than a type error —
// a $200 group tour read as $400, a target of $160 shown against a "$50" price,
// two table guesses tying and reading as "not cheaper".
//
// So a cost travels as { usd, basis, source } and the party arithmetic lives in
// exactly one function. partyTotalUsd takes a cost object and returns a number,
// so its own output cannot be fed back into it — double-multiplication is a
// TypeError instead of a plausible-looking price.
(function (root) {
  const PER_PERSON = 'per_person';
  const PER_GROUP = 'per_group';

  // stated: a real price, from the model or the venue.
  // entered: the traveler typed it, so it outranks anything derived.
  // estimated: a table guess. Two of these being equal says nothing, which is
  // why compareCost refuses to call that a verdict.
  const STATED = 'stated';
  const ENTERED = 'entered';
  const ESTIMATED = 'estimated';

  function makeCost(usd, basis, source) {
    // Number(null) is 0, which is finite and non-negative — without this, an
    // absent price mints a free one and outranks the real price behind it.
    if (usd == null) return null;
    const amount = Number(usd);
    if (!Number.isFinite(amount) || amount < 0) return null;
    return Object.freeze({
      usd: amount,
      basis: basis === PER_GROUP ? PER_GROUP : PER_PERSON,
      source
    });
  }

  function isCost(value) {
    return Boolean(value) && typeof value === 'object' && typeof value.usd === 'number' && typeof value.basis === 'string';
  }

  // Activities exist in two stored shapes — normalized (nested `cost`) and legacy
  // (flat `estimated_cost_usd`). Both are on disk right now, so both are read
  // here rather than at each call site.
  function readBasis(activity) {
    const stored = activity?.cost?.type || activity?.cost_type;
    return stored === PER_GROUP ? PER_GROUP : PER_PERSON;
  }

  function statedCost(activity) {
    const nested = activity?.cost?.estimated_usd;
    const usd = nested != null ? nested : activity?.estimated_cost_usd;
    // A non-positive price is not a credible one for a priced venue — a model
    // that answers 0 to hit a budget target has told us nothing.
    const cost = makeCost(usd, readBasis(activity), STATED);
    return cost && cost.usd > 0 ? cost : null;
  }

  const PRICE_LEVEL_USD = { 0: 0, 1: 15, 2: 40, 3: 90, 4: 200 };

  // Always per_person: the table holds what one traveler typically pays. An
  // activity the traveler priced per group still gets a per-person guess when it
  // carries no real price, and partyTotalUsd scales it the same way as any other.
  function estimatedCost(activity) {
    const type = String(activity?.type || '').toLowerCase();
    if (type === 'meal') {
      const level = activity?.price_level;
      const usd = typeof level === 'number' ? PRICE_LEVEL_USD[level] : null;
      return usd == null ? null : makeCost(usd, PER_PERSON, ESTIMATED);
    }
    if (type === 'tour') return makeCost(75, PER_PERSON, ESTIMATED);
    if (type === 'museum' || type === 'landmark' || type === 'sports') return makeCost(25, PER_PERSON, ESTIMATED);
    return null;
  }

  function resolveCost(activity, { enteredUsd = null } = {}) {
    const entered = makeCost(enteredUsd, readBasis(activity), ENTERED);
    return entered || statedCost(activity) || estimatedCost(activity);
  }

  // One definition. Three different spellings of this arithmetic were live at
  // once, and they disagreed on whether the children's share was rounded.
  function partyWeight({ adults = 1, children = 0 } = {}) {
    return Math.max(1, Number(adults) || 1) + 0.6 * Math.max(0, Number(children) || 0);
  }

  // The only place a cost becomes a single number for the whole party. Rejects a
  // bare number so a party total can never be multiplied by the party again.
  function partyTotalUsd(cost, party) {
    if (cost == null) return null;
    if (!isCost(cost)) {
      throw new TypeError('partyTotalUsd expects a cost object — a bare number has already lost its basis');
    }
    return cost.basis === PER_GROUP ? cost.usd : cost.usd * partyWeight(party);
  }

  // Both sides converted before comparing, so a per-unit price can never be
  // measured against a party total. Returns null for "cannot tell": equal totals
  // resting on a table guess are two guesses agreeing, not a finding that one is
  // no cheaper than the other.
  function compareCost(a, b, party) {
    if (a == null || b == null) return null;
    const left = partyTotalUsd(a, party);
    const right = partyTotalUsd(b, party);
    if (left === right) return a.source === ESTIMATED || b.source === ESTIMATED ? null : 0;
    return left < right ? -1 : 1;
  }

  const api = {
    PER_PERSON,
    PER_GROUP,
    STATED,
    ENTERED,
    ESTIMATED,
    makeCost,
    isCost,
    readBasis,
    statedCost,
    estimatedCost,
    resolveCost,
    partyWeight,
    partyTotalUsd,
    compareCost
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (root) Object.assign(root, api);
})(typeof window !== 'undefined' ? window : null);
