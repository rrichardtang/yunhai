const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'userdata.json');

function ensureStoreFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, '{}');
}

function readStore() {
  ensureStoreFile();
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  ensureStoreFile();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function getUserData(userId) {
  if (!userId) return null;
  const store = readStore();
  return store[userId] || null;
}

function setUserData(userId, data) {
  if (!userId) return null;
  const store = readStore();
  store[userId] = { ...(store[userId] || {}), ...data, updatedAt: new Date().toISOString() };
  writeStore(store);
  return store[userId];
}

function getUserField(userId, field) {
  const data = getUserData(userId);
  return data?.[field] ?? null;
}

function setUserField(userId, field, value) {
  if (!userId || !field) return null;
  const store = readStore();
  if (!store[userId]) store[userId] = {};
  store[userId][field] = value;
  store[userId].updatedAt = new Date().toISOString();
  writeStore(store);
  return value;
}

module.exports = { getUserData, setUserData, getUserField, setUserField };
