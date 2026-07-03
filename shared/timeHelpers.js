(function (root) {
  function parseClockTime(raw = '') {
    const t = String(raw || '').trim().toLowerCase();
    const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!m) return { hours: 9, minutes: 0 };
    let h = Number(m[1]);
    const min = Number(m[2] || '0');
    const ap = m[3];
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return {
      hours: Math.max(0, Math.min(23, h)),
      minutes: Math.max(0, Math.min(59, min))
    };
  }

  function parseTimeTo24(raw = '') {
    const { hours, minutes } = parseClockTime(raw);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function minutesFromTime(value = '09:00') {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return 9 * 60;
    const hours = Math.max(0, Math.min(23, Number(match[1] || 0)));
    const minutes = Math.max(0, Math.min(59, Number(match[2] || 0)));
    return (hours * 60) + minutes;
  }

  function timeFromMinutes(totalMinutes = 0) {
    const safe = Math.max(0, Math.min((24 * 60) - 1, Math.round(Number(totalMinutes) || 0)));
    const hours = Math.floor(safe / 60);
    const minutes = safe % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function extractTimeFromDateTime(value = '') {
    const text = String(value || '');
    const match = text.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : '';
  }

  const api = { parseClockTime, parseTimeTo24, minutesFromTime, timeFromMinutes, extractTimeFromDateTime };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (root) Object.assign(root, api);
})(typeof window !== 'undefined' ? window : null);
