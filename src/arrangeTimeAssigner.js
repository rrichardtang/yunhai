const { MIN_BUFFER_BETWEEN, DEFAULT_COMMUTE_MIN, MEAL_BANDS } = require('./arrangeConstants');
const { inferCategory } = require('./arrangeConfig');
const { minutesFromTime, timeFromMinutes } = require('../shared/timeHelpers');

const MEAL_CATEGORIES = new Set(['breakfast', 'lunch', 'dinner', 'cafe']);

function getDuration(activity) {
  if (activity?.timing?.duration_minutes != null) return Number(activity.timing.duration_minutes) || 60;
  if (activity?.duration_hours != null) return Math.round(Number(activity.duration_hours) * 60) || 60;
  return 60;
}

function getOpeningHoursRaw(activity) {
  return activity?.timing?.opening_hours || activity?.opening_hours || '';
}

function parseOpeningHours(raw) {
  const text = String(raw || '').trim();
  if (!text) return [[0, 1440]];
  const ranges = [];
  for (const part of text.split(/[,;]/)) {
    const m = part.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!m) continue;
    const start = toMin(m[1], m[2], m[3]);
    let end = toMin(m[4], m[5], m[6]);
    if (end <= start) end = 1440;
    ranges.push([start, end]);
  }
  return ranges.length ? ranges.sort((a, b) => a[0] - b[0]) : [[0, 1440]];
}

function toMin(h, m, ap) {
  let hour = Number(h) || 0;
  const min = Number(m) || 0;
  if (ap) {
    const lower = ap.toLowerCase();
    if (lower === 'pm' && hour < 12) hour += 12;
    if (lower === 'am' && hour === 12) hour = 0;
  }
  return hour * 60 + min;
}

function intersectRanges(a, b) {
  const out = [];
  for (const [s1, e1] of a) {
    for (const [s2, e2] of b) {
      const s = Math.max(s1, s2);
      const e = Math.min(e1, e2);
      if (e > s) out.push([s, e]);
    }
  }
  return out;
}

function effectiveOpeningWindows(activity) {
  const base = parseOpeningHours(getOpeningHoursRaw(activity));
  const cat = inferCategory(activity);
  if (MEAL_CATEGORIES.has(cat) && MEAL_BANDS[cat]) {
    const intersected = intersectRanges(base, [MEAL_BANDS[cat]]);
    return intersected.length ? intersected : base;
  }
  return base;
}

function effectiveDayStart(day) {
  const winStart = minutesFromTime(day.windowStart || '00:00');
  const arrival = day.arrivalAvailableMin != null
    ? Number(day.arrivalAvailableMin)
    : (day.arrivalAvailableTime ? minutesFromTime(day.arrivalAvailableTime) : 0);
  return Math.max(winStart, arrival);
}

function effectiveDayEnd(day) {
  const winEnd = day.windowEnd ? minutesFromTime(day.windowEnd) : 1440;
  const departure = day.departureMustLeaveMin != null
    ? Number(day.departureMustLeaveMin)
    : (day.departureMustLeaveTime ? minutesFromTime(day.departureMustLeaveTime) : 1440);
  return Math.min(winEnd, departure);
}

function bumpToWindow(t, duration, windows) {
  for (const [s, e] of windows) {
    if (t + duration <= e) return Math.max(t, s);
  }
  return null;
}

function overlaps([s1, e1], [s2, e2]) {
  return s1 < e2 && s2 < e1;
}

function findEarliestSlot(cursor, duration, windows, occupied, dayEnd) {
  let t = cursor;
  for (let guard = 0; guard < 200; guard += 1) {
    const bumped = bumpToWindow(t, duration, windows);
    if (bumped == null || bumped + duration > dayEnd) return null;
    t = bumped;
    const conflict = occupied.find((o) => overlaps([t, t + duration], [o.startMin, o.endMin]));
    if (!conflict) return t;
    t = conflict.endMin + MIN_BUFFER_BETWEEN;
  }
  return null;
}

function buildOccupiedFromLocks(date, lockedActivities) {
  return lockedActivities
    .filter((l) => l.date === date)
    .map((l) => {
      const startMin = minutesFromTime(l.time || '00:00');
      const dur = Number(l.duration_minutes) || 60;
      return { id: l.id, startMin, endMin: startMin + dur };
    })
    .sort((a, b) => a.startMin - b.startMin);
}

function assignTimes({ days, dayPlans, activitiesById, lockedActivities = [], commuteMatrix = {} }) {
  const placements = {};
  const unplaced = [];
  const lockedIds = new Set(lockedActivities.map((l) => String(l.id)));

  for (const day of days) {
    const plan = dayPlans.find((p) => p.date === day.date) || { ordered_ids: [] };
    const dayStart = effectiveDayStart(day);
    const dayEnd = effectiveDayEnd(day);
    const occupied = buildOccupiedFromLocks(day.date, lockedActivities);

    let cursor = dayStart;

    for (let i = 0; i < plan.ordered_ids.length; i += 1) {
      const id = String(plan.ordered_ids[i]);
      if (lockedIds.has(id)) continue;

      const act = activitiesById[id];
      if (!act) { unplaced.push({ id, reason: 'unknown activity id' }); continue; }

      const duration = getDuration(act);
      const windows = effectiveOpeningWindows(act);
      const start = findEarliestSlot(cursor, duration, windows, occupied, dayEnd);

      if (start == null) {
        unplaced.push({ id, reason: 'no time remaining in day window' });
        continue;
      }

      placements[id] = { date: day.date, time: timeFromMinutes(start) };
      occupied.push({ id, startMin: start, endMin: start + duration });
      occupied.sort((a, b) => a.startMin - b.startMin);

      const nextId = plan.ordered_ids[i + 1] ? String(plan.ordered_ids[i + 1]) : null;
      const commute = nextId
        ? (commuteMatrix?.[id]?.[nextId] ?? DEFAULT_COMMUTE_MIN)
        : MIN_BUFFER_BETWEEN;
      cursor = start + duration + Math.max(commute, MIN_BUFFER_BETWEEN);
    }
  }

  return { placements, unplaced };
}

module.exports = {
  assignTimes,
  effectiveDayStart,
  effectiveDayEnd,
  effectiveOpeningWindows,
  parseOpeningHours,
  findEarliestSlot,
  getDuration
};
