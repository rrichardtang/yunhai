(function (root) {
  // The fields the planner actually consumes. This is both the request payload planTrip sends and
  // the definition of what counts as a change worth regenerating for. Anything omitted here — id,
  // detailsExpanded, any future UI flag — must never cost the user their activities.
  function cityPlanningInputs({ name, startDate, endDate, leaveTime, notes, accommodation, travelEntry, logistics, latitude, longitude }) {
    return {
      name,
      startDate,
      endDate,
      leaveTime,
      notes,
      // Validated before planning, and the server's only location anchor when no
      // accommodation address has been entered yet.
      latitude,
      longitude,
      logistics: logistics ? JSON.parse(JSON.stringify(logistics)) : null,
      accommodation: accommodation ? { ...accommodation } : null,
      travelEntry: travelEntry ? { ...travelEntry } : null
    };
  }

  // Which cities changed between the planned snapshot and the current one.
  //
  // Matching is by city id, not name: a trip may visit the same city twice, and keying a lookup on
  // name silently collapses those legs — the first one then never matches and reports as changed
  // forever, on a trip nobody edited.
  //
  // Returning every name is the "regenerate everything is the only coherent answer" signal, used
  // when a trip-level input moved, when a city was removed (its activities are orphaned and the
  // user needs to be told), or when identity is unavailable to match on. That set spans both
  // snapshots: removing the last city leaves no current names, and an empty result is the caller's
  // "nothing changed" signal — it would wave the orphaned activities through without a prompt.
  function changedCityNames(planned, current) {
    const currentNames = current.cities.map((c) => c.name);
    if (!planned) return currentNames;

    const plannedCities = planned.cities || [];
    const wholeTrip = [...new Set([...plannedCities.map((c) => c.name), ...currentNames])];

    const tripLevelChanged = ['budget', 'travelers', 'children'].some((key) => planned[key] !== current[key])
      || JSON.stringify(planned.travels) !== JSON.stringify(current.travels);
    if (tripLevelChanged) return wholeTrip;

    if (plannedCities.some((c) => !c.id) || current.cities.some((c) => !c.id)) return wholeTrip;

    const currentIds = new Set(current.cities.map((c) => c.id));
    if (plannedCities.some((c) => !currentIds.has(c.id))) return wholeTrip;

    const before = new Map(plannedCities.map((c) => [c.id, JSON.stringify(cityPlanningInputs(c))]));
    return current.cities
      .filter((c) => before.get(c.id) !== JSON.stringify(cityPlanningInputs(c)))
      .map((c) => c.name);
  }

  const api = { cityPlanningInputs, changedCityNames };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (root) Object.assign(root, api);
})(typeof window !== 'undefined' ? window : null);
