(function (root) {
  // depends on /shared/timeHelpers.js: parseTimeTo24, minutesFromTime
  const parseTimeTo24 = (root && root.parseTimeTo24) || ((s) => String(s || ''));
  const minutesFromTime = (root && root.minutesFromTime) || (() => 0);
  const parseYmdAsLocal = (root && root.parseYmdAsLocal) || ((v) => new Date(v));
  const formatYmdLocal = (root && root.formatYmdLocal) || (() => '');

  const DAY_START_HOUR = 6;
  const DAY_END_HOUR = 26;
  const PX_PER_HOUR = 80;
  const GRID_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * PX_PER_HOUR;

  const DEFAULT_ARRANGE_CATEGORY_CONFIG = {
    arrival: { durationHours: 1, openingHours: '00:00-23:59' },
    departure: { durationHours: 1, openingHours: '00:00-23:59' },
    museum: { durationHours: 2.5, openingHours: '10:00-18:00' },
    landmark: { durationHours: 1.5, openingHours: '09:00-18:00' },
    park: { durationHours: 1.5, openingHours: '07:00-19:00' },
    neighborhood: { durationHours: 2, openingHours: '09:00-21:00' },
    market: { durationHours: 1.5, openingHours: '09:00-17:00' },
    meal: { durationHours: 1.5, openingHours: '' },
    tour: { durationHours: 2.5, openingHours: '09:00-17:00' },
    nightlife: { durationHours: 2, openingHours: '20:00-23:59' },
    shopping: { durationHours: 1.5, openingHours: '10:00-21:00' },
    sports: { durationHours: 2, openingHours: '10:00-21:00' },
    default: { durationHours: 1.5, openingHours: '09:00-18:00' }
  };

  const COMMUTE_MODE_ORDER = ['transit', 'driving', 'walking'];
  const COMMUTE_MODE_LABEL = { transit: 'Transit', driving: 'Driving', walking: 'Walking' };
  const COMMUTE_MODE_DEFAULT_ICON = { transit: '🚇', driving: '🚗', walking: '🚶' };
  const FIXED_HOUR_CATEGORIES = new Set(['meal', 'nightlife']);

  function expandDays(cities) {
    const days = [];
    cities.forEach((c) => {
      const start = parseYmdAsLocal(c.startDate);
      const end = parseYmdAsLocal(c.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push({ id: `${c.name}-${formatYmdLocal(d)}`, city: c.name, date: formatYmdLocal(d) });
      }
    });
    return days;
  }

  function daysMatchCities(days = [], cities = []) {
    const expected = expandDays(cities).map((d) => d.id).sort();
    const actual = (Array.isArray(days) ? days : []).map((d) => d?.id || `${d?.city}-${d?.date}`).sort();
    if (expected.length !== actual.length) return false;
    return expected.every((id, idx) => id === actual[idx]);
  }

  function getArrangeCategoryDefaults(category = '', config = null) {
    const merged = config || DEFAULT_ARRANGE_CATEGORY_CONFIG;
    const key = String(category || '').trim().toLowerCase();
    return merged[key] || merged.default || DEFAULT_ARRANGE_CATEGORY_CONFIG.default;
  }

  function inferActivityCategory(activity = {}, { config = null } = {}) {
    const raw = String(activity.type || '').trim().toLowerCase();
    if (raw && getArrangeCategoryDefaults(raw, config)) return raw;
    return raw || 'default';
  }

  function parseDurationHoursFromText(value = '') {
    const text = String(value || '').trim().toLowerCase();
    const match = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)/i);
    if (!match) return null;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return /^m|min/i.test(match[2]) ? (amount / 60) : amount;
  }

  function normalizeActivityMetadata(activity = {}, { config = null, preferredTime = '', durationHoursRaw = 0 } = {}) {
    const category = inferActivityCategory(activity, { config, preferredTime });
    const defaults = getArrangeCategoryDefaults(category, config);
    const parsedDuration = parseDurationHoursFromText(activity.duration);
    const durationHours = durationHoursRaw > 0 ? durationHoursRaw : (parsedDuration || defaults.durationHours || 1.5);
    const openingHours = (FIXED_HOUR_CATEGORIES.has(category)
      ? defaults.openingHours
      : String(activity.opening_hours || activity.openingHours || defaults.openingHours || '').trim());
    return {
      ...activity,
      category,
      duration_hours: durationHours,
      duration: String(activity.duration || `${durationHours} hours`).trim(),
      opening_hours: openingHours
    };
  }

  function parseOpeningWindows(openingHours = '') {
    const text = String(openingHours || '').trim();
    if (!text) return [[0, (24 * 60) - 1]];
    return text.split(',').map((segment) => {
      const match = segment.trim().match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)[\s-]+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (!match) return null;
      return [minutesFromTime(parseTimeTo24(match[1])), minutesFromTime(parseTimeTo24(match[2]))];
    }).filter((window) => Array.isArray(window) && window[1] > window[0]);
  }

  function formatDuration(hours = 1) {
    return `${Number(hours || 1)}h`;
  }

  function formatDurationHoursLong(hours = 1) {
    const value = Number(hours || 1);
    const safe = Number.isFinite(value) ? value : 1;
    return `${safe % 1 === 0 ? safe.toFixed(0) : safe.toFixed(1)} hours`;
  }

  function formatTypeLabel(type = '') {
    const normalized = String(type || '').trim().toLowerCase();
    if (!normalized) return 'Activity';
    return normalized.split(/[\s_-]+/).filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  function commutePairKey(fromId, toId) {
    return `${fromId}->${toId}`;
  }

  function hasValidDuration(modeEntry) {
    const d = Number(modeEntry?.durationMinutes);
    return Number.isFinite(d) && d > 0;
  }

  function resolveSelectedCommuteMode(commute) {
    if (!commute || typeof commute !== 'object') return null;
    const userSelected = commute.selectedMode && hasValidDuration(commute.modes?.[commute.selectedMode])
      ? commute.selectedMode
      : null;
    const fallback = COMMUTE_MODE_ORDER.find((mode) => hasValidDuration(commute.modes?.[mode]));
    return userSelected || fallback || null;
  }

  function resolveSelectedCommuteDetails(commute) {
    if (!commute) return null;
    const selectedMode = resolveSelectedCommuteMode(commute);
    if (!selectedMode) return null;
    const selected = commute.modes?.[selectedMode] || {};
    const dur = Number(selected.durationMinutes);
    if (!Number.isFinite(dur) || dur <= 0) return null;
    const modeIcon = selected.modeIcon || COMMUTE_MODE_DEFAULT_ICON[selectedMode] || '🚇';
    return { selectedMode, durationMinutes: dur, modeIcon };
  }

  function formatCommuteBadge(commute) {
    if (commute && commute.isWalkingDistance) return '🚶 walk';
    const selected = resolveSelectedCommuteDetails(commute);
    if (!selected || !Number.isFinite(selected.durationMinutes)) return '';
    return `${selected.modeIcon} ${selected.durationMinutes} min`;
  }

  function normalizeCommuteStateMap(commuteMap = {}) {
    const normalized = {};
    Object.entries(commuteMap || {}).forEach(([key, commute]) => {
      if (!commute || typeof commute !== 'object') return;
      const modes = commute.modes && typeof commute.modes === 'object'
        ? commute.modes
        : {
          transit: commute.mode === 'transit' ? { durationMinutes: commute.durationMinutes, modeIcon: commute.modeIcon || '🚇' } : { durationMinutes: null, modeIcon: '🚇' },
          driving: commute.mode === 'driving' ? { durationMinutes: commute.durationMinutes, modeIcon: commute.modeIcon || '🚗' } : { durationMinutes: null, modeIcon: '🚗' },
          walking: commute.mode === 'walking' ? { durationMinutes: commute.durationMinutes, modeIcon: commute.modeIcon || '🚶' } : { durationMinutes: null, modeIcon: '🚶' }
        };
      const selectedMode = resolveSelectedCommuteMode({ ...commute, modes });
      const selected = modes[selectedMode] || {};
      normalized[key] = {
        ...commute,
        modes,
        selectedMode,
        durationMinutes: Number.isFinite(Number(selected.durationMinutes)) ? Number(selected.durationMinutes) : null,
        modeIcon: selected.modeIcon || '🚇'
      };
    });
    return normalized;
  }

  function timeFromY(yPx = 0) {
    const clamped = Math.max(0, Math.min(GRID_HEIGHT, yPx));
    const minsFromStart = Math.round(clamped / 30) * 30;
    const totalMins = (DAY_START_HOUR * 60) + minsFromStart;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function yFromTime(time = '09:00') {
    const mins = minutesFromTime(time);
    const start = DAY_START_HOUR * 60;
    const end = DAY_END_HOUR * 60;
    const clamped = Math.max(start, Math.min(end, mins));
    return ((clamped - start) / 60) * PX_PER_HOUR;
  }

  function rangesOverlap(a, b) {
    return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
  }

  function citySlug(cityName) {
    return String(cityName || '').trim().toLowerCase().replace(/\s+/g, '-');
  }

  const logisticsArrivalId = (city) => `logistics-arrival-${citySlug(city)}`;
  const logisticsDepartureId = (city) => `logistics-departure-${citySlug(city)}`;
  const logisticsAccommodationArrivalId = (city) => `logistics-acc-arrival-${citySlug(city)}`;
  const logisticsAccommodationDepartureId = (city) => `logistics-acc-departure-${citySlug(city)}`;

  const api = {
    DAY_START_HOUR, DAY_END_HOUR, PX_PER_HOUR, GRID_HEIGHT,
    DEFAULT_ARRANGE_CATEGORY_CONFIG,
    COMMUTE_MODE_ORDER, COMMUTE_MODE_LABEL,
    expandDays, daysMatchCities,
    getArrangeCategoryDefaults, inferActivityCategory,
    parseDurationHoursFromText, normalizeActivityMetadata,
    parseOpeningWindows, formatDuration, formatDurationHoursLong, formatTypeLabel,
    commutePairKey, resolveSelectedCommuteMode, resolveSelectedCommuteDetails,
    formatCommuteBadge, normalizeCommuteStateMap,
    timeFromY, yFromTime, rangesOverlap,
    citySlug, logisticsArrivalId, logisticsDepartureId,
    logisticsAccommodationArrivalId, logisticsAccommodationDepartureId
  };

  if (root) {
    root.TravelPlannerArrangeView = api;
    Object.assign(root, api);
  }
})(typeof window !== 'undefined' ? window : null);
