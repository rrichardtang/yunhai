const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const MAX_CONSTRAINTS = 20;
const MAX_PREFERENCES = 30;
const DEFAULT_USER_ID = 'default';

function defaults() {
  return {
    profileInstruction: '',
    preferences: [],
    constraints: []
  };
}

function ensureDataDir() {
  fs.mkdirSync(USERS_DIR, { recursive: true });
}

function resolveUserId(userId) {
  const resolved = userId == null ? DEFAULT_USER_ID : String(userId).trim();
  if (!resolved) {
    const err = new Error('userId must be a non-empty string');
    err.statusCode = 400;
    throw err;
  }
  if (resolved.length > 128 || !/^[A-Za-z0-9_.|:-]+$/.test(resolved)) {
    const err = new Error('userId must be <= 128 chars and contain safe identifier characters');
    err.statusCode = 400;
    throw err;
  }
  return resolved;
}

function userPrefsPath(userId) {
  return path.join(USERS_DIR, `${resolveUserId(userId)}.json`);
}

function normalize(prefs) {
  const safe = defaults();
  if (!prefs || typeof prefs !== 'object') return safe;
  safe.profileInstruction = typeof prefs.profileInstruction === 'string' ? prefs.profileInstruction : '';
  safe.constraints = Array.isArray(prefs.constraints) ? prefs.constraints.slice(-MAX_CONSTRAINTS) : [];
  safe.preferences = Array.isArray(prefs.preferences) ? prefs.preferences.slice(-MAX_PREFERENCES) : [];
  return safe;
}

function load(userId = DEFAULT_USER_ID) {
  ensureDataDir();
  const resolvedUserId = resolveUserId(userId);
  const prefsPath = userPrefsPath(resolvedUserId);
  try {
    if (!fs.existsSync(prefsPath)) {
      const initial = defaults();
      save(initial, resolvedUserId);
      return initial;
    }
    const raw = fs.readFileSync(prefsPath, 'utf8');
    return normalize(JSON.parse(raw));
  } catch {
    const fresh = defaults();
    save(fresh, resolvedUserId);
    return fresh;
  }
}

function save(prefs, userId = DEFAULT_USER_ID) {
  ensureDataDir();
  const prefsPath = userPrefsPath(userId);
  const tmpPath = `${prefsPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(normalize(prefs), null, 2));
  fs.renameSync(tmpPath, prefsPath);
}

function recordConstraint(userId = DEFAULT_USER_ID, constraint) {
  const text = String(constraint || '').trim();
  if (!text) return null;
  const prefs = load(userId);
  const lower = text.toLowerCase();
  if (prefs.constraints.some((c) => c.text.toLowerCase() === lower)) return prefs;
  prefs.constraints.push({ text, ts: Math.floor(Date.now() / 1000) });
  prefs.constraints = prefs.constraints.slice(-MAX_CONSTRAINTS);
  save(prefs, userId);
  return prefs;
}

function recordPreference(userId = DEFAULT_USER_ID, preference) {
  const text = String(preference || '').trim();
  if (!text) return null;
  const prefs = load(userId);
  const lower = text.toLowerCase();
  if (prefs.preferences.some((p) => p.text.toLowerCase() === lower)) return prefs;
  prefs.preferences.push({ text, ts: Math.floor(Date.now() / 1000) });
  prefs.preferences = prefs.preferences.slice(-MAX_PREFERENCES);
  save(prefs, userId);
  return prefs;
}

function getSummary(userId = DEFAULT_USER_ID) {
  const prefs = load(userId);
  const parts = [];

  if (prefs.profileInstruction) parts.push(prefs.profileInstruction);

  if (prefs.preferences.length) {
    parts.push(`Learned preferences:\n${prefs.preferences.map((p) => `- ${p.text}`).join('\n')}`);
  }

  if (prefs.constraints.length) {
    parts.push(`Constraints:\n${prefs.constraints.map((c) => `- ${c.text}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

function reset(userId = DEFAULT_USER_ID) {
  const fresh = defaults();
  save(fresh, userId);
  return fresh;
}

module.exports = { load, save, recordConstraint, recordPreference, getSummary, reset, resolveUserId, DEFAULT_USER_ID };
