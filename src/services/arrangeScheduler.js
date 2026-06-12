const { minutesFromTime, timeFromMinutes } = require('../../shared/timeHelpers');
const { showUpEarlyMins } = require('../../shared/arrangeArrivalBuffers');
const {
  parseOpeningHours,
  parseOpeningHoursContains,
  getDuration,
  effectiveDayStart,
  effectiveDayEnd,
  validate
} = require('../arrangeValidator');
const { isMealActivity, LUNCH_WINDOW, DINNER_WINDOW } = require('../arrangeConfig');
const { activityCoords, haversineKm } = require('./geo');
const { debugLog } = require('./debugLog');

const COMMUTE_BUFFER_MIN = 10;
const WALKING_FALLBACK_MIN = 10;
const MIN_COMMUTE_THRESHOLD_MIN = 15;
const BRUTE_FORCE_MAX = 7;

function getOpeningHoursRaw(activity) {
  return activity?.timing?.opening_hours || activity?.opening_hours || '';
}

function getBookingType(activity) {
  return activity?.booking?.type || activity?.booking_type || 'none';
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

// Classify a locked meal into the slot it occupies by its locked start time, so
// flexible meals don't double up (e.g. a locked 7pm dinner blocks the dinner slot).
function lockedMealSlot(timeMin) {
  if (timeMin >= DINNER_WINDOW[0]) return 'dinner';
  if (timeMin >= LUNCH_WINDOW[0]) return 'lunch';
  return null;
}

function lockedMealSlotsByDate(lockedActivities) {
  const byDate = {};
  for (const l of lockedActivities) {
    if (!isMealActivity(l)) continue;
    const slot = lockedMealSlot(minutesFromTime(l.time || '00:00'));
    if (!slot) continue;
    (byDate[l.date] = byDate[l.date] || new Set()).add(slot);
  }
  return byDate;
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

// Earliest valid meal start in a slot: start inside the slot window AND inside an
// opening-hours range with room for the full duration, ends by day end, clears obstacles.
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

function mealSlotCapability(activity) {
  const raw = getOpeningHoursRaw(activity);
  if (!raw) return { lunch: true, dinner: true };
  return {
    lunch: parseOpeningHoursContains(raw, LUNCH_WINDOW[0], LUNCH_WINDOW[1]),
    dinner: parseOpeningHoursContains(raw, DINNER_WINDOW[0], DINNER_WINDOW[1])
  };
}

function isSingleSlot(cap) {
  return cap.lunch !== cap.dinner;
}

// Move surplus meals off over-subscribed days (a day holds at most one lunch + one
// dinner) onto days with a free compatible slot, nearest by geography. Deterministic.
function redistributeMeals(byDate, days, activitiesById, lockedSlots = {}) {
  const dateList = days.map((d) => d.date);
  const slots = {};
  for (const date of dateList) {
    const locked = lockedSlots[date];
    slots[date] = {
      lunch: locked?.has('lunch') ? '__locked__' : null,
      dinner: locked?.has('dinner') ? '__locked__' : null
    };
  }
  const floaters = [];

  for (const date of dateList) {
    const meals = (byDate[date] || []).filter((id) => isMealActivity(activitiesById[id]));
    const withCap = meals.map((id) => ({ id, cap: mealSlotCapability(activitiesById[id]) }));
    // Single-capability meals claim their forced slot first.
    withCap.sort((a, b) => (isSingleSlot(a.cap) ? 0 : 1) - (isSingleSlot(b.cap) ? 0 : 1) || (a.id < b.id ? -1 : 1));
    for (const { id, cap } of withCap) {
      if (cap.dinner && !cap.lunch) {
        if (!slots[date].dinner) slots[date].dinner = id; else floaters.push({ id, fromDate: date, cap });
      } else if (cap.lunch && !cap.dinner) {
        if (!slots[date].lunch) slots[date].lunch = id; else floaters.push({ id, fromDate: date, cap });
      } else if (!slots[date].lunch) {
        slots[date].lunch = id;
      } else if (!slots[date].dinner) {
        slots[date].dinner = id;
      } else {
        floaters.push({ id, fromDate: date, cap });
      }
    }
  }

  floaters.sort((a, b) => (a.fromDate < b.fromDate ? -1 : a.fromDate > b.fromDate ? 1 : (a.id < b.id ? -1 : 1)));
  let moved = 0;
  for (const f of floaters) {
    const candidates = dateList.filter((date) => date !== f.fromDate
      && ((f.cap.dinner && !slots[date].dinner) || (f.cap.lunch && !slots[date].lunch)));
    if (!candidates.length) continue; // genuine over-subscription — anchoring will drop it
    const target = nearestDay(f.id, candidates, byDate, activitiesById);
    // Prefer filling an empty dinner (scarcer) when the meal can take it.
    if (f.cap.dinner && !slots[target].dinner) slots[target].dinner = f.id;
    else slots[target].lunch = f.id;
    byDate[f.fromDate] = byDate[f.fromDate].filter((x) => x !== f.id);
    byDate[target] = [...(byDate[target] || []), f.id];
    moved += 1;
  }
  return moved;
}

function nearestDay(mealId, candidateDates, byDate, activitiesById) {
  const mc = activityCoords(activitiesById[mealId]);
  const sorted = candidateDates.slice().sort();
  if (!mc) return sorted[0];
  let best = null;
  let bestD = Infinity;
  for (const date of sorted) {
    const others = (byDate[date] || []).map((id) => activityCoords(activitiesById[id])).filter(Boolean);
    const d = others.length ? Math.min(...others.map((o) => haversineKm(mc.lat, mc.lng, o.lat, o.lng))) : Infinity;
    if (d < bestD) { bestD = d; best = date; }
  }
  return best || sorted[0];
}

// Anchor at most one lunch + one dinner meal by opening hours, before non-meals.
function anchorMeals(mealIds, { activitiesById, dayStart, dayEnd, locks, lockedSlots }) {
  const placed = {};
  const anchors = [];
  const dropped = [];
  const usedSlots = new Set(lockedSlots || []);
  const sorted = mealIds.slice().sort((a, b) => {
    const sa = isSingleSlot(mealSlotCapability(activitiesById[a])) ? 0 : 1;
    const sb = isSingleSlot(mealSlotCapability(activitiesById[b])) ? 0 : 1;
    return sa - sb || (a < b ? -1 : 1);
  });
  for (const id of sorted) {
    const activity = activitiesById[id];
    const duration = getDuration(activity);
    const rawHours = getOpeningHoursRaw(activity);
    const cap = mealSlotCapability(activity);
    const order = cap.dinner && !cap.lunch
      ? [['dinner', DINNER_WINDOW]]
      : cap.lunch && !cap.dinner
        ? [['lunch', LUNCH_WINDOW]]
        : [['lunch', LUNCH_WINDOW], ['dinner', DINNER_WINDOW]];
    let chosen = null;
    for (const [slot, win] of order) {
      if (usedSlots.has(slot)) continue;
      const start = findSlotStart(rawHours, duration, win, dayStart, dayEnd, locks.concat(anchors));
      if (start != null) { chosen = { slot, start }; break; }
    }
    if (!chosen) { dropped.push(id); continue; }
    usedSlots.add(chosen.slot);
    anchors.push({ id, startMin: chosen.start, endMin: chosen.start + duration });
    placed[id] = chosen.start;
  }
  return { placed, anchors, dropped };
}

// Place non-meals in the given order, routing around obstacles (locks + meal anchors),
// respecting opening hours, commute gaps, and arrival buffers. Pure — used as the scorer.
function placeNonMeals(orderedIds, { activitiesById, dayStart, dayEnd, obstacles, commuteMatrix }) {
  const placed = {};
  const dropped = [];
  let prevEndMin = dayStart;
  let prevId = null;
  let travel = 0;
  for (const id of orderedIds) {
    const activity = activitiesById[id];
    const duration = getDuration(activity);
    const earlyMins = showUpEarlyMins(getBookingType(activity)) || 0;
    const rawHours = getOpeningHoursRaw(activity);

    let earliest = Math.max(dayStart, prevEndMin);
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

    if (start == null) { dropped.push(id); continue; }
    placed[id] = start;
    if (prevId) travel += commuteApplied;
    prevEndMin = start + duration;
    prevId = id;
  }
  return { placed, dropped, travel };
}

function* permutations(arr) {
  if (arr.length <= 1) { yield arr.slice(); return; }
  for (let i = 0; i < arr.length; i += 1) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) yield [arr[i], ...p];
  }
}

