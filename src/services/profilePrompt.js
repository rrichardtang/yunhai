function sliderInterestLabel(value) {
  const rating = Math.max(1, Math.min(5, Math.round(Number(value) || 3)));
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

  const lines = sliderQuestions.map(([key, label]) => `- ${label}: ${sliderInterestLabel(answers[key])}`);
  const paceValue = Math.max(1, Math.min(5, Math.round(Number(answers.pace) || 3)));
  lines.push(`- Trip pace: ${paceLabels[paceValue]}`);
  for (const [key, label] of textQuestions) {
    const value = String(answers[key] || '').trim();
    if (value) lines.push(`- ${label}: ${value}`);
  }
  const aboutMe = String(profile?.aboutMe || '').trim() || '(none provided)';
  return `${lines.join('\n')}\n- About me: ${aboutMe}`;
}

module.exports = { sliderInterestLabel, formatProfileForEnrichment };
