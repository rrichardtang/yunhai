(function (root) {
  // A verdict is a decision the traveler made: true (approved) or false (declined).
  // Anything else — undefined, null, a record holding only notes — means they have
  // not decided yet. Truthiness is not enough here: `false` is a real answer.
  function activityVerdict(reviewed, activityId) {
    // An activity nobody has touched has no record at all, so the optional chain is
    // load-bearing rather than defensive.
    const verdict = reviewed[activityId]?.approved;
    return verdict === true || verdict === false ? verdict : null;
  }

  // Review is finished when every activity has a verdict, not when one has been
  // approved. Approving a few and leaving the rest untouched is a half-reviewed
  // trip, and letting it through means arranging a schedule around activities the
  // traveler never actually looked at.
  //
  // visibleIds is what the Review filters currently leave on screen. It does not
  // affect whether the step is complete — a hidden undecided activity still blocks —
  // only what the blocked message can tell the traveler.
  function reviewGateState(activities, reviewed, visibleIds) {
    if (!activities.length) {
      return { canContinue: false, undecidedCount: 0, hiddenCount: 0, reason: 'Plan some activities to continue' };
    }

    const undecided = activities.filter((a) => activityVerdict(reviewed, a.id) === null);
    const approvedCount = activities.filter((a) => activityVerdict(reviewed, a.id) === true).length;

    if (!undecided.length) {
      return approvedCount
        ? { canContinue: true, undecidedCount: 0, hiddenCount: 0, reason: '' }
        : { canContinue: false, undecidedCount: 0, hiddenCount: 0, reason: 'Approve at least one activity to continue' };
    }

    const hiddenCount = undecided.filter((a) => !visibleIds.has(a.id)).length;
    const count = `${undecided.length} activit${undecided.length === 1 ? 'y' : 'ies'}`;
    // Approve All only covers what the filters leave visible, so an undecided
    // activity hidden behind a filter is otherwise a dead end: the button stays
    // disabled and nothing on screen explains why.
    const reason = hiddenCount
      ? `Approve or decline the remaining ${count} to continue — ${hiddenCount} hidden by your current filters`
      : `Approve or decline the remaining ${count} to continue`;

    return { canContinue: false, undecidedCount: undecided.length, hiddenCount, reason };
  }

  const api = { activityVerdict, reviewGateState };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (root) Object.assign(root, api);
})(typeof window !== 'undefined' ? window : null);
