(function (root) {
  const ARRIVAL_BUFFER_MINS = {
    flight: { domestic: 70, international: 135 },
    train: 45,
    car: 35,
    other: 60
  };

  const DEPARTURE_BUFFER_MINS = {
    flight: { domestic: 120, international: 180 },
    train: 30,
    car: 15,
    other: 60
  };

  const TRANSIT_FALLBACK_MINS = {
    flight: 45, train: 20, car: 25, other: 30
  };

  function arrivalBufferMins(mode, international) {
    const v = ARRIVAL_BUFFER_MINS[mode] ?? ARRIVAL_BUFFER_MINS.other;
    return typeof v === 'number' ? v : (international ? v.international : v.domestic);
  }

  function departureBufferMins(mode, international) {
    const v = DEPARTURE_BUFFER_MINS[mode] ?? DEPARTURE_BUFFER_MINS.other;
    return typeof v === 'number' ? v : (international ? v.international : v.domestic);
  }

  const api = {
    ARRIVAL_BUFFER_MINS, DEPARTURE_BUFFER_MINS, TRANSIT_FALLBACK_MINS,
    arrivalBufferMins, departureBufferMins
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (root) Object.assign(root, api);
})(typeof window !== 'undefined' ? window : null);
