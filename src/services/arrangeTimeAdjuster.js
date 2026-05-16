const { minutesFromTime, timeFromMinutes } = require('../../shared/timeHelpers');
const { showUpEarlyMins } = require('../../shared/arrangeArrivalBuffers');
const {
  parseOpeningHours,
  getDuration,
  effectiveDayStart,
  effectiveDayEnd
} = require('../arrangeValidator');

const COMMUTE_BUFFER_MIN = 10;
const WALKING_FALLBACK_MIN = 10;
const MIN_COMMUTE_THRESHOLD_MIN = 15;

function getOpeningHoursRaw(activity) {
  return activity?.timing?.opening_hours || activity?.opening_hours || '';
}

function getBookingType(activity) {
  return activity?.booking?.type || activity?.booking_type || 'none';
}

function pickActiveOpeningWindow(rawHours, earliest, hardEnd) {
  const ranges = parseOpeningHours(rawHours);
  for (const [s, e] of ranges) {
    if (e <= earliest) continue;
    if (s >= hardEnd) continue;
    return [Math.max(s, earliest), Math.min(e, hardEnd)];
  }
  return null;
}

function getCommuteMin(commuteMatrix, fromId, toId) {
  const direct = Number(commuteMatrix?.[fromId]?.[toId]);
  if (Number.isFinite(direct)) return direct;
  const reverse = Number(commuteMatrix?.[toId]?.[fromId]);
  if (Number.isFinite(reverse)) return reverse;
  return WALKING_FALLBACK_MIN;
}

function buildLockedObstacles(lockedActivities, date) {
  return lockedActivities
    .filter((l) => l.date === date)
    .map((l) => {
      const startMin = minutesFromTime(l.time || '00:00');
      return {
        id: String(l.id),
        startMin,
        endMin: startMin + (Number(l.duration_minutes) || 60),
        locked: true
      };
    })
    .sort((a, b) => a.startMin - b.startMin);
}

function adjust({ placements, days, activitiesById, lockedActivities = [], commuteMatrix = {} }) {
  const newPlacements = {};
  const drops = [];
  let movedCount = 0;

  const byDate = {};
  for (const [id, p] of Object.entries(placements || {})) {
    if (!activitiesById[id]) continue;
    if (!byDate[p.date]) byDate[p.date] = [];
    byDate[p.date].push({ id, llmStart: minutesFromTime(p.time || '00:00') });
  }

  for (const [date, entries] of Object.entries(byDate)) {
    const day = (days || []).find((d) => d.date === date);
    if (!day) {
      for (const { id } of entries) {
        newPlacements[id] = placements[id];
      }
      continue;
    }

    const dayStart = effectiveDayStart(day);
    const dayEnd = effectiveDayEnd(day);
    const locked = buildLockedObstacles(lockedActivities, date);

    entries.sort((a, b) => a.llmStart - b.llmStart);

    let prevEndMin = dayStart;
    let prevId = null;
    let lockedIdx = 0;

    for (const { id, llmStart } of entries) {
      const activity = activitiesById[id];
      const duration = getDuration(activity);
      const bookingType = getBookingType(activity);
      const earlyMins = showUpEarlyMins(bookingType) || 0;

      let earliest = Math.max(dayStart, llmStart, prevEndMin);
      if (prevId) {
        const commute = getCommuteMin(commuteMatrix, prevId, id);
        const required = prevEndMin + (commute >= MIN_COMMUTE_THRESHOLD_MIN ? commute : WALKING_FALLBACK_MIN) + COMMUTE_BUFFER_MIN;
        earliest = Math.max(earliest, required);
      }

      while (lockedIdx < locked.length && locked[lockedIdx].endMin <= earliest) {
        lockedIdx += 1;
      }
      const nextLocked = locked[lockedIdx];

      const rawHours = getOpeningHoursRaw(activity);
      const window = pickActiveOpeningWindow(rawHours, earliest, dayEnd);
      if (!window) {
        drops.push({ id, reason: 'no_time_slot_after_adjustment' });
        continue;
      }
      let [winStart, winEnd] = window;

      let start = winStart + earlyMins;
      let end = start + duration;

      if (nextLocked && start < nextLocked.endMin && end > nextLocked.startMin) {
        const afterLockEarliest = Math.max(nextLocked.endMin, earliest);
        const afterWindow = pickActiveOpeningWindow(rawHours, afterLockEarliest, dayEnd);
        if (!afterWindow) {
          drops.push({ id, reason: 'no_time_slot_after_adjustment' });
          continue;
        }
        winStart = afterWindow[0];
        winEnd = afterWindow[1];
        start = winStart + earlyMins;
        end = start + duration;
      }

      if (end > winEnd || end > dayEnd) {
        drops.push({ id, reason: 'no_time_slot_after_adjustment' });
        continue;
      }

      const originalTime = placements[id].time;
      const newTime = timeFromMinutes(start);
      if (originalTime !== newTime) movedCount += 1;

      newPlacements[id] = { date, time: newTime };
      prevEndMin = end;
      prevId = id;
    }
  }

  return { placements: newPlacements, drops, moved: movedCount };
}

module.exports = { adjust };
