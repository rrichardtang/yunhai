const TIME_OF_DAY_PRESETS = {
  morning: '09:00',
  afternoon: '14:00',
  evening: '19:00'
};

function normalizeTimeOfDay(value = '') {
  const key = String(value || '').toLowerCase();
  if (['morning', 'afternoon', 'evening', 'custom'].includes(key)) return key;
  return 'morning';
}

function resolveDateTime(date = '', timeOfDay = 'morning', customTime = '') {
  const normalizedDate = String(date || '').slice(0, 10);
  if (!normalizedDate) return null;
  const normalized = normalizeTimeOfDay(timeOfDay);
  const time = normalized === 'custom' ? String(customTime || '') : TIME_OF_DAY_PRESETS[normalized];
  if (!String(time).match(/^\d{2}:\d{2}$/)) return null;
  return `${normalizedDate}T${time}:00`;
}

function validateDepartureAfterArrival({ arrival = {}, departure = {} } = {}) {
  const arrivalDateTime = resolveDateTime(arrival.date, arrival.timeOfDay, arrival.customTime);
  const departureDateTime = resolveDateTime(departure.date, departure.timeOfDay, departure.customTime);

  if (!arrivalDateTime || !departureDateTime) return '';
  if (new Date(departureDateTime).getTime() < new Date(arrivalDateTime).getTime()) {
    return 'Departure must be at or after arrival.';
  }
  return '';
}

module.exports = {
  TIME_OF_DAY_PRESETS,
  normalizeTimeOfDay,
  resolveDateTime,
  validateDepartureAfterArrival
};
