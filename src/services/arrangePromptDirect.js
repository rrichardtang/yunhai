const { showUpEarlyMins } = require('../../shared/arrangeArrivalBuffers');
const { minutesFromTime, timeFromMinutes } = require('../../shared/timeHelpers');
const { paceDescFromValue } = require('../arrangeConfig');

function activityLine(a) {
  const isNew = a.timing !== undefined;
  const dur = isNew ? a.timing.duration_minutes : Math.round((Number(a.duration_hours) || 1) * 60);
  const hours = isNew ? a.timing.opening_hours : a.opening_hours;
  const preferred = isNew ? a.timing.preferred_time : null;
  const loc = isNew ? a.location?.address : a.start_location;
  const bookingType = isNew ? (a.booking?.type || 'none') : (a.booking_type || 'none');
  const earlyMins = showUpEarlyMins(bookingType);
  const intensity = isNew ? a.experience?.intensity : a.intensity;

  const parts = [`id:${a.id}`, `"${a.name}"`, `${dur}min`];
  if (intensity) parts.push(`intensity:${intensity}`);
  if (hours) parts.push(`hours:${hours}`);
  if (preferred) parts.push(`preferred:${preferred}`);
  if (loc) parts.push(`at:${loc}`);
  if (earlyMins > 0) parts.push(`arrive:${earlyMins}min early`);
  let line = `- ${parts.join(' | ')}`;
  if (a.user_notes) line += `\n  USER NOTE: "${String(a.user_notes).trim()}"`;
  return line;
}

function dayLine(day, locks) {
  let line = `- ${day.date} (${day.label || ''}): window ${day.windowStart || '00:00'}–${day.windowEnd || '23:59'}`;
  if (day.fixedStart) line += `\n  FIXED FIRST: "${day.fixedStart.label}" at ${day.fixedStart.time}`;
  if (day.fixedEnd) line += `\n  FIXED LAST: "${day.fixedEnd.label}" at ${day.fixedEnd.time}`;
  for (const l of locks) {
    const startMin = minutesFromTime(l.time || '00:00');
    const dur = Number(l.duration_minutes) || 60;
    const end = timeFromMinutes(startMin + dur);
    line += `\n  LOCKED: ${l.time}–${end} "${l.name}" (immovable)`;
  }
  return line;
}

function buildCommuteBlock(commuteMatrix, flexible, locked) {
  if (!commuteMatrix || typeof commuteMatrix !== 'object') return '';
  const nameById = new Map();
  for (const a of flexible) nameById.set(String(a.id), String(a.name || a.id));
  for (const l of locked) nameById.set(String(l.id), String(l.name || l.id));

  const seen = new Set();
  const pairs = [];
  for (const [fromId, row] of Object.entries(commuteMatrix)) {
    if (!row || typeof row !== 'object') continue;
    for (const [toId, minutesRaw] of Object.entries(row)) {
      const minutes = Number(minutesRaw);
      if (!Number.isFinite(minutes) || minutes < 15) continue;
      const fromName = nameById.get(String(fromId));
      const toName = nameById.get(String(toId));
      if (!fromName || !toName) continue;
      const key = [fromId, toId].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ fromName, toName, minutes });
    }
  }
  if (!pairs.length) return '';
  pairs.sort((a, b) => b.minutes - a.minutes);
  const lines = pairs.map((p) => `- "${p.fromName}" ↔ "${p.toName}": ${p.minutes} min`);
  return `\n\nCOMMUTE TIMES (real Google Maps durations between activity venues; minutes via fastest mode). Use these as ground truth — when scheduling two of these venues on the same day, the gap between their start times must accommodate the previous activity's duration PLUS this commute. Pairs not listed are walking distance (under 15 min) and need no special planning:\n${lines.join('\n')}`;
}

