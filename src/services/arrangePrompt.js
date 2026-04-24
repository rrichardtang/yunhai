const { showUpEarlyMins } = require('../../shared/arrangeArrivalBuffers');

function activityForPrompt(a) {
  const isNew = a.timing !== undefined;
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    durationHours: isNew ? a.timing.duration_minutes / 60 : (Number(a.duration_hours) || 1),
    opening_hours: isNew ? a.timing.opening_hours : (a.opening_hours || ''),
    preferred_time: isNew ? a.timing.preferred_time : null,
    location: isNew ? a.location.address : (a.start_location || ''),
    estimated_cost_usd: isNew ? a.cost.estimated_usd : a.estimated_cost_usd,
    cost_type: isNew ? a.cost.type : (a.cost_type || 'per_person'),
    booking_type: isNew ? (a.booking?.type || 'none') : (a.booking_type || 'none'),
    user_notes: String(a.user_notes || '').trim()
  };
}

function buildArrangePrompt({
  days,
  activities,
  lockedActivities = [],
  profile,
  prefSummary = '',
  budget,
  numTravelers,
  numChildren,
  approvedCostTotal
}) {
  const lockedByDate = {};
  for (const lock of lockedActivities) {
    if (!lock.date) continue;
    if (!lockedByDate[lock.date]) lockedByDate[lock.date] = [];
    lockedByDate[lock.date].push(lock);
  }

  const daysText = days.map((d) => {
    let line = `- ${d.date} (${d.label}): available ${d.windowStart} – ${d.windowEnd}`;
    if (d.fixedStart) line += `\n  FIXED FIRST: "${d.fixedStart.label}" at ${d.fixedStart.time} — schedule NO activities before this`;
    if (d.fixedEnd) line += `\n  FIXED LAST: "${d.fixedEnd.label}" at ${d.fixedEnd.time} — schedule NO activities after this`;
    const locks = lockedByDate[d.date] || [];
    for (const lock of locks) {
      const durMins = Number(lock.duration_minutes) || 60;
      const [lh, lm] = String(lock.time || '00:00').split(':').map(Number);
      const endMins = (lh * 60 + (lm || 0)) + durMins;
      const endH = Math.floor(endMins / 60);
      const endM = endMins % 60;
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      line += `\n  ALREADY OCCUPIED (do not overlap): ${lock.time}–${endTime} "${lock.name}"`;
    }
    return line;
  }).join('\n');

  const activitiesText = activities.map((a) => {
    const p = activityForPrompt(a);
    const parts = [`id:${p.id}`, `"${p.name}"`, p.category, `${p.durationHours}h`];
    if (p.opening_hours) parts.push(`hours:${p.opening_hours}`);
    if (p.preferred_time) parts.push(`preferred:${p.preferred_time}`);
    if (p.location) parts.push(`at:${p.location}`);
    if (p.estimated_cost_usd !== null && p.estimated_cost_usd !== undefined) parts.push(`cost:$${p.estimated_cost_usd}${p.cost_type === 'per_group' ? '/group' : '/person'}`);
    const earlyMins = showUpEarlyMins(p.booking_type);
    if (earlyMins > 0) parts.push(`arrive:${earlyMins}min early (ticketed)`);
    let line = `- ${parts.join(' | ')}`;
    if (p.user_notes) line += `\n  USER NOTE: "${p.user_notes}"`;
    return line;
  }).join('\n');
  const perDay = Math.ceil(activities.length / days.length);

  const paceValue = Math.max(1, Math.min(5, Math.round(Number(profile?.answers?.pace) || 3)));
  const paceLabels = { 1: 'very relaxed', 2: 'easy-going', 3: 'moderate', 4: 'active', 5: 'non-stop' };
  const paceDesc = paceLabels[paceValue];
  const travelerBlock = prefSummary ? `\nTRAVELER PROFILE:\n${prefSummary}\nPace preference: ${paceDesc}\n` : `\nPace preference: ${paceDesc}\n`;

  return `Schedule ${activities.length} activities across ${days.length} days. Target ~${perDay} activities per day — distribute evenly.

DAYS:
${daysText}

ACTIVITIES:
${activitiesText}
${travelerBlock}
RULES (priority order):
1. Distribute ~${perDay} activities per day.
2. Stay within each day's available window (windowStart–windowEnd).
2a. ALREADY OCCUPIED intervals are booked — do not place any activity that overlaps them (including a 20-minute travel buffer on each side).
3. FIXED FIRST/LAST bookends are immovable.
4. Respect opening hours.
5. Meals at realistic times: breakfast 7–9am, lunch 11:30am–1:30pm, dinner 6–8:30pm.
6. No overlaps — account for duration + 20min travel buffer between activities.
7. Group nearby locations on the same day when possible.
8. Honor preferred time hints when they fit.
9. Respect the traveler's ${paceDesc} pace preference — ${paceValue <= 2 ? 'leave generous gaps between activities and favor fewer, longer experiences' : paceValue >= 4 ? 'pack days tightly with minimal downtime between activities' : 'balance activity with reasonable breaks'}.
10. Tours and attractions marked "arrive:N min early (ticketed)" require arrival N minutes before the ticket start time — block that arrival time plus the full duration as occupied.
11. Honor USER NOTE instructions when scheduling (e.g., "arrive 30 min early", "must be before sunset").
12. If an activity cannot fit, include it in unplaced with a reason.
${budget && approvedCostTotal !== undefined ? `13. Budget note: The traveler's total budget is $${budget} for ${numTravelers || 1} adult(s)${numChildren ? ` and ${numChildren} child(ren)` : ''}. Total estimated cost of approved activities is $${approvedCostTotal}. If over budget, note it in a top-level "budget_warning" string field.` : ''}

Respond ONLY with JSON:
{"placements":{"<id>":{"date":"YYYY-MM-DD","time":"HH:MM"}},"unplaced":[{"id":"<id>","reason":"..."}]}`;
}

module.exports = { activityForPrompt, buildArrangePrompt };
