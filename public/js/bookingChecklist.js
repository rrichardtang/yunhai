(function (root) {
  const uid = () => Math.random().toString(36).slice(2, 10);

  function migrateChecklistType(type = 'other') {
    const v = String(type || 'other').toLowerCase();
    if (['flight', 'train', 'car_rental', 'transfer', 'transportation'].includes(v)) return 'transportation';
    if (['hotel', 'accommodation'].includes(v)) return 'accommodation';
    if (['restaurant', 'food', 'cafe', 'bar', 'dining'].includes(v)) return 'activity';
    if (['attraction', 'tour', 'museum', 'park', 'landmark', 'entertainment', 'shopping', 'nightlife', 'activity', 'other'].includes(v)) return 'activity';
    return 'activity';
  }

  function mapActivityTypeToChecklist(type = '') {
    const v = String(type || '').toLowerCase();
    if (['transfer', 'transport'].includes(v)) return 'transportation';
    return 'activity';
  }

  function normalizeChecklistItem(item = {}) {
    const rawType = String(item.type || 'activity').toLowerCase();
    const type = ['transportation', 'accommodation', 'activity'].includes(rawType) ? rawType : migrateChecklistType(rawType);

    const rawStatus = String(item.state || item.status || 'open').toLowerCase();
    const status = ['verified', 'finalized', 'resolved'].includes(rawStatus) ? 'resolved'
      : rawStatus === 'in_progress' ? 'in_progress' : 'open';

    const verified = Boolean(item.verified || status === 'resolved' || item.state === 'verified');
    const budgetRaw = Number(item.budgetUsd ?? item.budget ?? item.budget_usd);
    const budgetUsd = Number.isFinite(budgetRaw) && budgetRaw >= 0 ? budgetRaw : null;

    const base = {
      id: String(item.id || uid()),
      type,
      name: String(item.name || item.title || '').trim(),
      verified,
      budgetUsd,
      referenceNum: String(item.referenceNum || item.bookingReference || item.reference || '').trim(),
      notes: String(item.notes || '').trim(),
      status,
      updatedAt: item.updatedAt || new Date().toISOString(),
      expanded: Boolean(item.expanded),
      city: String(item.city || item.location || '').trim(),
      dateTime: String(item.dateTime || item.when || '').trim()
    };

    if (type === 'transportation') {
      const rawScope = String(item.transportScope || item.transport_scope || item.transportType || '').toLowerCase();
      const transportScope = rawScope === 'entry_exit' ? 'entry_exit' : 'experience';
      return {
        ...base,
        isRoundTrip: Boolean(item.isRoundTrip),
        transportScope,
        startLocation: String(item.startLocation || item.city || '').trim(),
        startPlaceId: String(item.startPlaceId || '').trim(),
        startLat: item.startLat ?? null,
        startLng: item.startLng ?? null,
        endLocation: String(item.endLocation || '').trim(),
        endPlaceId: String(item.endPlaceId || '').trim(),
        endLat: item.endLat ?? null,
        endLng: item.endLng ?? null,
        departureDate: String(item.departureDate || (base.dateTime ? base.dateTime.slice(0, 10) : '')).trim(),
        departureTime: String(item.departureTime || (base.dateTime && base.dateTime.length > 10 ? base.dateTime.slice(11, 16) : '')).trim(),
        arrivalDate: String(item.arrivalDate || '').trim(),
        arrivalTime: String(item.arrivalTime || '').trim(),
        returnDate: String(item.returnDate || '').trim(),
        returnTime: String(item.returnTime || '').trim(),
        returnArrivalDate: String(item.returnArrivalDate || '').trim(),
        returnArrivalTime: String(item.returnArrivalTime || '').trim()
      };
    }

    if (type === 'accommodation') {
      return {
        ...base,
        accommodationCity: String(item.accommodationCity || item.city || '').trim(),
        accommodationCityPlaceId: String(item.accommodationCityPlaceId || '').trim(),
        accommodationCityLat: item.accommodationCityLat ?? null,
        accommodationCityLng: item.accommodationCityLng ?? null,
        checkInDate: String(item.checkInDate || (base.dateTime ? base.dateTime.slice(0, 10) : '')).trim(),
        checkOutDate: String(item.checkOutDate || '').trim()
      };
    }

    return {
      ...base,
      activityId: String(item.activityId || '').trim(),
      bookingNotRequired: Boolean(item.bookingNotRequired || item.booking_not_required),
      activityLocation: String(item.activityLocation || item.city || '').trim(),
      activityLocationPlaceId: String(item.activityLocationPlaceId || '').trim(),
      activityLocationLat: item.activityLocationLat ?? null,
      activityLocationLng: item.activityLocationLng ?? null,
      activityDate: String(item.activityDate || (base.dateTime ? base.dateTime.slice(0, 10) : '')).trim(),
      activityTime: String(item.activityTime || (base.dateTime && base.dateTime.length > 10 ? base.dateTime.slice(11, 16) : '')).trim(),
      activityEndTime: String(item.activityEndTime || '').trim()
    };
  }

  function checklistItemSortKey(item) {
    if (item.type === 'transportation') return item.departureDate || item.dateTime || '9999';
    if (item.type === 'accommodation') return item.checkInDate || item.dateTime || '9999';
    const date = item.activityDate || (item.dateTime ? item.dateTime.slice(0, 10) : '');
    return date ? date + 'T' + (item.activityTime || '') : '9999';
  }

  function sortChecklistByDateAsc(a, b) {
    return checklistItemSortKey(a).localeCompare(checklistItemSortKey(b));
  }

  function formatChecklistDate(dateStr, timeStr, endTimeStr = '') {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const base = `${month} ${day}`;
    if (!timeStr) return base;
    const fmtTime = (t) => {
      const [h, m] = String(t || '').split(':').map(Number);
      if (!Number.isFinite(h)) return '';
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = (h % 12) || 12;
      return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
    };
    const startFmt = fmtTime(timeStr);
    if (!startFmt) return base;
    if (endTimeStr) {
      const endFmt = fmtTime(endTimeStr);
      if (endFmt) return `${base}, ${startFmt} – ${endFmt}`;
    }
    return `${base}, ${startFmt}`;
  }

  function truncateLocation(loc, max = 28) {
    const s = String(loc || '');
    if (s.length <= max) return s;
    const short = s.split(',')[0].trim();
    if (short.length <= max) return short;
    return short.slice(0, max - 1) + '…';
  }

  const api = {
    migrateChecklistType,
    mapActivityTypeToChecklist,
    normalizeChecklistItem,
    checklistItemSortKey,
    sortChecklistByDateAsc,
    formatChecklistDate,
    truncateLocation
  };

  if (root) {
    root.TravelPlannerBookingChecklist = api;
    Object.assign(root, api);
  }
})(typeof window !== 'undefined' ? window : null);
