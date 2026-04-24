const { recordPreference, recordConstraint } = require('../preferences');

function formatCityLine(city) {
  const accomLabel = city.accommodation?.address || 'none listed';
  return `${city.name} (${city.startDate} → ${city.endDate}, leaving ${city.leaveTime || '18:00'}) — staying: ${accomLabel}`;
}

function formatScheduleBlock(scheduledByDay) {
  if (!Array.isArray(scheduledByDay) || !scheduledByDay.length) return '';
  const lines = scheduledByDay.map((day) => {
    const acts = day.activities.map((a) => `  ${a.time || '?'} ${a.name} (${a.type}, ${a.duration || '?'})`);
    return `${day.date} ${day.city}\n${acts.join('\n')}`;
  });
  return `\n\n## Scheduled Itinerary\n${lines.join('\n')}`;
}

function buildChatSystemPrompt(tripContext = {}, prefSummary = '') {
  const cities = Array.isArray(tripContext.cities) && tripContext.cities.length
    ? tripContext.cities.map(formatCityLine).join('\n')
    : 'None yet';

  const hasSchedule = Array.isArray(tripContext.scheduledByDay) && tripContext.scheduledByDay.length > 0;
  let activityLines = '';
  if (!hasSchedule) {
    const approved = Array.isArray(tripContext.approvedActivities) && tripContext.approvedActivities.length
      ? tripContext.approvedActivities.join(', ') : '';
    if (approved) activityLines = `\n- Approved: ${approved}`;
  }

  const base = `You are a concise, accurate, confident travel concierge. You know this trip's dates, accommodations, scheduled activities, and the traveler's preferences. Answer in 2-3 sentences MAX — no exceptions. Be decisive and specific: give the best option first, then one sharp reason. Never hedge with "there's no single best" or "rankings shift." If search results are present, ground recommendations in them and name concrete places/operators with markdown links.

Respond ONLY with valid JSON: {"reply":"your response","signals":[]}
CRITICAL: Inside the "reply" value, NEVER paste raw URLs. Always use markdown links: [label](url). Example: "Try [Sushi Dai](https://tabelog.com/...)." Raw URLs waste space and are unreadable.
The "signals" array captures any travel preferences or constraints the user explicitly states. Each signal is one of:
- Preference: {"preference":"Gets seasick easily — avoid boat-based activities"} — specific, actionable details the AI should remember.
- Constraint: {"constraint":"no activities before 9am"} — hard limits.
Only include signals when the user clearly states something personal. Omit if empty. Do NOT extract signals from your own suggestions.`;
  const profileBlock = prefSummary ? `\n\n## Traveler\n${prefSummary}` : '';
  const tripBlock = `\n\n## Trip: ${tripContext.tripName || 'Untitled'} (${tripContext.step || 'unknown'})\n${cities}${activityLines}`;
  const scheduleBlock = formatScheduleBlock(tripContext.scheduledByDay);

  return base + profileBlock + tripBlock + scheduleBlock;
}

function parseChatResponse(raw) {
  const fallback = { reply: raw || 'Sorry, I couldn\'t process that.', signals: [] };
  try {
    const stripped = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(stripped);
    if (typeof parsed.reply !== 'string') return fallback;
    return { reply: parsed.reply, signals: Array.isArray(parsed.signals) ? parsed.signals : [] };
  } catch {
    return fallback;
  }
}

function processChatSignals(signals, userId) {
  if (!signals.length) return;
  for (const sig of signals) {
    if (sig.preference) recordPreference(userId, sig.preference);
    else if (sig.constraint) recordConstraint(userId, sig.constraint);
  }
}

function toOpenAiMessages(history = []) {
  return history.map((msg) => {
    if (msg.role === 'system') {
      return { role: 'system', content: msg.content };
    }
    return {
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    };
  });
}

module.exports = {
  buildChatSystemPrompt,
  parseChatResponse,
  processChatSignals,
  toOpenAiMessages
};
