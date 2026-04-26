const { inferCategory } = require('../arrangeConfig');
const { showUpEarlyMins } = require('../../shared/arrangeArrivalBuffers');
const { minutesFromTime, timeFromMinutes } = require('../../shared/timeHelpers');

function activityLine(a) {
  const isNew = a.timing !== undefined;
  const id = a.id;
  const name = a.name;
  const cat = inferCategory(a);
  const dur = isNew ? a.timing.duration_minutes : Math.round((Number(a.duration_hours) || 1) * 60);
  const hours = isNew ? a.timing.opening_hours : a.opening_hours;
  const preferred = isNew ? a.timing.preferred_time : null;
  const loc = isNew ? a.location?.address : a.start_location;
  const bookingType = isNew ? (a.booking?.type || 'none') : (a.booking_type || 'none');
  const earlyMins = showUpEarlyMins(bookingType);

  const parts = [`id:${id}`, `"${name}"`, cat, `${dur}min`];
  if (hours) parts.push(`hours:${hours}`);
  if (preferred) parts.push(`preferred:${preferred}`);
  if (loc) parts.push(`at:${loc}`);
  if (earlyMins > 0) parts.push(`arrive:${earlyMins}min early (ticketed)`);
  let line = `- ${parts.join(' | ')}`;
  if (a.user_notes) line += `\n  USER NOTE: "${String(a.user_notes).trim()}"`;
  return line;
}

function lockedLine(l) {
  const startMin = minutesFromTime(l.time || '00:00');
  const dur = Number(l.duration_minutes) || 60;
  const end = timeFromMinutes(startMin + dur);
  return `- id:${l.id} "${l.name}" ${l.date} ${l.time}–${end}`;
}

function dayLine(day, locks) {
  let line = `- ${day.date} (${day.label || ''}): window ${day.windowStart || '00:00'}–${day.windowEnd || '23:59'}`;
  if (day.fixedStart) line += `\n  FIXED FIRST: "${day.fixedStart.label}" at ${day.fixedStart.time}`;
  if (day.fixedEnd) line += `\n  FIXED LAST: "${day.fixedEnd.label}" at ${day.fixedEnd.time}`;
  for (const l of locks) {
    const startMin = minutesFromTime(l.time || '00:00');
    const dur = Number(l.duration_minutes) || 60;
    const end = timeFromMinutes(startMin + dur);
    line += `\n  occupied: ${l.time}–${end} "${l.name}"`;
  }
  return line;
}

function categoryCounts(activities) {
  const counts = {};
  for (const a of activities) {
    const c = inferCategory(a);
    counts[c] = (counts[c] || 0) + 1;
  }
  return Object.entries(counts).map(([c, n]) => `${c}: ${n}`).join('; ');
}

function buildHybridArrangePrompt({
  days,
  flexible,
  locked = [],
  profile,
  prefSummary = '',
  numTravelers,
  numChildren
}) {
  const locksByDate = {};
  for (const l of locked) {
    if (!l.date) continue;
    if (!locksByDate[l.date]) locksByDate[l.date] = [];
    locksByDate[l.date].push(l);
  }

  const lockedText = locked.length ? locked.map(lockedLine).join('\n') : '(none)';
  const daysText = days.map((d) => dayLine(d, locksByDate[d.date] || [])).join('\n');
  const activitiesText = flexible.map(activityLine).join('\n');
  const categoryCountsText = categoryCounts(flexible);

  const paceValue = Math.max(1, Math.min(5, Math.round(Number(profile?.answers?.pace) || 3)));
  const paceLabels = { 1: 'very relaxed', 2: 'easy-going', 3: 'moderate', 4: 'active', 5: 'non-stop' };
  const paceDesc = paceLabels[paceValue];

  const travelerBlock = `${numTravelers || 1} adult(s)${numChildren ? `, ${numChildren} child(ren)` : ''}`;
  const profileBlock = prefSummary ? `\nTRAVELER PROFILE:\n${prefSummary}\n` : '';

  return `You arrange approved activities into per-day ordered lists.
You do NOT assign times — times are computed deterministically by server code after your response.

HARD CONSTRAINTS (violations = invalid output):
H1. LOCKED ANCHORS are immovable. Never include a locked id in any ordered_ids list.
    Flexible activities scheduled on the same day must fit around the occupied intervals.
H2. Day windows: every flexible activity must be able to fit within the day's available window,
    accounting for its duration and the buffers noted per day.
H3. Meal category caps (per day): at most ONE breakfast, ONE lunch, ONE dinner.
H4. Non-meal category caps (per day): at most TWO activities sharing the same non-meal category
    (sightseeing, cultural, tour, shopping, nature, landmark, relaxation).
H5. If an activity cannot fit any day without breaking a hard constraint, put it in "unplaced"
    with a one-sentence reason. Never silently drop activities.

SOFT CONSTRAINTS (optimize; relax only if a hard constraint forces it):
S1. Cluster by geography — group nearby activities on the same day.
S2. Alternate intensity — avoid two long/heavy activities back-to-back; interleave with lighter ones.
S3. Day flow: breakfast first if present; dinner last if present; lunch around midday;
    major highlights in the late morning or early afternoon.
S4. Honor pace preference: ${paceDesc}.
S5. Honor preferred_time hints — they inform ordering, not exact times.

INPUT — LOCKED ANCHORS:
${lockedText}

INPUT — DAYS:
${daysText}

INPUT — FLEXIBLE ACTIVITIES:
${activitiesText}

INPUT — CATEGORY COUNTS: ${categoryCountsText}
INPUT — TRAVELERS: ${travelerBlock}${profileBlock}

OUTPUT — strict JSON, no prose, no times, no extra fields:
{"day_plans":[{"date":"YYYY-MM-DD","ordered_ids":["id1","id2"]}],
 "unplaced":[{"id":"...","reason":"..."}]}

Rules for output shape:
- Every flexible id appears exactly once across all ordered_ids OR in unplaced. Never both, never neither.
- Never include a locked id.
- ordered_ids is the intended earliest-to-latest sequence for that day.
- No times, no labels, no extra keys.`;
}

function buildRepairPrompt({ dayPlans, issues }) {
  return `A previous ordering failed deterministic validation. Fix by ONLY reordering activities
within their day OR moving specific ids to unplaced. DO NOT assign times or change the schema.

CURRENT ORDERING:
${JSON.stringify({ day_plans: dayPlans })}

ISSUES (fix every one):
${issues.map((i) => `- [${i.type}] ${i.message}`).join('\n')}

OUTPUT (identical schema as before, strict JSON):
{"day_plans":[{"date":"...","ordered_ids":[...]}],"unplaced":[{"id":"...","reason":"..."}]}`;
}

module.exports = { buildHybridArrangePrompt, buildRepairPrompt };
