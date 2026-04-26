const { showUpEarlyMins } = require('../../shared/arrangeArrivalBuffers');
const { minutesFromTime, timeFromMinutes } = require('../../shared/timeHelpers');

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

function buildDirectArrangePrompt({
  days,
  flexible,
  locked = [],
  profile,
  prefSummary = '',
  numTravelers,
  numChildren,
  cityName = ''
}) {
  const locksByDate = {};
  for (const l of locked) {
    if (!l.date) continue;
    if (!locksByDate[l.date]) locksByDate[l.date] = [];
    locksByDate[l.date].push(l);
  }

  const daysText = days.map((d) => dayLine(d, locksByDate[d.date] || [])).join('\n');
  const activitiesText = flexible.map(activityLine).join('\n');

  const paceValue = Math.max(1, Math.min(5, Math.round(Number(profile?.answers?.pace) || 3)));
  const paceLabels = { 1: 'very relaxed', 2: 'easy-going', 3: 'moderate', 4: 'active', 5: 'non-stop' };
  const paceDesc = paceLabels[paceValue];

  const travelerBlock = `${numTravelers || 1} adult(s)${numChildren ? `, ${numChildren} child(ren)` : ''}`;
  const profileBlock = prefSummary ? `\nTRAVELER PROFILE:\n${prefSummary}\n` : '';

  return `You are scheduling a trip${cityName ? ` in ${cityName}` : ''}. Build a day-by-day schedule with concrete start times.

You have full judgment over ordering and timing. Use what you know:
- Local sunset, meal customs, and crowd patterns for the destination and season
- Semantic intent in activity names and USER NOTES — "sunset drinks" means near dusk, "nightcap" means after dinner, "morning hike" means early
- Reasonable pacing — don't stack two food events back-to-back, don't put high-intensity activities in a row, leave breathing room
- Opening hours, locked anchors, and day windows are constraints you must respect

DAYS:
${daysText}

ACTIVITIES TO SCHEDULE:
${activitiesText}

TRAVELERS: ${travelerBlock}
PACE: ${paceDesc}${profileBlock}

OUTPUT — strict JSON only:
{
  "placements": { "<id>": { "date": "YYYY-MM-DD", "time": "HH:MM" } },
  "unplaced": [ { "id": "<id>", "reason": "..." } ]
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
