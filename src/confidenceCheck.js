const CRITICAL_BOOKING_TYPES = [
  'flight',
  'hotel',
  'car_rental',
  'train',
  'attraction',
  'restaurant',
  'tour',
  'transfer'
];

function toDate(value = '') {
  const text = String(value || '').trim();
  if (!text) return null;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toMinutes(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return null;
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function createIssue(type, severity, message, context = {}) {
  return { id: `${type}:${message}`.slice(0, 160), type, severity, message, context };
}

function normalizeType(raw = 'other') {
  const text = String(raw || 'other').trim().toLowerCase();
  return text || 'other';
}

function normalizeChecklistState(raw = '') {
  const value = String(raw || '').trim().toLowerCase();
  if (['missing', 'needs_booking', 'booked_unverified', 'verified', 'problem'].includes(value)) return value;
  if (value === 'pending') return 'needs_booking';
  if (value === 'broken') return 'problem';
  return 'needs_booking';
}

function normalizeChecklistItem(item = {}) {
  const state = normalizeChecklistState(item.state || item.status);
  const name = String(item.name || item.title || '').trim() || 'Untitled item';
  const type = normalizeType(item.type || item.kind);
  const dateTime = String(item.dateTime || item.when || item.date || '').trim();
  const source = String(item.source || '').trim();
  const notes = String(item.notes || '').trim();
  const bookingReference = String(item.bookingReference || item.confirmationCode || '').trim();
  const verified = item.verified === true || state === 'verified';

  return {
    id: String(item.id || `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    type,
    name,
    dateTime,
    state,
    verified,
    source,
    notes,
    bookingReference,
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function buildChecklistFromBookings(bookings = []) {
  const normalized = (Array.isArray(bookings) ? bookings : []).map((booking) => normalizeChecklistItem({
    id: booking.id,
    type: booking.kind || 'reservation',
    name: booking.title || `${booking.kind || 'Booking'} reservation`,
    dateTime: booking.startDate || '',
    state: booking.confirmationCode ? 'booked_unverified' : 'needs_booking',
    source: booking.provider || '',
    notes: [booking.startDate, booking.endDate].filter(Boolean).join(' → '),
    bookingReference: booking.confirmationCode || ''
  }));

  const seenTypes = new Set(normalized.map((item) => item.type));
  for (const type of CRITICAL_BOOKING_TYPES) {
    if (seenTypes.has(type)) continue;
    normalized.push(normalizeChecklistItem({
      type,
      name: `${type.replace(/_/g, ' ')} booking`,
      state: 'missing',
      notes: 'Critical trip item not yet captured in plan.'
    }));
  }
  return normalized;
}

function ensureChecklist(itinerary = {}) {
  const stored = itinerary?.confidence?.checklist;
  if (Array.isArray(stored) && stored.length) return stored.map(normalizeChecklistItem);
  return buildChecklistFromBookings(itinerary.bookings || []);
}

function collectIssues(itinerary = {}, checklist = []) {
  const issues = [];
  const cities = Array.isArray(itinerary.cities) ? itinerary.cities : [];

  for (let i = 0; i < cities.length; i += 1) {
    const city = cities[i] || {};
    const start = toDate(city.startDate);
    const end = toDate(city.endDate);
    if (!start || !end) {
      issues.push(createIssue('missing_datetime', 'medium', `City ${city.name || i + 1} is missing start or end date.`));
      continue;
    }
    if (end < start) {
      issues.push(createIssue('impossible_timing', 'high', `${city.name || 'City'} ends before it starts.`));
    }
    for (let j = i + 1; j < cities.length; j += 1) {
      const other = cities[j] || {};
      const oStart = toDate(other.startDate);
      const oEnd = toDate(other.endDate);
      if (!oStart || !oEnd) continue;
      if (start <= oEnd && oStart <= end) {
        issues.push(createIssue('overlapping_dates', 'high', `${city.name || 'City'} overlaps ${other.name || 'another city'} dates.`));
      }
    }
  }

  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  for (const day of days) {
    const activities = Array.isArray(day.activities) ? day.activities : [];
    const windows = activities.map((activity) => {
      const startMin = toMinutes(activity.time || activity.suggested_time);
      const duration = Math.max(30, Math.round(Number(activity.duration_hours || 1) * 60));
      return {
        name: activity.name || 'Activity',
        startMin,
        endMin: startMin != null ? startMin + duration : null
      };
    });

    windows.forEach((w) => {
      if (w.startMin == null) issues.push(createIssue('missing_datetime', 'medium', `${w.name} is missing a time on ${day.date || day.city || 'a day'}.`));
    });

    const sorted = windows.filter((w) => w.startMin != null).sort((a, b) => a.startMin - b.startMin);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.startMin < prev.endMin) {
        issues.push(createIssue('overlapping_activities', 'high', `${cur.name} overlaps with ${prev.name} on ${day.date || day.city || 'the same day'}.`));
      }
      const gap = cur.startMin - prev.endMin;
      if (gap > 8 * 60) {
        issues.push(createIssue('suspicious_gap', 'low', `Large gap (${Math.round(gap / 60)}h) between ${prev.name} and ${cur.name}.`));
      }
    }
  }

  const bookings = Array.isArray(itinerary.bookings) ? itinerary.bookings : [];
  for (let i = 0; i < bookings.length; i += 1) {
    const a = bookings[i] || {};
    const aStart = toDate(a.startDate);
    const aEnd = toDate(a.endDate || a.startDate);
    if (!aStart || !aEnd) continue;
    for (let j = i + 1; j < bookings.length; j += 1) {
      const b = bookings[j] || {};
      const bStart = toDate(b.startDate);
      const bEnd = toDate(b.endDate || b.startDate);
      if (!bStart || !bEnd) continue;
      if (aStart <= bEnd && bStart <= aEnd && String(a.kind || 'other') === String(b.kind || 'other')) {
        issues.push(createIssue('conflicting_reservations', 'high', `${a.title || a.kind || 'Booking'} conflicts with ${b.title || b.kind || 'another booking'}.`));
      }
    }
  }

  checklist.forEach((item) => {
    if (!item.name) issues.push(createIssue('missing_details', 'medium', 'A checklist item is missing a name.'));
    if (!item.dateTime) issues.push(createIssue('missing_details', 'medium', `${item.name || 'Checklist item'} is missing date/time.`));
    if (item.state === 'problem') issues.push(createIssue('booking_problem', 'high', `${item.name || 'Checklist item'} is marked as broken and needs a fix.`));
  });

  return issues;
}

function deriveChecklistSummary(checklist = []) {
  const needsBooking = checklist.filter((item) => item.state === 'missing' || item.state === 'needs_booking');
  const confirmed = checklist.filter((item) => item.state === 'verified');
  const broken = checklist.filter((item) => item.state === 'problem');
  const canFixNow = checklist.filter((item) => item.state === 'booked_unverified' || item.state === 'problem' || !item.dateTime);

  return {
    needsBooking,
    confirmed,
    broken,
    canFixNow,
    counts: {
      total: checklist.length,
      needsBooking: needsBooking.length,
      confirmed: confirmed.length,
      broken: broken.length,
      canFixNow: canFixNow.length
    }
  };
}

function computeConfidence(itinerary = {}) {
  const checklist = ensureChecklist(itinerary);
  const issues = collectIssues(itinerary, checklist);
  const summary = deriveChecklistSummary(checklist);
  const hasHighConflicts = issues.some((item) => ['overlapping_dates', 'overlapping_activities', 'conflicting_reservations', 'impossible_timing', 'booking_problem'].includes(item.type));

  let status = 'Needs review';
  if (hasHighConflicts || summary.counts.broken > 0) status = 'Conflicts found';
  else if (summary.counts.needsBooking > 0 || issues.some((item) => item.type === 'missing_datetime' || item.type === 'missing_details')) status = 'Missing details';
  else if (summary.counts.total > 0 && summary.counts.confirmed === summary.counts.total && issues.length === 0) status = 'Ready';

  return {
    status,
    issues,
    issueCount: issues.length,
    topIssue: issues[0]?.message || 'No issues detected',
    checklist,
    checklistProgress: { verified: summary.counts.confirmed, total: checklist.length },
    bookingSummary: summary,
    immediateActions: [
      ...summary.needsBooking.map((item) => `Book: ${item.name}`),
      ...summary.canFixNow.map((item) => `Fix now: ${item.name}`)
    ].slice(0, 6),
    notificationPrefs: {
      emailSummary: Boolean(itinerary?.confidence?.notificationPrefs?.emailSummary),
      reminderBeforeDeparture: Boolean(itinerary?.confidence?.notificationPrefs?.reminderBeforeDeparture)
    },
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  CRITICAL_BOOKING_TYPES,
  computeConfidence,
  ensureChecklist,
  normalizeChecklistItem
};
