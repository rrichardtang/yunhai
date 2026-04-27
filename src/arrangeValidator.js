const { MIN_BUFFER_BETWEEN } = require('./arrangeConstants');
const { minutesFromTime } = require('../shared/timeHelpers');

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

function overlapsWithBuffer(a, b) {
  return a.startMin < b.endMin + MIN_BUFFER_BETWEEN && b.startMin < a.endMin + MIN_BUFFER_BETWEEN;
}

function withinAnyWindow(startMin, endMin, windows) {
  return windows.some(([s, e]) => startMin >= s && endMin <= e);
}

function validate({ placements, lockedActivities = [], days, activitiesById }) {
  const issues = [];
  const byDate = {};

  for (const [id, placement] of Object.entries(placements || {})) {
    const act = activitiesById[id];
    if (!act) continue;
    const entry = buildEntry(id, placement, act);
    if (!byDate[entry.date]) byDate[entry.date] = [];
    byDate[entry.date].push(entry);
  }

  for (const [date, entries] of Object.entries(byDate)) {
    const day = days.find((d) => d.date === date);

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        if (overlapsWithBuffer(entries[i], entries[j])) {
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
    for (const e of entries) {
      for (const l of lockEntries) {
        if (overlapsWithBuffer(e, l)) {
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
      if (!withinAnyWindow(e.startMin, e.endMin, windows)) {
        issues.push({
          type: 'opening_hours',
          day: date,
          id: e.id,
          message: `${e.id} ("${e.activity.name}") scheduled outside opening hours (${raw}) on ${date}`
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

module.exports = { validate, overlapsWithBuffer, parseOpeningHours, getDuration, effectiveDayStart, effectiveDayEnd };
