const { minutesFromTime, timeFromMinutes } = require('../../shared/timeHelpers');
const { showUpEarlyMins } = require('../../shared/arrangeArrivalBuffers');
const {
  parseOpeningHours,
  getDuration,
  effectiveDayStart,
  effectiveDayEnd
} = require('../arrangeValidator');
const { isMealActivity, LUNCH_WINDOW, DINNER_WINDOW } = require('../arrangeConfig');
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
      return { id: String(l.id), startMin, endMin: startMin + (Number(l.duration_minutes) || 60) };
    });
}

// Earliest valid meal start in a slot: start lands inside the slot window AND inside
// an opening-hours range with room for the full duration, ends by day end, and clears
// every obstacle. Returns null when the meal cannot fit this slot on this day.
function findSlotStart(rawHours, duration, slotWindow, dayStart, dayEnd, obstacles) {
  const [slotStart, slotEnd] = slotWindow;
  const ranges = parseOpeningHours(rawHours);
  const latestStart = slotEnd - 1;
  let t = Math.max(dayStart, slotStart);
  while (t <= latestStart) {
    const range = ranges.find(([s, e]) => t >= s && t + duration <= e);
    if (!range) {
      const next = ranges.map((r) => r[0]).filter((s) => s > t).sort((a, b) => a - b)[0];
      if (next == null || next > latestStart) return null;
      t = next;
      continue;
    }
    if (t + duration > dayEnd) return null;
    const hit = obstacles.find((o) => t < o.endMin && t + duration > o.startMin);
    if (!hit) return t;
    t = hit.endMin;
  }
  return null;
}

// Anchor each meal into a lunch or dinner slot (at most one of each per day) before
// any other activity is timed, so the commute cascade can never evict a meal from its
// window. Mutates `newPlacements` and `drops`; returns the anchored meal obstacles.
function anchorMeals({ mealEntries, activitiesById, dayStart, dayEnd, locks, date, originalPlacements, newPlacements, drops }) {
  const anchors = [];
  const usedSlots = new Set();
  mealEntries.sort((a, b) => a.llmStart - b.llmStart);
  for (const { id, llmStart } of mealEntries) {
    const activity = activitiesById[id];
    const duration = getDuration(activity);
    const rawHours = getOpeningHoursRaw(activity);
    const name = String(activity?.name || id).slice(0, 40);
    const lunchFirst = Math.abs(llmStart - LUNCH_WINDOW[0]) <= Math.abs(llmStart - DINNER_WINDOW[0]);
    const order = lunchFirst
      ? [['lunch', LUNCH_WINDOW], ['dinner', DINNER_WINDOW]]
      : [['dinner', DINNER_WINDOW], ['lunch', LUNCH_WINDOW]];

    let placed = null;
    for (const [slot, win] of order) {
      if (usedSlots.has(slot)) continue;
      const start = findSlotStart(rawHours, duration, win, dayStart, dayEnd, locks.concat(anchors));
      if (start != null) { placed = { slot, start }; break; }
    }
    if (!placed) {
      debugLog('arrange', `ADJUSTER_MEAL_DROP id=${id} name="${name}" reason=no_meal_slot hours="${rawHours || 'none'}"`);
      drops.push({ id, reason: 'no_meal_slot_on_day' });
      continue;
    }
    usedSlots.add(placed.slot);
    anchors.push({ id, startMin: placed.start, endMin: placed.start + duration });
    const newTime = timeFromMinutes(placed.start);
    newPlacements[id] = { date, time: newTime };
    debugLog('arrange', `ADJUSTER_MEAL_ANCHOR id=${id} name="${name}" slot=${placed.slot} llm=${originalPlacements[id].time} -> new=${newTime}`);
  }
  return anchors;
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
    for (const { id } of byDate[date]) newPlacements[id] = placements[id];
    debugLog('arrange', `ADJUSTER_DAY_SKIP date=${date} reason=day_not_found entries=${byDate[date].length}`);
  }

  for (const day of (days || [])) {
    const date = day.date;
    const entries = byDate[date] || [];

    const dayStart = effectiveDayStart(day);
    const dayEnd = effectiveDayEnd(day);
    const locks = buildLockedObstacles(lockedActivities, date);

    const mealEntries = entries.filter((e) => isMealActivity(activitiesById[e.id]));
    const nonMeals = entries.filter((e) => !isMealActivity(activitiesById[e.id]));

    debugLog('arrange', `ADJUSTER_DAY_START date=${date} window=${timeFromMinutes(dayStart)}-${timeFromMinutes(dayEnd)} entries=${entries.length} meals=${mealEntries.length} locked=${locks.length}`);

    const mealAnchors = anchorMeals({ mealEntries, activitiesById, dayStart, dayEnd, locks, date, originalPlacements: placements, newPlacements, drops });
    for (const m of mealEntries) {
      if (newPlacements[m.id] && placements[m.id].time !== newPlacements[m.id].time) movedCount += 1;
    }

    const obstacles = [...locks, ...mealAnchors].sort((a, b) => a.startMin - b.startMin);
    nonMeals.sort((a, b) => a.llmStart - b.llmStart);

    let prevEndMin = dayStart;
    let prevId = null;

    for (const { id, llmStart } of nonMeals) {
      const activity = activitiesById[id];
      const duration = getDuration(activity);
      const earlyMins = showUpEarlyMins(getBookingType(activity)) || 0;
      const rawHours = getOpeningHoursRaw(activity);
      const name = String(activity?.name || id).slice(0, 40);

      let earliest = Math.max(dayStart, llmStart, prevEndMin);
      let commuteApplied = 0;
      if (prevId) {
        const commute = getCommuteMin(commuteMatrix, prevId, id);
        const commutePart = commute >= MIN_COMMUTE_THRESHOLD_MIN ? commute : WALKING_FALLBACK_MIN;
        commuteApplied = commutePart + COMMUTE_BUFFER_MIN;
        earliest = Math.max(earliest, prevEndMin + commuteApplied);
      }

      let start = null;
      for (let attempt = 0; attempt <= obstacles.length; attempt += 1) {
        const window = pickActiveOpeningWindow(rawHours, earliest, dayEnd);
        if (!window) break;
        const candidate = window[0] + earlyMins;
        const end = candidate + duration;
        if (end > window[1] || end > dayEnd) break;
        const hit = obstacles.find((o) => candidate < o.endMin && end > o.startMin);
        if (!hit) { start = candidate; break; }
        earliest = hit.endMin;
      }

      if (start == null) {
        debugLog('arrange', `ADJUSTER_DROP id=${id} name="${name}" reason=no_window_at_or_after_${timeFromMinutes(earliest)} hours="${rawHours || 'none'}" day_end=${timeFromMinutes(dayEnd)}`);
        drops.push({ id, reason: 'no_time_slot_after_adjustment' });
        continue;
      }

      const end = start + duration;
      const originalTime = placements[id].time;
      const newTime = timeFromMinutes(start);
      if (originalTime !== newTime) movedCount += 1;
      debugLog('arrange', `ADJUSTER_PLACE id=${id} name="${name}" llm=${originalTime} -> new=${newTime} end=${timeFromMinutes(end)} dur=${duration} commute_buf=${commuteApplied} early=${earlyMins} prev=${prevId || 'none'}`);

      newPlacements[id] = { date, time: newTime };
      prevEndMin = end;
      prevId = id;
    }
  }

  return { placements: newPlacements, drops, moved: movedCount };
}

module.exports = { adjust };
