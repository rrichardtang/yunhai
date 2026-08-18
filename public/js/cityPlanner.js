(function (root) {
  // depends on parseTimeTo24 from /shared/timeHelpers.js (must load before this)
  const parseTimeTo24 = (root && root.parseTimeTo24) || ((s) => String(s || ''));

  const normalizeCity = (str = '') => String(str).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  function normalizeCoordinate(value) {
    // Number(null) and Number('') are both 0, so an unset coordinate would normalize to a real
    // location off West Africa — and pass every Number.isFinite() gate meant to catch "not resolved
    // yet". It also made normalization non-idempotent: null on the first pass, 0 on the second.
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function cityVariants(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return [];

    const variants = new Set();
    const add = (text) => {
      const normalized = normalizeCity(text);
      if (normalized) variants.add(normalized);
    };

    add(raw);
    const firstComma = raw.split(',')[0]?.trim();
    if (firstComma) add(firstComma);
    const firstDash = raw.split(' - ')[0]?.trim();
    if (firstDash) add(firstDash);

    return [...variants];
  }

  function cityMatches(left = '', right = '') {
    const leftVariants = cityVariants(left);
    const rightVariants = cityVariants(right);
    if (!leftVariants.length || !rightVariants.length) return false;

    return leftVariants.some((lv) => rightVariants.some((rv) => (
      lv === rv
      || lv.startsWith(`${rv} `)
      || rv.startsWith(`${lv} `)
      || lv.includes(` ${rv}`)
      || rv.includes(` ${lv}`)
    )));
  }

  function parseYmdAsLocal(value = '') {
    const text = String(value || '').slice(0, 10);
    const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return new Date(NaN);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function formatYmdLocal(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function resolveDateTime(date = '', time = '') {
    const normalizedDate = String(date || '').slice(0, 10);
    if (!normalizedDate) return null;
    const normalizedTime = parseTimeTo24(time || '');
    if (!normalizedTime) return null;
    return `${normalizedDate}T${normalizedTime}:00`;
  }

  function normalizeCityLogistics(city = {}) {
    const arrivalDate = String(city.arrivalDate || city.startDate || '');
    const departureDate = String(city.departureDate || city.endDate || '');
    const existing = city.logistics || {};
    const arrival = existing.arrival || city.arrival || {};
    const departure = existing.departure || city.departure || {};
    const accommodation = existing.accommodation || city.accommodation || {};
    const accommodationType = ['hotel', 'airbnb', 'none'].includes(String(accommodation.type || '')) ? String(accommodation.type) : 'hotel';

    return {
      accommodation: {
        type: accommodationType,
        checkIn: String(accommodation.checkIn || arrivalDate || ''),
        checkOut: String(accommodation.checkOut || departureDate || '')
      },
      arrival: {
        date: String(arrival.date || arrivalDate || ''),
        time: parseTimeTo24(arrival.time || arrival.customTime || ''),
        location: String(arrival.location || ''),
        placeId: String(arrival.placeId || ''),
        latitude: normalizeCoordinate(arrival.latitude),
        longitude: normalizeCoordinate(arrival.longitude),
        mode: ['flight', 'train', 'car', 'other'].includes(arrival.mode) ? arrival.mode : 'flight',
        international: arrival.international !== undefined ? Boolean(arrival.international) : true
      },
      departure: {
        date: String(departure.date || departureDate || ''),
        time: parseTimeTo24(departure.time || departure.customTime || city.leaveTime || ''),
        location: String(departure.location || ''),
        placeId: String(departure.placeId || ''),
        latitude: normalizeCoordinate(departure.latitude),
        longitude: normalizeCoordinate(departure.longitude),
        mode: ['flight', 'train', 'car', 'other'].includes(departure.mode) ? departure.mode : 'flight',
        international: departure.international !== undefined ? Boolean(departure.international) : true
      }
    };
  }

  function validateCityTimeline(city = {}) {
    const logistics = city.logistics || normalizeCityLogistics(city);
    const arrivalDateTime = resolveDateTime(logistics.arrival.date, logistics.arrival.time);
    const departureDateTime = resolveDateTime(logistics.departure.date, logistics.departure.time);

    if (!arrivalDateTime || !departureDateTime) return '';
    if (new Date(departureDateTime).getTime() < new Date(arrivalDateTime).getTime()) {
      return 'Departure must be at or after arrival.';
    }
    return '';
  }

  function syncCityLegacyDates(city) {
    if (!city) return;
    const logistics = city.logistics || normalizeCityLogistics(city);
    city.startDate = logistics.arrival.date || '';
    city.endDate = logistics.departure.date || '';

    const arrivalTime = logistics.arrival.time || '';
    const departureTime = logistics.departure.time || '';

    city.leaveTime = parseTimeTo24(departureTime || city.leaveTime || '18:00');
    city.travelTiming = {
      ...(city.travelTiming || {}),
      arrivalAvailableTime: parseTimeTo24(arrivalTime || '09:00'),
      departureMustLeaveTime: parseTimeTo24(departureTime || city.leaveTime || '18:00')
    };
  }

  function formatCitySuggestion(feature) {
    const props = feature?.properties || {};
    const name = String(props.name || '').trim();
    const stateName = String(props.state || '').trim();
    const country = String(props.country || '').trim();
    if (!name) return null;
    const detail = [stateName, country].filter(Boolean).join(', ');
    return {
      name,
      label: detail ? `${name}, ${detail}` : name
    };
  }

  const api = {
    normalizeCity,
    normalizeCoordinate,
    cityVariants,
    cityMatches,
    parseYmdAsLocal,
    formatYmdLocal,
    resolveDateTime,
    normalizeCityLogistics,
    validateCityTimeline,
    syncCityLegacyDates,
    formatCitySuggestion
  };

  if (root) {
    root.TravelPlannerCityPlanner = api;
    Object.assign(root, api);
  }
})(typeof window !== 'undefined' ? window : null);
