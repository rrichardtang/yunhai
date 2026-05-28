const fs = require('fs');
const path = require('path');
const store = require('./memory/store');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const DEFAULT_USER_ID = 'default';

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

function userPrefsPath(resolvedUserId) {
  return path.join(USERS_DIR, `${resolvedUserId}.json`);
}

// The user file is now the home of profileInstruction only; preferences and
// constraints live in the memory store. Legacy fields are read for migration.
function readUserFile(resolvedUserId) {
  ensureDataDir();
  const p = userPrefsPath(resolvedUserId);
  try {
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

function writeProfileInstruction(resolvedUserId, profileInstruction) {
  ensureDataDir();
  const p = userPrefsPath(resolvedUserId);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ profileInstruction: profileInstruction || '' }, null, 2));
  fs.renameSync(tmp, p);
}

// One-time import of legacy {preferences,constraints} arrays into the store the
// first time a user is touched after the memory layer ships.
function migrateLegacy(resolvedUserId, userFile) {
  if (store.exists(resolvedUserId) || !userFile) return;
  const legacy = [];
  for (const c of Array.isArray(userFile.constraints) ? userFile.constraints : []) {
    const text = String(c?.text || c || '').trim();
    if (text) legacy.push(store.makeRecord({ text, type: 'constraint', scope: 'user', source: 'manual', createdTs: c?.ts }));
  }
  for (const p of Array.isArray(userFile.preferences) ? userFile.preferences : []) {
    const text = String(p?.text || p || '').trim();
    if (text) legacy.push(store.makeRecord({ text, type: 'preference', scope: 'user', source: 'manual', createdTs: p?.ts }));
  }
  store.saveAll(resolvedUserId, legacy.filter(Boolean));
}

function userScoped(resolvedUserId, type) {
  return store.loadAll(resolvedUserId)
    .filter((r) => r.scope === 'user' && r.type === type)
    .sort((a, b) => (a.createdTs || 0) - (b.createdTs || 0));
}

function getProfileInstruction(userId = DEFAULT_USER_ID) {
  const resolved = resolveUserId(userId);
  const file = readUserFile(resolved);
  migrateLegacy(resolved, file);
  return typeof file?.profileInstruction === 'string' ? file.profileInstruction : '';
}

function load(userId = DEFAULT_USER_ID) {
  const resolved = resolveUserId(userId);
  const file = readUserFile(resolved);
  migrateLegacy(resolved, file);
  const toItem = (r) => ({ text: r.text, ts: r.updatedTs || r.createdTs });
  return {
    profileInstruction: typeof file?.profileInstruction === 'string' ? file.profileInstruction : '',
    preferences: userScoped(resolved, 'preference').map(toItem),
    constraints: userScoped(resolved, 'constraint').map(toItem)
  };
}

// Diff-based sync so unchanged records keep their store metadata (keywords,
// salience, source) instead of being flattened to the {text,ts} editor shape.
function syncUserScoped(resolvedUserId, type, arr) {
  const desired = arr.map((item) => String(item?.text ?? item ?? '').trim()).filter(Boolean);
  const desiredSet = new Set(desired.map((t) => t.toLowerCase()));
  const records = store.loadAll(resolvedUserId);
  const currentTexts = new Set(
    records.filter((r) => r.scope === 'user' && r.type === type).map((r) => r.text.toLowerCase())
  );
  const kept = records.filter((r) => !(r.scope === 'user' && r.type === type && !desiredSet.has(r.text.toLowerCase())));
  const additions = desired
    .filter((t) => !currentTexts.has(t.toLowerCase()))
    .map((text) => store.makeRecord({ text, type, scope: 'user', source: 'manual' }))
    .filter(Boolean);
  store.saveAll(resolvedUserId, store.trimUserScoped(kept.concat(additions)));
}

function save(prefs = {}, userId = DEFAULT_USER_ID) {
  const resolved = resolveUserId(userId);
  writeProfileInstruction(resolved, typeof prefs.profileInstruction === 'string' ? prefs.profileInstruction : getProfileInstruction(resolved));
  if (Array.isArray(prefs.constraints)) syncUserScoped(resolved, 'constraint', prefs.constraints);
  if (Array.isArray(prefs.preferences)) syncUserScoped(resolved, 'preference', prefs.preferences);
}

function recordEntry(resolvedUserId, type, text) {
  const clean = String(text || '').trim();
  if (!clean) return null;
  const records = store.loadAll(resolvedUserId);
  const lower = clean.toLowerCase();
  if (records.some((r) => r.scope === 'user' && r.type === type && r.text.toLowerCase() === lower)) return load(resolvedUserId);
  records.push(store.makeRecord({ text: clean, type, scope: 'user', source: 'manual' }));
  store.saveAll(resolvedUserId, store.trimUserScoped(records));
  return load(resolvedUserId);
}

function recordConstraint(userId = DEFAULT_USER_ID, constraint) {
  return recordEntry(resolveUserId(userId), 'constraint', constraint);
}

function recordPreference(userId = DEFAULT_USER_ID, preference) {
  return recordEntry(resolveUserId(userId), 'preference', preference);
}

function getSummary(userId = DEFAULT_USER_ID) {
  const resolved = resolveUserId(userId);
  const file = readUserFile(resolved);
  migrateLegacy(resolved, file);
  const parts = [];
  const profileInstruction = typeof file?.profileInstruction === 'string' ? file.profileInstruction : '';
  if (profileInstruction) parts.push(profileInstruction);
  const block = store.formatRecords(store.loadAll(resolved).filter((r) => r.scope === 'user'));
  if (block) parts.push(block);
  return parts.join('\n\n');
}

function reset(userId = DEFAULT_USER_ID) {
  const resolved = resolveUserId(userId);
  writeProfileInstruction(resolved, '');
  store.saveAll(resolved, []);
  return load(resolved);
}

module.exports = { load, save, recordConstraint, recordPreference, getSummary, getProfileInstruction, reset, resolveUserId, DEFAULT_USER_ID };
