function sliderRating(value) {
  return Math.max(1, Math.min(5, Math.round(Number(value) || 3)));
}

function sliderInterestLabel(value) {
  const rating = sliderRating(value);
  if (rating === 1) return 'Not interested';
  if (rating === 2) return 'Slightly interested';
  if (rating === 3) return 'Neutral';
  if (rating === 4) return 'Very interested';
  return 'Loves this';
}

function formatProfileForEnrichment(profile = {}) {
  const answers = profile?.answers && typeof profile.answers === 'object' ? profile.answers : {};
  const sliderQuestions = [
    ['museumPerson', 'Museum person'],
    ['foodTravel', 'Travels for food'],
    ['livePerformances', 'Live performances'],
    ['outdoorNature', 'Outdoor / nature activities'],
    ['nightlifeBars', 'Nightlife and bars'],
    ['structuredTours', 'Structured tours'],
    ['shoppingPerson', 'Shopping while traveling']
  ];
  const textQuestions = [
    ['dietaryRestrictions', 'Dietary restrictions'],
    ['mobilityConsiderations', 'Mobility considerations'],
    ['budgetStyle', 'Budget style'],
    ['travelCompanions', 'Travel companions'],
    ['shoppingInterests', 'Shopping interests']
  ];
  const paceLabels = { 1: 'Very relaxed', 2: 'Easy-going', 3: 'Moderate', 4: 'Active', 5: 'Non-stop' };

  // The numeral carries the filtering rule the plan prompt keys on; the words
  // alone left "Slightly interested" open to interpretation as "include a few".
  // An unanswered slider is omitted rather than reported as a neutral 3 — the
  // planner defaults unanswered shopping to 1, so claiming 3/5 here would hand
  // the model an opinion the traveler never gave.
  const lines = sliderQuestions
    .filter(([key]) => answers[key] != null && answers[key] !== '')
    .map(([key, label]) => `- ${label}: ${sliderRating(answers[key])}/5 (${sliderInterestLabel(answers[key])})`);
  const paceValue = sliderRating(answers.pace);
  lines.push(`- Trip pace: ${paceValue}/5 (${paceLabels[paceValue]})`);
  for (const [key, label] of textQuestions) {
    const value = String(answers[key] || '').trim();
    if (value) lines.push(`- ${label}: ${value}`);
  }
  const aboutMe = String(profile?.aboutMe || '').trim() || '(none provided)';
  return `${lines.join('\n')}\n- About me: ${aboutMe}`;
}

module.exports = { sliderRating, sliderInterestLabel, formatProfileForEnrichment };
