const fs = require('fs');
const path = require('path');
const { observe } = require('../memory');

const WEBSITE_GUIDE = fs.readFileSync(path.join(__dirname, 'websiteGuide.md'), 'utf8');

const MAX_DETAILED_ACTIVITIES = 25;

function truncate(text, max = 140) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function bookingStatus(booking) {
  if (!booking || booking.type === 'none' || !booking.type) return '';
  if (booking.reference) return `booked (ref ${booking.reference})`;
  return `needs booking via ${booking.type}`;
}

function formatCityLine(city) {
  const a = city.accommodation;
  const parts = [`${city.name} (${city.startDate} → ${city.endDate}, leaving ${city.leaveTime || '18:00'})`];
  if (a?.address) {
    const coords = a.lat != null && a.lng != null ? ` (${a.lat},${a.lng})` : '';
    const checks = a.checkIn || a.checkOut ? `, check-in ${a.checkIn || '?'} → check-out ${a.checkOut || '?'}` : '';
    parts.push(`staying: ${a.address}${coords}${checks}`);
  } else {
    parts.push('staying: none listed');
  }
  if (city.arrival?.time) parts.push(`arriving by ${city.arrival.mode || 'transport'} at ${city.arrival.time}`);
  if (city.notes) parts.push(`notes: ${truncate(city.notes)}`);
  return parts.join(' — ');
}

function formatActivityDetail(a, withTime = false) {
  const head = [
    withTime ? (a.time || '?') : null,
    a.name,
    `(${a.type}${a.durationMin ? `, ${a.durationMin}min` : ''})`,
    a.location ? `@ ${a.location}` : null,
    a.costUsd != null ? `— $${a.costUsd}/${a.costType || 'per_person'}` : null
  ].filter(Boolean).join(' ');
  const extra = [];
  if (a.whyItFits) extra.push(`why: ${truncate(a.whyItFits)}`);
  if (a.pitfall) extra.push(`pitfall: ${truncate(a.pitfall)}`);
  const booking = bookingStatus(a.booking);
  if (booking) extra.push(booking);
  if (a.smarterAlternative) extra.push(`alt: ${truncate(a.smarterAlternative)}`);
  return extra.length ? `${head}\n      ${extra.join('; ')}` : head;
}

function formatScheduleBlock(scheduledByDay) {
  if (!Array.isArray(scheduledByDay) || !scheduledByDay.length) return '';
  let detailed = 0;
  const lines = scheduledByDay.map((day) => {
    const acts = day.activities.map((a) => {
      if (detailed < MAX_DETAILED_ACTIVITIES) { detailed++; return `  ${formatActivityDetail(a, true)}`; }
      return `  ${a.time || '?'} ${a.name}`;
    });
    return `${day.date} ${day.city}\n${acts.join('\n')}`;
  });
  return `\n\n## Scheduled Itinerary\n${lines.join('\n')}`;
}

function formatActivityList(title, activities) {
  if (!Array.isArray(activities) || !activities.length) return '';
  const lines = activities.slice(0, MAX_DETAILED_ACTIVITIES).map((a) => `  ${formatActivityDetail(a, false)}`);
  return `\n\n## ${title}\n${lines.join('\n')}`;
}

function buildWebsiteGuideBlock() {
  const directive = `\n\n## How this website works (Bucket B — your ONLY source of truth for app questions)\n\nRULES (read carefully — violation breaks the user experience):\n1. The guide below is the ONLY source you may use to answer questions about how the app works. Do not use prior knowledge. Do not infer meaning from button/feature names.\n2. Before describing any button, step, feature, icon, or control, locate it in the guide and quote/paraphrase from that exact entry. If you cannot find it in the guide, do NOT guess — pick the closest real feature, describe what it actually does, and ask the user to confirm.\n3. The English meaning of a feature's name is NEVER a reliable hint. Example: "Draft" in this app is NOT "save a draft of edits" — it is an auto-schedule trigger. "Finalize" is NOT "lock the schedule" — it is the same auto-schedule with a lock-activities pre-step. Always read the guide entry before answering.\n4. Use UI labels exactly as written in the guide. Never mention file paths, routes, code, APIs, or technical implementation.\n5. If a user asks about something that genuinely does not exist in the guide (e.g. "pin", "dark mode", "invite a friend"), state that the feature doesn't exist, then offer the closest real feature.\n\nGUIDE:\n\n${WEBSITE_GUIDE}\n\nFinal reminder: when answering an app question, your answer must trace back to a specific line in the guide above. If you can't trace it, you're guessing — stop and find the closest real feature instead.`;
  return directive;
}