function nearestNeighborOrder(ids, ctx) {
  const remaining = ids.slice().sort((a, b) => {
    const oa = parseOpeningHours(getOpeningHoursRaw(ctx.activitiesById[a]))[0][0];
    const ob = parseOpeningHours(getOpeningHoursRaw(ctx.activitiesById[b]))[0][0];
    return oa - ob || (a < b ? -1 : 1);
  });
  const order = [remaining.shift()];
  while (remaining.length) {
    const last = order[order.length - 1];
    remaining.sort((a, b) => getCommuteMin(ctx.commuteMatrix, last, a) - getCommuteMin(ctx.commuteMatrix, last, b) || (a < b ? -1 : 1));
    order.push(remaining.shift());
  }
  return order;
}

// Choose the non-meal visit order that places the most activities with least travel.
// For small days the scorer IS the placer (brute-force), so the winner is provably best.
function orderNonMeals(ids, ctx) {
  if (ids.length <= 1) return ids.slice();
  if (ids.length > BRUTE_FORCE_MAX) return nearestNeighborOrder(ids, ctx);
  const seed = ids.slice().sort();
  let best = null;
  let bestPlaced = -1;
  let bestTravel = Infinity;
  for (const perm of permutations(seed)) {
    const r = placeNonMeals(perm, ctx);
    const placedCount = Object.keys(r.placed).length;
    if (placedCount > bestPlaced || (placedCount === bestPlaced && r.travel < bestTravel)) {
      best = perm;
      bestPlaced = placedCount;
      bestTravel = r.travel;
    }
  }
  return best;
}

