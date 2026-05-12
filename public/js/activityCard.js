(function (root) {
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function actDurationHours(a, fallback = 1) {
    if (a == null) return fallback;
    if (a.timing != null) return (a.timing.duration_minutes ?? 60) / 60;
    return Number(a.duration_hours) || fallback;
  }

  function actPreferredTime(a) {
    if (a == null) return null;
    if (a.timing != null) return a.timing.preferred_time ?? null;
    const s = String(a.suggested_time || '').trim();
    return (s && s !== '10:00am') ? s : null;
  }

  function actAddress(a) {
    if (a == null) return '';
    if (a.location != null) return a.location.address ?? '';
    return String(a.start_location || '').trim();
  }

  function actCostUsd(a) {
    if (a == null) return null;
    return a.cost != null ? a.cost.estimated_usd : a.estimated_cost_usd;
  }

  function actCostType(a) {
    if (a == null) return 'per_person';
    return a.cost != null ? a.cost.type : (a.cost_type || 'per_person');
  }

  function actBookingType(a) {
    if (a == null) return 'none';
    return a.booking != null ? a.booking.type : (a.booking_type || 'none');
  }

  function actBookingLinks(a) {
    if (a == null) return [];
    return a.booking != null ? (a.booking.links || []) : (a.booking_links || []);
  }

  function actOpeningHours(a) {
    if (a == null) return '';
    return a.timing != null ? (a.timing.opening_hours || '') : (a.opening_hours || '');
  }

  const MEAL_PREFIX_RE = /^(Lunch|Dinner|Breakfast|Brunch|Drinks|Coffee|Visit)\s+at\s+/i;

  function stripMealPrefix(name = '') {
    return String(name || '').replace(MEAL_PREFIX_RE, '').replace(/^Visit\s+/i, '').trim();
  }

  function priceLevelBadge(level) {
    if (typeof level !== 'number' || level < 0 || level > 4) return '';
    if (level === 0) return 'Free';
    return '$'.repeat(level);
  }

  const PRICE_LEVEL_USD = { 0: 0, 1: 15, 2: 40, 3: 90, 4: 200 };

  function representativeCostUsd(activity = {}) {
    const type = String(activity?.type || '').toLowerCase();
    const bookingType = actBookingType(activity);
    const mealTypes = ['meal', 'food', 'breakfast', 'lunch', 'dinner', 'restaurant'];
    if (mealTypes.includes(type) || bookingType === 'restaurant') {
      const lvl = activity?.price_level;
      if (typeof lvl === 'number' && PRICE_LEVEL_USD[lvl] != null) return PRICE_LEVEL_USD[lvl];
      return null;
    }
    if (bookingType === 'tour' || type === 'tour') return 75;
    if (bookingType === 'attraction' || type === 'museum' || type === 'landmark' || type === 'cultural' || type === 'gallery' || type === 'sports') return 25;
    if (type === 'show') return 80;
    return null;
  }

  function getGetYourGuideLink(activity = {}) {
    const links = actBookingLinks(activity);
    return links.find((l) => /getyourguide/i.test(l?.site || '')) || links.find((l) => /viator/i.test(l?.site || '')) || null;
  }

  function googleMapsLinkHtml(activity = {}) {
    const venue = activity.venue_name || activity.name;
    if (!venue) return '';
    const q = encodeURIComponent(venue);
    const url = activity.place_id
      ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(activity.place_id)}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`;
    return `<a href="${url}" target="_blank" rel="noopener" class="badge badge-maps" title="Open in Google Maps" aria-label="Google Maps"><i class="ph-bold ph-map-pin" aria-hidden="true"></i></a>`;
  }

  function headerPriceBadgeHtml(activity = {}) {
    const bookingType = actBookingType(activity);
    if (bookingType === 'tour' || bookingType === 'attraction') {
      const link = getGetYourGuideLink(activity);
      if (link?.url) return `<a href="${esc(link.url)}" target="_blank" rel="noopener" class="badge badge-price booking-link">${esc(link.site || 'GetYourGuide')}</a>`;
      return '';
    }
    const lvl = activity?.price_level;
    if (typeof lvl === 'number' && lvl >= 0 && lvl <= 4) {
      const label = lvl === 0 ? 'Free' : '$'.repeat(lvl);
      return `<span class="badge badge-price">${label}</span>`;
    }
    return '';
  }

  function renderActivityCostCell(activity = {}, { userBudget = null } = {}) {
    if (userBudget != null && Number.isFinite(Number(userBudget))) {
      return `$${Math.round(Number(userBudget)).toLocaleString()}`;
    }
    const bookingType = actBookingType(activity);
    if (bookingType === 'tour' || bookingType === 'attraction') {
      const link = getGetYourGuideLink(activity);
      if (link?.url) return `<a href="${esc(link.url)}" target="_blank" rel="noopener" class="booking-link">Price on ${esc(link.site || 'GetYourGuide')} →</a>`;
    }
    const badge = priceLevelBadge(activity?.price_level);
    if (badge) return `<span class="price-level-badge">${esc(badge)}</span>`;
    return '';
  }

  const api = {
    actDurationHours,
    actPreferredTime,
    actAddress,
    actCostUsd,
    actCostType,
    actBookingType,
    actBookingLinks,
    actOpeningHours,
    stripMealPrefix,
    priceLevelBadge,
    representativeCostUsd,
    getGetYourGuideLink,
    googleMapsLinkHtml,
    headerPriceBadgeHtml,
    renderActivityCostCell
  };

  if (root) {
    root.TravelPlannerActivityCard = api;
    Object.assign(root, api);
  }
})(typeof window !== 'undefined' ? window : null);
