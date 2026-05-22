const fs = require('fs');
const path = require('path');
const { recordPreference, recordConstraint } = require('../preferences');

const WEBSITE_GUIDE = fs.readFileSync(path.join(__dirname, 'websiteGuide.md'), 'utf8');

const HELP_PHRASES = [
  'how do i', 'how do you', 'how can i', 'how does',
  'where do i', 'where is', 'where can i', 'where are',
  'what does', 'what is the', 'what are the',
  'can i', 'is there a way', 'is there an option',
  "i don't know how", "i dont know how", "i'm confused", 'im confused',
  'confused about', 'help me with', 'help with the'
];

const HELP_NOUNS = [
  'button', 'step', 'tab', 'menu', 'icon', 'checklist', 'calendar export',
  'forwarding', 'forward email', 'preferences', 'profile', 'lock', 'unlock',
  'arrange', 'trip health', 'finalize', 'draft', 'approve', 'decline',
  'budget optimization', 'sign in', 'share trip', 'pdf', 'sync'
];

function looksLikeHelpQuestion(message) {
  if (!message || typeof message !== 'string') return false;
  const m = message.toLowerCase();
  return HELP_PHRASES.some((p) => m.includes(p)) || HELP_NOUNS.some((n) => m.includes(n));
}

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

function buildWebsiteGuideBlock() {
  const directive = `\n\n## How this website works (for answering user help questions)\n\nWhen the user asks about how the app works, the guide below is your ONLY source of truth. Do not invent features, buttons, settings, or behaviors that are not described in the guide. If the user's question references something that does not appear in the guide, assume the user is mistaken or using the wrong term: pick the closest real feature, briefly describe what it does in one sentence, and ask the user to confirm whether that is what they meant (e.g. "I don't see a 'pin' feature, but you can **Lock** an activity in the Arrange step so its time stays fixed. Is that what you mean?"). Never fabricate steps. Never say "you might be able to" or "try going to" if the action isn't in the guide. If nothing in the guide is even close, say so plainly and ask the user to describe what they're trying to accomplish.\n\n${WEBSITE_GUIDE}\n\nReminder: only describe features that exist in the guide above.`;
  return directive;
}

function buildChatSystemPrompt(tripContext = {}, prefSummary = '', opts = {}) {
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

  const guideBlock = opts.includeWebsiteGuide ? buildWebsiteGuideBlock() : '';
  return base + profileBlock + tripBlock + scheduleBlock + guideBlock;
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
  toOpenAiMessages,
  looksLikeHelpQuestion
};
