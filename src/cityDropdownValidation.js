function resolveDateTime(date = '', time = '') {
  const normalizedDate = String(date || '').slice(0, 10);
  if (!normalizedDate) return null;
  if (!String(time).match(/^\d{2}:\d{2}$/)) return null;
  return `${normalizedDate}T${time}:00`;
}

function validateDepartureAfterArrival({ arrival = {}, departure = {} } = {}) {
  const arrivalDateTime = resolveDateTime(arrival.date, arrival.time || arrival.customTime);
  const departureDateTime = resolveDateTime(departure.date, departure.time || departure.customTime);

  if (!arrivalDateTime || !departureDateTime) return '';
  if (new Date(departureDateTime).getTime() < new Date(arrivalDateTime).getTime()) {
    return 'Departure must be at or after arrival.';
  }
  return '';
}

module.exports = {
  resolveDateTime,
  validateDepartureAfterArrival
};
