const SHOW_UP_EARLY_MINS = {
  tour: 15,
  attraction: 15,
  restaurant: 0,
  none: 0
};

function showUpEarlyMins(bookingType) {
  return SHOW_UP_EARLY_MINS[bookingType] ?? 0;
}

module.exports = { showUpEarlyMins };
