const fs = require('fs');
const path = require('path');
const { recordPreference, recordConstraint } = require('../preferences');

const WEBSITE_GUIDE = fs.readFileSync(path.join(__dirname, 'websiteGuide.md'), 'utf8');

// Travel/activity-suggestion signals. If the message contains ANY of these
// (as whole words), it's a Bucket A (travel suggestion) question — route
// to Brave search. Otherwise, default to Bucket B (website) and load the
// guide. Keywords kept specific to avoid false positives — short generic
// words like "do", "see", "try", "go" are intentionally excluded.
const TRAVEL_KEYWORDS = [
  // food + dining
  'restaurant', 'restaurants', 'cafe', 'café', 'cafes', 'cafés', 'bistro', 'bistros',
  'pub', 'pubs', 'dining', 'eat', 'eating', 'food', 'foods', 'dish', 'dishes',
  'cuisine', 'cuisines', 'meal', 'meals', 'breakfast', 'lunch', 'dinner', 'brunch',
  'snack', 'snacks', 'drink', 'drinks', 'coffee', 'tea', 'wine', 'cocktail', 'cocktails',
  'ramen', 'sushi', 'tapas', 'pizza', 'pasta', 'noodles', 'bbq', 'michelin', 'reservation',
  // places + attractions
  'museum', 'museums', 'gallery', 'galleries', 'park', 'parks', 'beach', 'beaches',
  'temple', 'temples', 'shrine', 'shrines', 'church', 'churches', 'cathedral',
  'mosque', 'monument', 'landmark', 'landmarks', 'palace', 'castle', 'castles',
  'neighborhood', 'neighborhoods', 'neighbourhood', 'neighbourhoods',
  'district', 'districts', 'attraction', 'attractions', 'sight', 'sights',
  'sightseeing', 'tour', 'tours', 'guided',
  'market', 'markets', 'mall', 'malls', 'boutique', 'boutiques',
  // travel verbs / nouns
  'visit', 'visiting', 'explore', 'exploring', 'experience',
  'recommend', 'recommendation', 'recommendations', 'suggest', 'suggestion', 'suggestions',
  'must-see', 'must-do', 'hidden gem', 'hidden gems', 'itinerary idea',
  // logistics + weather
  'weather', 'rain', 'rains', 'raining', 'rainy', 'sunny', 'cloudy', 'forecast',
  'temperature', 'humidity', 'transport', 'transit', 'metro', 'subway', 'bus',
  'taxi', 'uber', 'rental', 'walking', 'flight', 'flights', 'airport', 'train',
  'hotel', 'hotels', 'airbnb', 'jetlag', 'jet lag', 'currency', 'tipping', 'safety',
  // activity types
  'hike', 'hikes', 'hiking', 'swim', 'swimming', 'snorkel', 'snorkeling',
  'dive', 'diving', 'surf', 'surfing', 'ski', 'skiing', 'bike', 'biking', 'cycling',
  // shopping (the activity, not the step)
  'souvenirs', 'gifts',
  // contextual phrases
  'near my hotel', 'near the hotel', 'nearby', 'around here',
  'swap', 'swap for', 'alternative to', 'something else'
];

const TRAVEL_KEYWORD_REGEX = new RegExp(
  '\\b(' + TRAVEL_KEYWORDS.map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'i'
);

function looksLikeHelpQuestion(message) {
  if (!message || typeof message !== 'string') return false;
  // Default to Bucket B (website help) unless the message clearly asks for
  // travel suggestions. The small chat model is much more likely to invent
  // app behavior than to invent travel facts, so this bias is safer.
  return !TRAVEL_KEYWORD_REGEX.test(message);
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
  const directive = `\n\n## How this website works (Bucket B — your ONLY source of truth for app questions)\n\nRULES (read carefully — violation breaks the user experience):\n1. The guide below is the ONLY source you may use to answer questions about how the app works. Do not use prior knowledge. Do not infer meaning from button/feature names.\n2. Before describing any button, step, feature, icon, or control, locate it in the guide and quote/paraphrase from that exact entry. If you cannot find it in the guide, do NOT guess — pick the closest real feature, describe what it actually does, and ask the user to confirm.\n3. The English meaning of a feature's name is NEVER a reliable hint. Example: "Draft" in this app is NOT "save a draft of edits" — it is an auto-schedule trigger. "Finalize" is NOT "lock the schedule" — it is the same auto-schedule with a lock-activities pre-step. Always read the guide entry before answering.\n4. Use UI labels exactly as written in the guide. Never mention file paths, routes, code, APIs, or technical implementation.\n5. If a user asks about something that genuinely does not exist in the guide (e.g. "pin", "dark mode", "invite a friend"), state that the feature doesn't exist, then offer the closest real feature.\n\nGUIDE:\n\n${WEBSITE_GUIDE}\n\nFinal reminder: when answering an app question, your answer must trace back to a specific line in the guide above. If you can't trace it, you're guessing — stop and find the closest real feature instead.`;
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

  const base = `You are the GuideMe travel concierge. Every user message falls into exactly ONE of two buckets, and you must answer accordingly:

BUCKET A — TRAVEL SUGGESTIONS (restaurants, activities, timing, weather, what to do, what to skip, what to swap):
- Ground your answer in the "Web Search Results" section if it is present below. Name concrete places/operators from those results.
- If no search results are present for a travel question, say so plainly in one sentence — do not guess from general knowledge.

BUCKET B — HOW THE WEBSITE WORKS (any question about a button, step, feature, menu, icon, control, or how to do something in the app, including questions like "what does X do" where X is part of the UI):
- Your ONLY source of truth is the "How this website works" guide below. If the guide is not present below, say: "Let me check that — could you ask again?" Do NOT answer from memory or by inferring meaning from the button/feature name.
- NEVER infer behavior from English meaning. The word "Draft" in this app does NOT mean "save a draft of edits" just because that's what "draft" means elsewhere. Read the guide.
- If the user references something that does not appear in the guide, pick the closest real feature, describe it briefly, and ask the user to confirm.
- Use the UI labels exactly as written in the guide. Never mention file paths, routes, code, or technical implementation.

FIRST STEP for EVERY message: silently decide which bucket the question falls into. If unsure, lean toward Bucket B whenever the message names anything that looks like an app concept (button, step, page, icon, feature name). Then answer using ONLY that bucket's source.

FORMAT:
- 2–3 sentences MAX. Be decisive and specific. No hedging ("there's no single best", "rankings shift").
- Respond ONLY with valid JSON: {"reply":"your response","signals":[]}

LINKS (Bucket A only):
- Only link to URLs that appear in the Web Search Results. Copy the exact URL — do not shorten or guess.
- NEVER invent URLs. NEVER use placeholder hosts (e.g. "tabelog.com/...", "example.com", a bare domain). If you don't have a real URL, just name the place in plain text — no link.
- Use markdown links: [label](url). Never paste a raw URL.

SIGNALS:
The "signals" array captures travel preferences or constraints the user explicitly states about themselves. Each signal is one of:
- {"preference":"Gets seasick easily — avoid boat-based activities"} — specific, actionable details to remember.
- {"constraint":"no activities before 9am"} — hard limits.
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
