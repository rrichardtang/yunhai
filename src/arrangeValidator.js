const { MIN_BUFFER_BETWEEN } = require('./arrangeConstants');
const { effectiveDayStart, effectiveDayEnd, getDuration, parseOpeningHours } = require('./arrangeTimeAssigner');
const { minutesFromTime } = require('../shared/timeHelpers');

function getOpeningHoursRaw(activity) {
  return activity?.timing?.opening_hours || activity?.opening_hours || '';
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

module.exports = { validate, overlapsWithBuffer };
