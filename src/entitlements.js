const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'invite-codes.json');

function ensureStoreFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, JSON.stringify({ codes: [] }, null, 2));
}

function readStore() {
  ensureStoreFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return { codes: Array.isArray(parsed.codes) ? parsed.codes : [] };
  } catch {
    return { codes: [] };
  }
}

function writeStore(store) {
  ensureStoreFile();
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase();
}

function generateCodes(count) {
  const n = Math.max(1, Math.min(1000, parseInt(count, 10) || 1));
  const store = readStore();
  const now = new Date().toISOString();
  const fresh = [];
  for (let i = 0; i < n; i++) {
    const code = crypto.randomBytes(6).toString('base64url').toUpperCase().slice(0, 8);
    fresh.push({ code, createdAt: now, redeemedBy: null, redeemedAt: null });
  }
  store.codes.push(...fresh);
  writeStore(store);
  return fresh.map((c) => c.code);
}

function listCodes() {
  return readStore().codes;
}

function isEntitled(userId) {
  if (!userId) return false;
  return readStore().codes.some((c) => c.redeemedBy === userId);
}

function redeemCode(rawCode, userId) {
  if (!userId) return { ok: false, reason: 'invalid' };
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: 'invalid' };

  const store = readStore();
  if (store.codes.some((c) => c.redeemedBy === userId)) {
    return { ok: false, reason: 'already_entitled' };
  }
  const target = store.codes.find((c) => c.code === code);
  if (!target) return { ok: false, reason: 'invalid' };
  if (target.redeemedBy) return { ok: false, reason: 'already_used' };

  target.redeemedBy = userId;
  target.redeemedAt = new Date().toISOString();
  writeStore(store);
  return { ok: true };
}

function seedOwnerEntitlement(userId, codeLabel = 'OWNER') {
  if (!userId) return false;
  const store = readStore();
  if (store.codes.some((c) => c.redeemedBy === userId)) return false;
  const now = new Date().toISOString();
  store.codes.push({ code: codeLabel, createdAt: now, redeemedBy: userId, redeemedAt: now });
  writeStore(store);
  return true;
}

module.exports = { generateCodes, listCodes, isEntitled, redeemCode, seedOwnerEntitlement };