function schedule({ assignment, days, activitiesById, lockedActivities = [], commuteMatrix = {} }) {
  const placements = {};
  const unplaced = [];
  const diagnostics = [];

  const validDates = new Set((days || []).map((d) => d.date));
  const byDate = {};
  for (const [date, ids] of Object.entries(assignment || {})) {
    const known = (ids || []).map(String).filter((id) => activitiesById[id]);
    if (!validDates.has(date)) {
      for (const id of known) unplaced.push({ id, reason: 'day_not_found' });
      continue;
    }
    byDate[date] = (byDate[date] || []).concat(known);
  }

  const lockedSlots = lockedMealSlotsByDate(lockedActivities);
  const mealRedistributed = redistributeMeals(byDate, days, activitiesById, lockedSlots);

  for (const day of (days || [])) {
    const date = day.date;
    const ids = byDate[date] || [];
    const dayStart = effectiveDayStart(day);
    const dayEnd = effectiveDayEnd(day);
    const locks = buildLockedObstacles(lockedActivities, date);
    const mealIds = ids.filter((id) => isMealActivity(activitiesById[id]));
    const nonMealIds = ids.filter((id) => !isMealActivity(activitiesById[id]));

    const meal = anchorMeals(mealIds, { activitiesById, dayStart, dayEnd, locks, lockedSlots: lockedSlots[date] });
    for (const id of meal.dropped) unplaced.push({ id, reason: 'no_meal_slot_on_day' });

    const obstacles = [...locks, ...meal.anchors].sort((a, b) => a.startMin - b.startMin);
    const ctx = { activitiesById, dayStart, dayEnd, obstacles, commuteMatrix };
    const order = orderNonMeals(nonMealIds, ctx);
    const nonMeal = placeNonMeals(order, ctx);
    for (const id of nonMeal.dropped) unplaced.push({ id, reason: 'no_time_slot_remaining' });

    for (const [id, startMin] of Object.entries(meal.placed)) placements[id] = { date, time: timeFromMinutes(startMin) };
    for (const [id, startMin] of Object.entries(nonMeal.placed)) placements[id] = { date, time: timeFromMinutes(startMin) };

    debugLog('arrange', `SCHED_DAY date=${date} window=${timeFromMinutes(dayStart)}-${timeFromMinutes(dayEnd)} meals=${mealIds.length} placed_meals=${Object.keys(meal.placed).length} nonmeals=${nonMealIds.length} placed_nonmeals=${Object.keys(nonMeal.placed).length}`);
  }

  const placedIds = new Set(Object.keys(placements));
  const seen = new Set();
  const finalUnplaced = [];
  for (const u of unplaced) {
    if (placedIds.has(u.id) || seen.has(u.id)) continue;
    seen.add(u.id);
    finalUnplaced.push(u);
  }

  const v = validate({ placements, lockedActivities, days, activitiesById, commuteMatrix, unplacedIds: finalUnplaced.map((u) => u.id) });
  if (!v.ok) {
    for (const issue of v.issues) diagnostics.push(issue.message);
    debugLog('arrange', `SCHED_ASSERT_FAIL count=${v.issues.length} types=${v.issues.map((i) => i.type).join(',')}`);
  }

  return { placements, unplaced: finalUnplaced, diagnostics, mealRedistributed };
}

module.exports = { schedule };
