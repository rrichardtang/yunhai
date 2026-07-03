const { minutesFromTime, timeFromMinutes } = require('../shared/timeHelpers');
const { isMealActivity, LUNCH_WINDOW, DINNER_WINDOW, COMMUTE_BUFFER_MIN } = require('./arrangeConfig');

function getDuration(activity) {
  if (activity?.timing?.duration_minutes != null) return Number(activity.timing.duration_minutes) || 60;
  if (activity?.duration_hours != null) return Math.round(Number(activity.duration_hours) * 60) || 60;
  return 60;
}

function getOpeningHoursRaw(activity) {
  return activity?.timing?.opening_hours || activity?.opening_hours || '';
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

function buildEntry(id, placement, activity) {
  const startMin = minutesFromTime(placement.time || '00:00');
  const duration = getDuration(activity);
  return { id, date: placement.date, startMin, endMin: startMin + duration, activity };
}

function overlaps(a, b) {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function startsWithinAnyWindow(startMin, windows) {
  return windows.some(([s, e]) => startMin >= s && startMin < e);
}

function parseOpeningHoursContains(raw, windowStart, windowEnd) {
  const ranges = parseOpeningHours(raw);
  return ranges.some(([s, e]) => s < windowEnd && e > windowStart);
}

function mealSlotCapability(activity) {
  const raw = getOpeningHoursRaw(activity);
  if (!raw) return { lunch: true, dinner: true };
  return {
    lunch: parseOpeningHoursContains(raw, LUNCH_WINDOW[0], LUNCH_WINDOW[1]),
    dinner: parseOpeningHoursContains(raw, DINNER_WINDOW[0], DINNER_WINDOW[1])
  };
}

function validate({ placements, lockedActivities = [], days, activitiesById, commuteMatrix = null, unplacedIds = [] }) {
  const issues = [];
  const byDate = {};

  for (const [id, placement] of Object.entries(placements || {})) {
    const act = activitiesById[id];
    if (!act) continue;
    const entry = buildEntry(id, placement, act);
    if (!byDate[entry.date]) byDate[entry.date] = [];
    byDate[entry.date].push(entry);
  }

  const dateList = Array.isArray(days) && days.length
    ? days.map((d) => d.date)
    : Object.keys(byDate);

  for (const date of dateList) {
    const entries = byDate[date] || [];
    const day = (days || []).find((d) => d.date === date);

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        if (overlaps(entries[i], entries[j])) {
          issues.push({
            type: 'overlap',
            day: date,
            ids: [entries[i].id, entries[j].id],
            message: `${entries[i].id} ("${entries[i].activity.name}") overlaps ${entries[j].id} ("${entries[j].activity.name}") on ${date}`
          });
        }
      }
    }

    const lockEntries = lockedActivities
      .filter((l) => l.date === date)
      .map((l) => {
        const startMin = minutesFromTime(l.time || '00:00');
        return { id: l.id, name: l.name, startMin, endMin: startMin + (Number(l.duration_minutes) || 60) };
      });
    for (let i = 0; i < lockEntries.length; i += 1) {
      for (let j = i + 1; j < lockEntries.length; j += 1) {
        if (overlaps(lockEntries[i], lockEntries[j])) {
          issues.push({
            type: 'lock_lock_overlap',
            day: date,
            ids: [lockEntries[i].id, lockEntries[j].id],
            message: `Locked anchor "${lockEntries[i].name}" overlaps locked anchor "${lockEntries[j].name}" on ${date}`
          });
        }
      }
    }
    for (const e of entries) {
      for (const l of lockEntries) {
        if (overlaps(e, l)) {
          issues.push({
            type: 'lock_overlap',
            day: date,
            id: e.id,
            message: `${e.id} ("${e.activity.name}") overlaps locked anchor "${l.name}" on ${date}`
          });
        }
      }
    }

    if (day) {
      const dayStart = effectiveDayStart(day);
      const dayEnd = effectiveDayEnd(day);
      for (const e of entries) {
        if (e.startMin < dayStart || e.endMin > dayEnd) {
          issues.push({
            type: 'window',
            day: date,
            id: e.id,
            message: `${e.id} ("${e.activity.name}") is outside day window on ${date}`
          });
        }
      }
    }

    for (const e of entries) {
      const raw = getOpeningHoursRaw(e.activity);
      if (!raw) continue;
      const windows = parseOpeningHours(raw);
      if (!startsWithinAnyWindow(e.startMin, windows)) {
        issues.push({
          type: 'opening_hours',
          day: date,
          id: e.id,
          message: `${e.id} ("${e.activity.name}") scheduled outside opening hours (${raw}) on ${date}`
        });
      }
    }

    const slotsUsed = { lunch: [], dinner: [] };
    for (const e of entries) {
      if (!isMealActivity(e.activity)) continue;
      const inLunch = e.startMin >= LUNCH_WINDOW[0] && e.startMin < LUNCH_WINDOW[1];
      const inDinner = e.startMin >= DINNER_WINDOW[0] && e.startMin < DINNER_WINDOW[1];
      const slot = inDinner ? 'dinner' : inLunch ? 'lunch' : null;
      if (!slot) {
        issues.push({
          type: 'meal_outside_windows',
          day: date,
          id: e.id,
          message: `${e.id} ("${e.activity.name}") meal scheduled outside lunch (${timeFromMinutes(LUNCH_WINDOW[0])}-${timeFromMinutes(LUNCH_WINDOW[1])}) or dinner (${timeFromMinutes(DINNER_WINDOW[0])}-${timeFromMinutes(DINNER_WINDOW[1])}) windows on ${date}`
        });
        continue;
      }
      slotsUsed[slot].push(e.id);
      if (slotsUsed[slot].length > 1) {
        issues.push({
          type: 'duplicate_meal_slot',
          day: date,
          id: e.id,
          message: `${e.id} ("${e.activity.name}") is a second ${slot} on ${date}`
        });
      }
    }

    if (commuteMatrix && typeof commuteMatrix === 'object') {
      const sorted = [...entries].sort((a, b) => a.startMin - b.startMin);
      for (let i = 0; i < sorted.length - 1; i += 1) {
        const prev = sorted[i];
        const next = sorted[i + 1];
        const commute = Number(commuteMatrix?.[prev.id]?.[next.id] ?? commuteMatrix?.[next.id]?.[prev.id]);
        if (!Number.isFinite(commute) || commute < 1) continue;
        const required = prev.endMin + commute + COMMUTE_BUFFER_MIN;
        if (next.startMin < required) {
          issues.push({
            type: 'commute_gap_violation',
            day: date,
            ids: [prev.id, next.id],
            message: `${prev.id} ("${prev.activity.name}") to ${next.id} ("${next.activity.name}") needs at least ${commute}+${COMMUTE_BUFFER_MIN} min between end and next start on ${date}`
          });
        }
      }
    }

    const lockedDinner = lockedActivities.some((l) => l.date === date && isMealActivity(l)
      && minutesFromTime(l.time || '00:00') >= DINNER_WINDOW[0]);
    const dayReachesDinner = day
      && effectiveDayStart(day) < DINNER_WINDOW[1]
      && effectiveDayEnd(day) > DINNER_WINDOW[0];
    if (slotsUsed.dinner.length === 0 && !lockedDinner && dayReachesDinner
      && Array.isArray(unplacedIds) && unplacedIds.length) {
      for (const uid of unplacedIds) {
        const act = activitiesById[uid];
        if (!act || !isMealActivity(act)) continue;
        if (!mealSlotCapability(act).dinner) continue;
        issues.push({
          type: 'empty_dinner_with_available_meal',
          day: date,
          id: uid,
          message: `Dinner slot empty on ${date} but unplaced meal ${uid} ("${act.name}") opens during ${timeFromMinutes(DINNER_WINDOW[0])}-${timeFromMinutes(DINNER_WINDOW[1])} — place it`
        });
        break;
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

module.exports = {
  validate,
  overlaps,
  parseOpeningHours,
  parseOpeningHoursContains,
  mealSlotCapability,
  getOpeningHoursRaw,
  getDuration,
  effectiveDayStart,
  effectiveDayEnd
};
