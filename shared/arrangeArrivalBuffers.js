(function (root) {
  const SHOW_UP_EARLY_MINS = {
    tour: 15,
    attraction: 15,
    restaurant: 0,
    none: 0
  };

  function showUpEarlyMins(bookingType) {
    return SHOW_UP_EARLY_MINS[bookingType] ?? 0;
  }

  const api = { showUpEarlyMins };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (root) Object.assign(root, api);
})(typeof window !== 'undefined' ? window : null);
