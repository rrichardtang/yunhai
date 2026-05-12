(function (root) {
  function parseTimeString(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
      if (ampm[3] === 'pm' && h !== 12) h += 12;
      if (ampm[3] === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const h24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (h24) {
      const h = parseInt(h24[1], 10);
      const m = parseInt(h24[2], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    return null;
  }

  function parseDurationToMinutes(hours) {
    return Math.max(15, Math.round(Number(hours) * 60));
  }

  function isLegacyActivity(obj) {
    return obj != null && typeof obj === 'object' && obj.timing === undefined;
  }

  const api = { isLegacyActivity, parseTimeString, parseDurationToMinutes };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (root) root.ActivityMigration = api;
})(typeof window !== 'undefined' ? window : null);
