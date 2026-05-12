function parseTimeForCalendar(raw = '') {
  const normalized = String(raw || '').trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return { hours: 9, minutes: 0 };

  let hours = Number(match[1] || 9);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3];

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  return {
    hours: Math.max(0, Math.min(23, hours)),
    minutes: Math.max(0, Math.min(59, minutes))
  };
}

function toIcsDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function escapeIcsText(value = '') {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function buildItineraryIcs(itinerary = {}, { metadataMode = 'compact' } = {}) {
  const now = new Date();
  const timestamp = `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;
  const events = [];

  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  for (const day of days) {
    const baseDate = String(day?.date || '').slice(0, 10);
    if (!baseDate) continue;

    const activities = Array.isArray(day?.activities) ? day.activities : [];
    for (const activity of activities) {
      const [year, month, date] = baseDate.split('-').map((n) => Number(n));
      if (!year || !month || !date) continue;

      const start = parseTimeForCalendar(activity?.time || activity?.suggested_time || '09:00');
      const durationHours = Math.max(0.5, Number(activity?.duration_hours || 1.5));
      const durationMinutes = Math.round(durationHours * 60);

      const startDate = new Date(year, month - 1, date, start.hours, start.minutes, 0);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      const summary = activity?.name || 'Travel activity';
      const location = activity?.location?.address || activity?.venue_name || [activity?.start_location, activity?.end_location].filter(Boolean).join(' → ') || day?.city || '';
      const description = metadataMode === 'full' ? [
        `Type: ${activity?.type || 'activity'}`,
        activity?.why_it_fits ? `Why: ${activity.why_it_fits}` : '',
        activity?.booking_advice ? `Booking advice: ${activity.booking_advice}` : '',
        activity?.pitfall ? `Pitfall: ${activity.pitfall}` : ''
      ].filter(Boolean).join('\n') : '';

      events.push([
        'BEGIN:VEVENT',
        `UID:${escapeIcsText(`${itinerary.id || 'trip'}-${activity?.id || summary}-${toIcsDate(startDate)}@travelplanner.local`)}`,
        `DTSTAMP:${timestamp}`,
        `DTSTART:${toIcsDate(startDate)}`,
        `DTEND:${toIcsDate(endDate)}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        location ? `LOCATION:${escapeIcsText(location)}` : '',
        description ? `DESCRIPTION:${escapeIcsText(description)}` : '',
        'END:VEVENT'
      ].filter(Boolean).join('\r\n'));
    }
  }

  const calendarName = itinerary.tripName || 'TravelPlanner Itinerary';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TravelPlanner//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');
}

module.exports = { buildItineraryIcs, parseTimeForCalendar, toIcsDate, escapeIcsText };
