const CHECKLIST_TYPES = ['transportation', 'accommodation', 'dining', 'activity', 'other'];

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

function migrateType(raw = 'other') {
  const v = String(raw || 'other').trim().toLowerCase();
  if (['flight', 'train', 'car_rental', 'transfer'].includes(v)) return 'transportation';
  if (v === 'hotel') return 'accommodation';
  if (v === 'restaurant') return 'dining';
  if (['attraction', 'tour'].includes(v)) return 'activity';
  if (CHECKLIST_TYPES.includes(v)) return v;
  return 'other';
}

function migrateStatus(item = {}) {
  const v = String(item.state || item.status || 'open').toLowerCase();
  if (v === 'verified' || v === 'finalized') return 'finalized';
  return 'open';
}

function normalizeChecklistItem(item = {}) {
  const type = migrateType(item.type || item.kind);
  const status = migrateStatus(item);
  const noteParts = [item.name, item.bookingReference, item.notes].map((v) => String(v || '').trim()).filter(Boolean);
  return {
    id: String(item.id || `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
    type,
    city: String(item.city || item.location || '').trim(),
    dateTime: String(item.dateTime || item.when || item.date || '').trim(),
    notes: noteParts.join(' — '),
    status,
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function groupChecklistByCity(checklist = []) {
  const grouped = new Map();
  for (const item of checklist) {
    const city = item.city || 'General';
    if (!grouped.has(city)) grouped.set(city, []);
    grouped.get(city).push(item);
  }
  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([city, items]) => ({ city, items }));
}

function ensureChecklist(itinerary = {}) {
  const stored = itinerary?.confidence?.checklist;
  if (Array.isArray(stored) && stored.length) return stored.map(normalizeChecklistItem);
  return [];
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
    if (!item.dateTime) issues.push(createIssue('missing_details', 'medium', `${item.type || 'Checklist item'} in ${item.city || 'unknown city'} is missing date/time.`));
  });

  return issues;
}

function deriveChecklistSummary(checklist = []) {
  const open = checklist.filter((item) => item.status === 'open');
  const finalized = checklist.filter((item) => item.status === 'finalized');
  return {
    open,
    finalized,
    counts: { total: checklist.length, open: open.length, finalized: finalized.length },
    groupedChecklist: groupChecklistByCity(checklist)
  };
}

function computeConfidence(itinerary = {}) {
  const checklist = ensureChecklist(itinerary);
  const issues = collectIssues(itinerary, checklist);
  const summary = deriveChecklistSummary(checklist);
  const hasHighConflicts = issues.some((item) => ['overlapping_dates', 'overlapping_activities', 'conflicting_reservations', 'impossible_timing'].includes(item.type));
  const hasMissing = issues.some((item) => ['missing_datetime', 'missing_details'].includes(item.type)) || summary.counts.open > 0;

  let status = 'Needs review';
  if (hasHighConflicts) status = 'Conflicts found';
  else if (hasMissing) status = 'Missing details';
  else if (summary.counts.total > 0 && summary.counts.finalized === summary.counts.total && issues.length === 0) status = 'Ready';

  return {
    status,
    issues,
    issueCount: issues.length,
    topIssue: issues[0]?.message || 'No issues detected',
    checklist,
    checklistProgress: { verified: summary.counts.finalized, total: checklist.length },
    checklistSummary: summary,
    notificationPrefs: {
      emailSummary: Boolean(itinerary?.confidence?.notificationPrefs?.emailSummary),
      reminderBeforeDeparture: Boolean(itinerary?.confidence?.notificationPrefs?.reminderBeforeDeparture)
    },
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  CHECKLIST_TYPES,
  computeConfidence,
  ensureChecklist,
  normalizeChecklistItem
};
