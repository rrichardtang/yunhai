const { minutesFromTime, timeFromMinutes } = require('../../shared/timeHelpers');
const { showUpEarlyMins } = require('../../shared/arrangeArrivalBuffers');
const {
  parseOpeningHours,
  getDuration,
  effectiveDayStart,
  effectiveDayEnd
} = require('../arrangeValidator');
const { debugLog } = require('./debugLog');

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

  const orphanDates = Object.keys(byDate).filter((date) => !(days || []).some((d) => d.date === date));
  for (const date of orphanDates) {
    for (const { id } of byDate[date]) {
      newPlacements[id] = placements[id];
    }
    debugLog('arrange', `ADJUSTER_DAY_SKIP date=${date} reason=day_not_found entries=${byDate[date].length}`);
  }

  for (const day of (days || [])) {
    const date = day.date;
    const entries = byDate[date] || [];

    const dayStart = effectiveDayStart(day);
    const dayEnd = effectiveDayEnd(day);
    const locked = buildLockedObstacles(lockedActivities, date);

    entries.sort((a, b) => a.llmStart - b.llmStart);
    debugLog('arrange', `ADJUSTER_DAY_START date=${date} window=${timeFromMinutes(dayStart)}-${timeFromMinutes(dayEnd)} entries=${entries.length} locked=${locked.length} order=[${entries.map((e) => `${e.id}@${timeFromMinutes(e.llmStart)}`).join(',')}]`);

    let prevEndMin = dayStart;
    let prevId = null;
    let lockedIdx = 0;

    for (const { id, llmStart } of entries) {
      const activity = activitiesById[id];
      const duration = getDuration(activity);
      const bookingType = getBookingType(activity);
      const earlyMins = showUpEarlyMins(bookingType) || 0;
      const name = String(activity?.name || id).slice(0, 40);

      let earliest = Math.max(dayStart, llmStart, prevEndMin);
      let commuteApplied = 0;
      if (prevId) {
        const commute = getCommuteMin(commuteMatrix, prevId, id);
        const commutePart = commute >= MIN_COMMUTE_THRESHOLD_MIN ? commute : WALKING_FALLBACK_MIN;
        const required = prevEndMin + commutePart + COMMUTE_BUFFER_MIN;
        commuteApplied = commutePart + COMMUTE_BUFFER_MIN;
        earliest = Math.max(earliest, required);
      }

      while (lockedIdx < locked.length && locked[lockedIdx].endMin <= earliest) {
        lockedIdx += 1;
      }
      const nextLocked = locked[lockedIdx];

      const rawHours = getOpeningHoursRaw(activity);
      const window = pickActiveOpeningWindow(rawHours, earliest, dayEnd);
      if (!window) {
        debugLog('arrange', `ADJUSTER_DROP id=${id} name="${name}" reason=no_window_at_or_after_${timeFromMinutes(earliest)} hours="${rawHours || 'none'}" day_end=${timeFromMinutes(dayEnd)}`);
        drops.push({ id, reason: 'no_time_slot_after_adjustment' });
        continue;
      }
      let [winStart, winEnd] = window;

      let start = winStart + earlyMins;
      let end = start + duration;
      let pushedPastLock = false;

      if (nextLocked && start < nextLocked.endMin && end > nextLocked.startMin) {
        const afterLockEarliest = Math.max(nextLocked.endMin, earliest);
        const afterWindow = pickActiveOpeningWindow(rawHours, afterLockEarliest, dayEnd);
        if (!afterWindow) {
          debugLog('arrange', `ADJUSTER_DROP id=${id} name="${name}" reason=no_window_past_lock lock=${timeFromMinutes(nextLocked.startMin)}-${timeFromMinutes(nextLocked.endMin)}`);
          drops.push({ id, reason: 'no_time_slot_after_adjustment' });
          continue;
        }
        winStart = afterWindow[0];
        winEnd = afterWindow[1];
        start = winStart + earlyMins;
        end = start + duration;
        pushedPastLock = true;
      }

      if (end > winEnd || end > dayEnd) {
        debugLog('arrange', `ADJUSTER_DROP id=${id} name="${name}" reason=end_exceeds_window start=${timeFromMinutes(start)} end=${timeFromMinutes(end)} win_end=${timeFromMinutes(winEnd)} day_end=${timeFromMinutes(dayEnd)} duration=${duration}`);
        drops.push({ id, reason: 'no_time_slot_after_adjustment' });
        continue;
      }

      const originalTime = placements[id].time;
      const newTime = timeFromMinutes(start);
      if (originalTime !== newTime) movedCount += 1;

      debugLog('arrange', `ADJUSTER_PLACE id=${id} name="${name}" llm=${originalTime} -> new=${newTime} end=${timeFromMinutes(end)} dur=${duration} commute_buf=${commuteApplied} early=${earlyMins} prev=${prevId || 'none'}${pushedPastLock ? ' pushed_past_lock' : ''}`);

      newPlacements[id] = { date, time: newTime };
      prevEndMin = end;
      prevId = id;
    }
  }

  return { placements: newPlacements, drops, moved: movedCount };
}

module.exports = { adjust };