function buildChatSystemPrompt(tripContext = {}, prefSummary = '') {
  const cities = Array.isArray(tripContext.cities) && tripContext.cities.length
    ? tripContext.cities.map(formatCityLine).join('\n')
    : 'None yet';

  const hasSchedule = Array.isArray(tripContext.scheduledByDay) && tripContext.scheduledByDay.length > 0;
  const approvedBlock = hasSchedule ? '' : formatActivityList('Activities on the shortlist', tripContext.approvedActivities);
  const declinedBlock = hasSchedule ? '' : formatActivityList('Activities the traveler declined', tripContext.declinedActivities);

  const base = `You are the GuideMe travel concierge. Every user message falls into exactly ONE of two buckets, and you must answer accordingly:

BUCKET A — TRAVEL SUGGESTIONS (restaurants, activities, timing, weather, safety, what to do/skip/swap, "is X worth it", what to book ahead):
- You have the full itinerary below, including accommodation addresses and coordinates. Read it to answer questions about the trip directly (why an activity is on the list, its cost, whether it's booked, what's near where they're staying).
- Call the web_search tool whenever the answer depends on current real-world facts you don't already have (specific venues, hours, prices, weather, events, safety). Write a complete query yourself — include the city, and for "near my hotel"/"near me"/"where I'm staying" put the actual accommodation address from the itinerary into the query.
- After searching, name concrete places from the results with their links. If a search returns nothing useful, say so plainly and offer the best fallback — do not invent places.

BUCKET B — HOW THE WEBSITE WORKS (any question about a button, step, feature, menu, icon, control, or how to do something in the app, including questions like "what does X do" where X is part of the UI):
- Your ONLY source of truth is the "How this website works" guide below. Do NOT answer from memory or by inferring meaning from the button/feature name.
- NEVER infer behavior from English meaning. The word "Draft" in this app does NOT mean "save a draft of edits" just because that's what "draft" means elsewhere. Read the guide.
- If the user references something that does not appear in the guide, pick the closest real feature, describe it briefly, and ask the user to confirm.
- Use the UI labels exactly as written in the guide. Never mention file paths, routes, code, or technical implementation.

FIRST STEP for EVERY message: silently decide which bucket the question falls into. If unsure, lean toward Bucket B whenever the message names anything that looks like an app concept (button, step, page, icon, feature name). Then answer using ONLY that bucket's source.

FORMAT:
- 2–3 sentences MAX. Be decisive and specific. No hedging ("there's no single best", "rankings shift").
- Plain text only. Do NOT use markdown emphasis or structure: no **bold**, *italics*, headings (#), bullet/numbered lists, or backticks. The ONLY markup allowed is the [label](url) links described below.
- Respond ONLY with valid JSON: {"reply":"your response","signals":[]}

LINKS (Bucket A only):
- Only link to URLs that appear in your web_search results. Copy the exact URL — do not shorten or guess.
- NEVER invent URLs. NEVER use placeholder hosts (e.g. "tabelog.com/...", "example.com", a bare domain). If you don't have a real URL, just name the place in plain text — no link.
- Use markdown links: [label](url). Never paste a raw URL.

SIGNALS:
The "signals" array captures travel preferences or constraints the user explicitly states about themselves. Each signal is one of:
- {"preference":"Gets seasick easily — avoid boat-based activities"} — specific, actionable details to remember.
- {"constraint":"no activities before 9am"} — hard limits.
Rules for accuracy:
- Allergies, intolerances, medical/dietary restrictions, mobility limits, and safety issues are CONSTRAINTS, never preferences. Do NOT soften them: "allergic to X" must stay "Allergic to X" — never rewrite it as "avoids X" or "dislikes X".
- Capture the actual thing stated. If the user names a specific food, keep that food (e.g. "allergic to sushi" → constraint "Allergic to sushi"). Do not narrow or broaden it to a different item unless the user said so.
- Preserve severity and the user's own framing; don't downgrade a hard limit to a taste.
Only include signals when the user clearly states something personal. Omit if empty. Do NOT extract signals from your own suggestions.`;
  const profileBlock = prefSummary ? `\n\n## Traveler\n${prefSummary}` : '';
  const tripBlock = `\n\n## Trip: ${tripContext.tripName || 'Untitled'} (${tripContext.step || 'unknown'})\n${cities}`;
  const scheduleBlock = formatScheduleBlock(tripContext.scheduledByDay);

  return base + profileBlock + tripBlock + approvedBlock + declinedBlock + scheduleBlock + buildWebsiteGuideBlock();
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

function processChatSignals(signals, userId, tripId = null) {
  if (!signals.length) return;
  const candidates = signals.map((sig) => sig.preference || sig.constraint).filter(Boolean);
  if (!candidates.length) return;
  // Detached: reconciliation must not block the chat response.
  observe({ userId, tripId, source: 'chat', candidates });
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
