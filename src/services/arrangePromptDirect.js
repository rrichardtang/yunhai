const { minutesFromTime, timeFromMinutes } = require('../../shared/timeHelpers');
const { paceDescFromValue } = require('../arrangeConfig');
const { activityCoords, haversineKm } = require('./geo');

const WALKING_CLUSTER_KM = 1.5;

function buildClusterBlock(flexible) {
  const withCoords = flexible
    .map((a) => ({ a, coords: activityCoords(a) }))
    .filter((x) => x.coords);
  if (withCoords.length < 2) return '';
  const neighborsByName = new Map();
  for (let i = 0; i < withCoords.length; i += 1) {
    const { a: ai, coords: ci } = withCoords[i];
    const name = String(ai.name || ai.id);
    if (!neighborsByName.has(name)) neighborsByName.set(name, []);
    for (let j = 0; j < withCoords.length; j += 1) {
      if (i === j) continue;
      const { a: aj, coords: cj } = withCoords[j];
      if (haversineKm(ci.lat, ci.lng, cj.lat, cj.lng) < WALKING_CLUSTER_KM) {
        neighborsByName.get(name).push(String(aj.name || aj.id));
      }
    }
  }
  const lines = [];
  for (const [name, others] of neighborsByName) {
    if (!others.length) continue;
    lines.push(`- "${name}" near ${others.map((n) => `"${n}"`).join(', ')}`);
  }
  if (!lines.length) return '';
  return `\n\nWALKING NEIGHBORS (under 1.5 km apart — assign these to the SAME day so the day stays geographically tight):\n${lines.join('\n')}`;
}

function activityLine(a) {
  const isNew = a.timing !== undefined;
  const dur = isNew ? a.timing.duration_minutes : Math.round((Number(a.duration_hours) || 1) * 60);
  const hours = isNew ? a.timing.opening_hours : a.opening_hours;
  const loc = isNew ? a.location?.address : a.start_location;
  const type = a.type || '';

  const parts = [`id:${a.id}`, `"${a.name}"`];
  if (type) parts.push(`type:${type}`);
  parts.push(`${dur}min`);
  if (hours) parts.push(`hours:${hours}`);
  if (loc) parts.push(`at:${loc}`);
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

function buildSchedulingPrefsBlock(prefs) {
  if (!prefs || typeof prefs !== 'object') return '';
  const breaksLabels = ['back-to-back', 'short breaks', 'moderate breaks', 'generous breaks', 'lots of downtime'];
  const breaks = Math.max(1, Math.min(5, Math.round(Number(prefs.breaksBetween) || 3)));
  const lines = [];
  if (prefs.dayStartTime && prefs.dayEndTime) {
    lines.push(`- Preferred day window: ${prefs.dayStartTime}–${prefs.dayEndTime}`);
  }
  if (prefs.tourTiming) lines.push(`- Tour timing preference: ${prefs.tourTiming}`);
  lines.push(`- Pacing: ${breaksLabels[breaks - 1]} (affects how many activities belong on one day)`);
  const notes = String(prefs.notes || '').trim();
  if (notes) lines.push(`- Additional notes from traveler: "${notes}"`);
  if (!lines.length) return '';
  return `\n\nSCHEDULING PREFERENCES (traveler-stated — use to choose day groupings):\n${lines.join('\n')}`;
}

const STATIC_ARRANGE_SYSTEM = `You assign approved activities to days for a trip. You do NOT choose times, within-day order, or meal times — code computes all of that deterministically. Your only job is: which day does each activity go on.

RULES:
- Place EVERY activity on exactly one day. Group activities that are geographically near each other (see WALKING NEIGHBORS and the "at:" locations) onto the SAME day to minimize travel.
- MEALS (type:meal): put AT MOST one lunch-capable and one dinner-capable meal on a day. Judge from the meal's hours — a venue that closes before 17:00 can only be lunch; one that opens at/after 17:00 can only be dinner; one open across both can be either. Spread meals across days; never put two lunches or two dinners on the same day.
- Balance the load: with N activities across M days, aim for roughly N/M per day. Don't overload a day that already has several LOCKED anchors.
- You do not need to worry about opening-hours timing, commute math, or ordering within a day — code handles all of it and will drop anything that genuinely cannot fit.

Output via assign_days: assignment = { "YYYY-MM-DD": [activity ids assigned to that day] }. Every activity id on exactly one day. No times. No within-day order.`;

function buildAssignPrompt({
  days,
  flexible,
  locked = [],
  profile,
  prefSummary = '',
  numTravelers,
  numChildren,
  cityName = '',
  schedulingPrefs = null
}) {
  const locksByDate = {};
  for (const l of locked) {
    if (!l.date) continue;
    if (!locksByDate[l.date]) locksByDate[l.date] = [];
    locksByDate[l.date].push(l);
  }

  const daysText = days.map((d) => dayLine(d, locksByDate[d.date] || [])).join('\n');
  const activitiesText = flexible.map(activityLine).join('\n');
  const clusterText = buildClusterBlock(flexible);

  const { desc: paceDesc } = paceDescFromValue(profile?.answers?.pace);
  const travelerBlock = `${numTravelers || 1} adult(s)${numChildren ? `, ${numChildren} child(ren)` : ''}`;
  const profileBlock = prefSummary ? `\nTRAVELER PROFILE:\n${prefSummary}\n` : '';
  const schedPrefsBlock = buildSchedulingPrefsBlock(schedulingPrefs);

  return `Assign these activities to days for a trip${cityName ? ` in ${cityName}` : ''}.

DAYS:
${daysText}

ACTIVITIES TO ASSIGN:
${activitiesText}${clusterText}

TRAVELERS: ${travelerBlock}
PACE: ${paceDesc}${profileBlock}${schedPrefsBlock}

Assign every activity id to exactly one day via assign_days. No times, no within-day order — code computes those.`;
}

module.exports = { buildAssignPrompt, STATIC_ARRANGE_SYSTEM };