function buildDirectArrangePrompt({
  days,
  flexible,
  locked = [],
  profile,
  prefSummary = '',
  numTravelers,
  numChildren,
  cityName = '',
  commuteMatrix = null
}) {
  const locksByDate = {};
  for (const l of locked) {
    if (!l.date) continue;
    if (!locksByDate[l.date]) locksByDate[l.date] = [];
    locksByDate[l.date].push(l);
  }

  const daysText = days.map((d) => dayLine(d, locksByDate[d.date] || [])).join('\n');
  const activitiesText = flexible.map(activityLine).join('\n');
  const commuteText = buildCommuteBlock(commuteMatrix, flexible, locked);

  const { desc: paceDesc } = paceDescFromValue(profile?.answers?.pace);

  const travelerBlock = `${numTravelers || 1} adult(s)${numChildren ? `, ${numChildren} child(ren)` : ''}`;
  const profileBlock = prefSummary ? `\nTRAVELER PROFILE:\n${prefSummary}\n` : '';

  return `You are scheduling a trip${cityName ? ` in ${cityName}` : ''}. Build a day-by-day schedule with concrete start times.

PRIMARY DIRECTIVE: Place EVERY flexible activity. The traveler approved all of these — they want them in the schedule. Your default action is "place it." Only put an activity in unplaced when you cannot physically fit it given the hard constraints below.

HARD CONSTRAINTS (the only valid reasons to leave something unplaced):
1. The activity's opening_hours do not intersect any day window across the whole trip
2. Placing it would require overlapping a LOCKED activity
3. There is no remaining time slot of its duration on any day window — only after attempting placement on every day

NOT VALID REASONS to leave something unplaced:
- "redundant with another activity" — the traveler chose both, place both
- "all slots are claimed" — claim slots aggressively, that's the job
- "pacing redundancy" — pace is a soft preference, not a constraint

SOFT PREFERENCES (use to choose between valid placements, never to reject):
- Local meal customs, sunset timing, crowd patterns
- Semantic intent in names and USER NOTES — "sunset drinks" → near dusk, "morning hike" → early
- Reasonable pacing — don't stack two food events back-to-back when a non-food alternative fits
- Geographic clustering when the routing is obvious

PLACEMENT STRATEGY:
- Days have ~12-16 hours of window. Multiple activities per day is expected and encouraged.
- MEALS (activity.type === "meal"): place AT MOST one meal in the lunch window (11:00-14:30) and one meal in the dinner window (17:00-22:00) per day. Decide each meal's slot by checking its opening_hours — if the restaurant only opens after 17:00, it can ONLY be that day's dinner, never the lunch. If multiple approved meals qualify for the same slot on the same day, pick the one closest geographically to that day's other activities and move the rest to unplaced with reason "no_time_slot_remaining". Never schedule two meals in the same slot on the same day. Never schedule a meal outside both windows.
- Lunch and dinner anchor the day; non-meal activities fit between them.
- A typical full day has 4–8 activities depending on pace.
- Distribute activities evenly across days. A day with 0–2 activities while another has 8+ is poor balance — move overflow to the lighter day before pushing anything to unplaced.

DAYS:
${daysText}

ACTIVITIES TO SCHEDULE:
${activitiesText}${commuteText}

TRAVELERS: ${travelerBlock}
PACE: ${paceDesc}${profileBlock}

OUTPUT — strict JSON only:
{
  "placements": { "<id>": { "date": "YYYY-MM-DD", "time": "HH:MM" } },
  "unplaced": [ { "id": "<id>", "reason": "<one of: opening_hours_no_fit | locked_conflict | no_time_slot_remaining>" } ]
}

Every flexible activity must appear in either placements or unplaced — never both, never neither.
Never include locked ids. Times are 24-hour HH:MM.`;
}

function buildRepairPrompt({ placements, issues, activitiesById }) {
  const placementLines = Object.entries(placements)
    .map(([id, p]) => {
      const name = activitiesById[id]?.name || id;
      return `  ${id} ("${name}"): ${p.date} ${p.time}`;
    })
    .join('\n');

  return `Your previous schedule has physical conflicts that must be fixed. Adjust times (or move ids to unplaced) to resolve every issue. Do not introduce new conflicts.

CURRENT PLACEMENTS:
${placementLines}

ISSUES TO FIX:
${issues.map((i) => `- [${i.type}] ${i.message}`).join('\n')}

OUTPUT — same schema as before, strict JSON:
{"placements":{"<id>":{"date":"YYYY-MM-DD","time":"HH:MM"}},"unplaced":[{"id":"<id>","reason":"..."}]}`;
}

module.exports = { buildDirectArrangePrompt, buildRepairPrompt };
