const fs = require('fs');
const path = require('path');

const FLUSH_DEBOUNCE_MS = 2000;

// Best-effort persistent cache: a lazily loaded JSON object flushed to disk
// (tmp+rename) on a debounce. Callers mutate the object returned by load().
function jsonFileCache(cachePath) {
  const dataDir = path.dirname(cachePath);
  let cache = null;
  let flushTimer = null;
  let dirty = false;

  function load() {
    if (cache) return cache;
    try {
      cache = fs.existsSync(cachePath) ? (JSON.parse(fs.readFileSync(cachePath, 'utf8')) || {}) : {};
    } catch {
      cache = {};
    }
    return cache;
  }

  function writeToDisk() {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const tmp = `${cachePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(cache));
      fs.renameSync(tmp, cachePath);
    } catch {
      // best-effort cache; swallow
    }
  }

  function flushNow() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    dirty = false;
    writeToDisk();
  }

  function scheduleFlush() {
    dirty = true;
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (!dirty) return;
      dirty = false;
      writeToDisk();
    }, FLUSH_DEBOUNCE_MS);
  }

  function reset() {
    load();
    cache = {};
    flushNow();
  }

  return { load, scheduleFlush, flushNow, reset };
}

module.exports = { jsonFileCache };
