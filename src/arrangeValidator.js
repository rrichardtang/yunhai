const { MIN_BUFFER_BETWEEN } = require('./arrangeConstants');
const { inferCategory } = require('./arrangeConfig');
const { effectiveDayStart, effectiveDayEnd, getDuration } = require('./arrangeTimeAssigner');
const { minutesFromTime } = require('../shared/timeHelpers');

const MEAL_CATEGORIES = new Set(['breakfast', 'lunch', 'dinner']);
const NON_MEAL_CAP_CATEGORIES = new Set(['sightseeing', 'cultural', 'tour', 'shopping', 'nature', 'landmark', 'relaxation', 'museum', 'gallery', 'walk']);

function buildEntry(id, placement, activity) {
  const startMin = minutesFromTime(placement.time || '00:00');
  const duration = getDuration(activity);
  return { id, date: placement.date, startMin, endMin: startMin + duration, activity };
}

function overlapsWithBuffer(a, b) {
  return a.startMin < b.endMin + MIN_BUFFER_BETWEEN && b.startMin < a.endMin + MIN_BUFFER_BETWEEN;
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
            message: `${entries[i].id} and ${entries[j].id} overlap on ${date}`
          });
        }
      }
    }

    const lockEntries = lockedActivities
      .filter((l) => l.date === date)
      .map((l) => {
        const startMin = minutesFromTime(l.time || '00:00');
        return { id: l.id, startMin, endMin: startMin + (Number(l.duration_minutes) || 60) };
      });
    for (const e of entries) {
      for (const l of lockEntries) {
        if (overlapsWithBuffer(e, l)) {
          issues.push({
            type: 'lock_overlap',
            day: date,
            id: e.id,
            message: `${e.id} overlaps locked anchor ${l.id} on ${date}`
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
            message: `${e.id} outside day window on ${date}`
          });
        }
      }
    }

    const meals = { breakfast: 0, lunch: 0, dinner: 0 };
    const cats = {};
    for (const e of entries) {
      const cat = inferCategory(e.activity);
      if (MEAL_CATEGORIES.has(cat)) {
        meals[cat] += 1;
      } else if (NON_MEAL_CAP_CATEGORIES.has(cat)) {
        cats[cat] = (cats[cat] || 0) + 1;
      }
    }
    for (const [mt, n] of Object.entries(meals)) {
      if (n > 1) {
        issues.push({
          type: 'meal_cap',
          day: date,
          meal: mt,
          message: `${n} ${mt} activities on ${date} (max 1)`
        });
      }
    }
    for (const [cat, n] of Object.entries(cats)) {
      if (n > 2) {
        issues.push({
          type: 'category_cap',
          day: date,
          category: cat,
          message: `${n} ${cat} activities on ${date} (max 2)`
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

module.exports = { validate, overlapsWithBuffer };
