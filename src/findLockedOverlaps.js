function findLockedOverlaps(locked) {
  const intervals = locked.map((entry) => {
    const duration = Number(entry.duration_minutes) || 60;
    const [h, m] = String(entry.time || '00:00').split(':').map(Number);
    const startMin = (h * 60) + (m || 0);
    return { id: entry.id, name: entry.name, date: entry.date, startMin, endMin: startMin + duration };
  });
  const conflicts = [];
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i];
      const b = intervals[j];
      if (a.date === b.date && a.startMin < b.endMin && b.startMin < a.endMin) {
        conflicts.push([a, b]);
      }
    }
  }
  return conflicts;
}

module.exports = { findLockedOverlaps };
