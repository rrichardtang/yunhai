const { showUpEarlyMins } = require('../../shared/arrangeArrivalBuffers');
const { minutesFromTime, timeFromMinutes } = require('../../shared/timeHelpers');
const { paceDescFromValue } = require('../arrangeConfig');

const WALKING_CLUSTER_KM = 1.5;

function activityCoords(a) {
  const lat = Number(a?.location?.lat);
  const lng = Number(a?.location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  const sLat = Number(a?.start_latitude);
  const sLng = Number(a?.start_longitude);
  if (Number.isFinite(sLat) && Number.isFinite(sLng)) return { lat: sLat, lng: sLng };
  return null;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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
      if (haversineKm(ci, cj) < WALKING_CLUSTER_KM) {
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
  return `\n\nWALKING NEIGHBORS (under 1.5 km apart — schedule consecutively on the same day when possible to minimize commute and fill gaps with nearby activities):\n${lines.join('\n')}`;
}

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

function buildSchedulingPrefsBlock(prefs) {
  if (!prefs || typeof prefs !== 'object') return '';
  const breaksLabels = ['back-to-back', 'short breaks', 'moderate breaks', 'generous breaks', 'lots of downtime'];
  const breaks = Math.max(1, Math.min(5, Math.round(Number(prefs.breaksBetween) || 3)));
  const lines = [];
  if (prefs.dayStartTime && prefs.dayEndTime) {
    lines.push(`- Preferred day window: ${prefs.dayStartTime}–${prefs.dayEndTime} (already reflected in DAYS windows above; do not push to edges without reason)`);
  }
  if (prefs.tourTiming) {
    lines.push(`- Tour timing preference: ${prefs.tourTiming}${prefs.tourTiming === 'morning' ? ' (schedule tour-type activities before noon when possible)' : prefs.tourTiming === 'afternoon' ? ' (schedule tour-type activities after noon when possible)' : ''}`);
  }
  if (prefs.lunchTime) lines.push(`- Preferred lunch start: around ${prefs.lunchTime} (±90 min within the 11:00–14:30 lunch window)`);
  if (prefs.dinnerTime) lines.push(`- Preferred dinner start: around ${prefs.dinnerTime} (±90 min within the 17:00–22:00 dinner window)`);
  lines.push(`- Pacing between activities: ${breaksLabels[breaks - 1]}`);
  const notes = String(prefs.notes || '').trim();
  if (notes) lines.push(`- Additional notes from traveler: "${notes}"`);
  if (!lines.length) return '';
  return `\n\nSCHEDULING PREFERENCES (traveler-stated, treat as strong soft constraints — choose between valid placements to honor these):\n${lines.join('\n')}`;
}

const STATIC_ARRANGE_SYSTEM = `You schedule approved travel activities into a day-by-day plan with concrete start times.

PRIMARY DIRECTIVE: Place EVERY flexible activity. The traveler approved all of these — they want them in the schedule. Your default action is "place it." Only put an activity in unplaced when you cannot physically fit it given the hard constraints below.

HARD CONSTRAINTS (the only valid reasons to leave something unplaced):
1. The activity's opening_hours do not intersect any day window across the whole trip
2. Placing it would require overlapping a LOCKED activity
3. There is no remaining time slot of its duration on any day window — only after attempting placement on every day

PHYSICAL RULES (these are NOT preferences — violating them produces an invalid schedule):
- DAY WINDOW: every placement's start AND end must fall inside that day's window. If a day's window ends at 18:00, you may NOT place a 90-minute activity starting at 17:30 (it would end at 19:00). Move it to another day or to unplaced.
- OPENING HOURS END: for activities with opening_hours, start + duration must be ≤ the closing time. A venue closing at 17:00 cannot host a 90-minute activity starting at 16:00 — that ends at 17:30, past closing. Place it earlier in the day or move it.

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
- MEALS (activity.type === "meal"): place AT MOST one meal in the lunch window (11:00-14:30) and one meal in the dinner window (17:00-22:00) per day. Decide each meal's slot by checking its opening_hours — if the restaurant only opens after 17:00, it can ONLY be that day's dinner; if it closes by 17:00, it can ONLY be that day's lunch. If multiple approved meals qualify for the same slot on the same day, pick the one closest geographically to that day's other activities and move the rest to unplaced with reason "no_time_slot_remaining". Never schedule two meals in the same slot on the same day. Never schedule a meal outside both windows.
- DINNER MUST-FILL: If a day has no meal placed in the dinner window (17:00-22:00) but at least one unplaced meal-type activity has opening_hours that include any time in that window, you MUST place one of those meals there. Leaving an empty dinner slot while a compatible meal sits unplaced is a constraint violation, not a soft choice.
- COMMUTE GAPS: When two activities appear in the COMMUTE TIMES block and are scheduled on the same day, the later one's start time must be at least (previous activity's duration + commute minutes + 10 min buffer) after the earlier one's start time. Do not place activities back-to-back without leaving room for travel. For pairs not in COMMUTE TIMES (walking distance), a 10-minute gap between activity end and next activity start is sufficient.
- COMMUTE-AWARE ORDERING: use the COMMUTE TIMES and WALKING NEIGHBORS blocks to group venues that are near each other onto the same day, and order each day to minimize travel. Scattering far-apart venues across one day wastes the day in transit and pushes later activities past their closing time.
- Lunch and dinner anchor the day; non-meal activities fit between them.
- A typical full day has 4–8 activities depending on pace.
- DAY LOAD BALANCE: with N flexible activities across M days, target roughly N/M per day (within ±2). A day with 10 activities while another has 4 is poor balance — redistribute before pushing anything to unplaced. This is a strong guideline, not a physical rule: a single long tour or full-day excursion may legitimately leave a day with fewer entries.

WORKED EXAMPLE (illustrates the rules — these ids are fake, NEVER output them):
Given day 2026-01-01 (window 09:00–22:00) with:
- id:ex_a1 "Example Hilltop Shrine" | 120min | hours:08:00-17:00 | at:North end
- id:ex_a2 "Example Garden" | 90min | hours:09:00-17:00 | at:North end (near ex_a1)
- id:ex_lunch "Example Noodle Bar" | 60min | hours:11:00-15:00 | type:meal | at:North end
- id:ex_dinner "Example Izakaya" | 90min | hours:17:30-23:00 | type:meal | at:South end
- id:ex_late "Example Museum" | 90min | hours:09:00-16:00 | at:South end
COMMUTE TIMES: "Example Hilltop Shrine" ↔ "Example Izakaya": 35 min
Correct reasoning: ex_a1 and ex_a2 are both North and near each other → same morning, back-to-back. ex_lunch closes 15:00 → it is LUNCH, not dinner → 13:00. ex_dinner opens 17:30 → it is DINNER → 18:30, and the 35-min commute from the North cluster is respected (garden ends 12:00, lunch 13:00–14:00, then travel). ex_late closes 16:00 and the day is already full in the only window it fits → unplaced as no_time_slot_remaining.
Output:
{"placements":{"ex_a1":{"date":"2026-01-01","time":"09:00"},"ex_a2":{"date":"2026-01-01","time":"11:15"},"ex_lunch":{"date":"2026-01-01","time":"13:00"},"ex_dinner":{"date":"2026-01-01","time":"18:30"}},"unplaced":[{"id":"ex_late","reason":"no_time_slot_remaining"}]}

Think through the day-by-day placement before answering — especially each meal's slot from its opening_hours, and each day's travel order from the COMMUTE TIMES — then you MUST call submit_schedule with the final schedule. Do not respond in prose.`;

function buildDirectArrangePrompt({
  days,
  flexible,
  locked = [],
  profile,
  prefSummary = '',
  numTravelers,
  numChildren,
  cityName = '',
  commuteMatrix = null,
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
  const commuteText = buildCommuteBlock(commuteMatrix, flexible, locked);
  const clusterText = buildClusterBlock(flexible);

  const { desc: paceDesc } = paceDescFromValue(profile?.answers?.pace);

  const travelerBlock = `${numTravelers || 1} adult(s)${numChildren ? `, ${numChildren} child(ren)` : ''}`;
  const profileBlock = prefSummary ? `\nTRAVELER PROFILE:\n${prefSummary}\n` : '';
  const schedPrefsBlock = buildSchedulingPrefsBlock(schedulingPrefs);

  return `You are scheduling a trip${cityName ? ` in ${cityName}` : ''}. Build a day-by-day schedule with concrete start times, following the rules and the worked example in your instructions.

DAYS:
${daysText}

ACTIVITIES TO SCHEDULE:
${activitiesText}${commuteText}${clusterText}

TRAVELERS: ${travelerBlock}
PACE: ${paceDesc}${profileBlock}${schedPrefsBlock}

OUTPUT — strict JSON only:
{
  "placements": { "<id>": { "date": "YYYY-MM-DD", "time": "HH:MM" } },
  "unplaced": [ { "id": "<id>", "reason": "<one of: opening_hours_no_fit | locked_conflict | no_time_slot_remaining>" } ]
}

Every flexible activity must appear in either placements or unplaced — never both, never neither.
Never include locked ids. Times are 24-hour HH:MM.`;
}

const REPAIR_DIRECTIVES = {
  overlap: 'OVERLAPS — two activities share time on the same day. Push the later one to start after the earlier one ends (plus any commute), or move it to another day. Do not shrink either.',
  commute_gap_violation: 'COMMUTE GAPS — back-to-back activities leave no travel time. The later start must be ≥ the earlier activity\'s end + its commute minutes + 10. Push it later or move it to another day.',
  window: 'DAY WINDOW — start + duration falls outside the day window. Move the activity earlier in the day, or to another day where it fits.',
  opening_hours: 'OPENING HOURS — start + duration runs past the venue\'s closing time. Move it earlier in the day so it ends before closing, or to another day.',
  meal_outside_windows: 'MEAL SLOT — a meal sits outside both meal windows. Each meal belongs in lunch (11:00–14:30) or dinner (17:00–22:00), and the slot is decided by the venue\'s opening_hours: a venue that closes before 17:00 can only be lunch. Re-slot by hours, or move the extra to unplaced with reason "no_time_slot_remaining".',
  duplicate_meal_slot: 'DUPLICATE MEAL — two meals occupy the same slot on one day. Keep at most one lunch and one dinner per day; move the extra to unplaced with reason "no_time_slot_remaining".',
  empty_dinner_with_available_meal: 'EMPTY DINNER — a day has no dinner but an unplaced meal opens during 17:00–22:00. Place that meal into the dinner slot.',
  lock_overlap: 'LOCKED CONFLICT — a flexible activity overlaps a LOCKED anchor. Move the flexible activity off the locked time (the lock is immovable).',
  lock_lock_overlap: 'LOCKED CONFLICT — two locked anchors overlap; you cannot move locks. Leave any flexible activity that collides with them in unplaced.'
};

function buildRepairPrompt({ placements, issues, activitiesById }) {
  const placementLines = Object.entries(placements)
    .map(([id, p]) => {
      const name = activitiesById[id]?.name || id;
      return `  ${id} ("${name}"): ${p.date} ${p.time}`;
    })
    .join('\n');

  const byType = {};
  for (const i of issues) (byType[i.type] = byType[i.type] || []).push(i);
  const issueBlocks = Object.entries(byType)
    .map(([type, group]) => {
      const directive = REPAIR_DIRECTIVES[type] || type.toUpperCase();
      const lines = group.map((i) => `  - ${i.message}`).join('\n');
      return `${directive}\n${lines}`;
    })
    .join('\n\n');

  return `Your previous schedule has physical conflicts that must be fixed. Apply the directive for each issue group below — adjust times or move ids to unplaced. Do not introduce new conflicts.

CURRENT PLACEMENTS:
${placementLines}

ISSUES TO FIX:
${issueBlocks}

OUTPUT — same schema as before, strict JSON:
{"placements":{"<id>":{"date":"YYYY-MM-DD","time":"HH:MM"}},"unplaced":[{"id":"<id>","reason":"..."}]}`;
}

module.exports = { buildDirectArrangePrompt, buildRepairPrompt, STATIC_ARRANGE_SYSTEM };
