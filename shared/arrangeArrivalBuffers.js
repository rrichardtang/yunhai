const SHOW_UP_EARLY_MINS = {
  tour: 15,
  attraction: 15,
  restaurant: 0,
  none: 0
};

function showUpEarlyMins(bookingType) {
  return SHOW_UP_EARLY_MINS[bookingType] ?? 0;
}

const _exports = { showUpEarlyMins };

if (typeof module !== 'undefined' && module.exports) module.exports = _exports;
else if (typeof window !== 'undefined') Object.assign(window, _exports);
