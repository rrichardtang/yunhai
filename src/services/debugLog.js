const fs = require('fs');

const DEBUG_LOG_PATH = '/tmp/debug.log';
const MAX_LINE_LEN = 2000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function debugLog(scope, message) {
  try {
    const safeScope = String(scope || 'general').slice(0, 40);
    const safeMessage = String(message || '').slice(0, MAX_LINE_LEN);
    const line = `${new Date().toISOString()} [${safeScope}] ${safeMessage}\n`;
    try {
      const stat = fs.statSync(DEBUG_LOG_PATH);
      if (stat.size > MAX_FILE_BYTES) fs.writeFileSync(DEBUG_LOG_PATH, '');
    } catch {}
    fs.appendFileSync(DEBUG_LOG_PATH, line);
  } catch {}
}

function readDebugLog() {
  try { return fs.readFileSync(DEBUG_LOG_PATH, 'utf8'); }
  catch { return null; }
}

function clearDebugLog() {
  try { fs.writeFileSync(DEBUG_LOG_PATH, ''); return true; }
  catch { return false; }
}

module.exports = { debugLog, readDebugLog, clearDebugLog, DEBUG_LOG_PATH };
