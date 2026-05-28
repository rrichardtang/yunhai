const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const memory = require('./memory');
const store = require('./memory/store');
const prefs = require('./preferences');

const USERS_DIR = path.join(__dirname, '..', 'data', 'users');

let counter = 0;
function freshUser() {
  return `memtest_${Date.now()}_${counter++}`;
}

function cleanup(userId) {
  const resolved = prefs.resolveUserId(userId);
  for (const p of [path.join(store.MEMORY_DIR, `${resolved}.json`), path.join(USERS_DIR, `${resolved}.json`)]) {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }
}

test('recall is empty for an unknown user', () => {
  const u = freshUser();
  try {
    const r = memory.recall({ userId: u });
    assert.equal(r.text, '');
    assert.deepEqual(r.records, []);
  } finally { cleanup(u); }
});

test('store add/update/remove round-trips', () => {
  const u = freshUser();
  const resolved = prefs.resolveUserId(u);
  try {
    const rec = store.add(resolved, { text: 'likes museums', type: 'preference', scope: 'user' });
    assert.ok(rec.id.startsWith('mem_'));
    assert.equal(store.loadAll(resolved).length, 1);
    store.update(resolved, rec.id, { text: 'loves modern art museums' });
    assert.equal(store.loadAll(resolved)[0].text, 'loves modern art museums');
    assert.equal(store.remove(resolved, rec.id), true);
    assert.equal(store.loadAll(resolved).length, 0);
  } finally { cleanup(u); }
});

test('computeRecords applies ADD / UPDATE / DELETE / NOOP', () => {
  const u = freshUser();
  const resolved = prefs.resolveUserId(u);
  try {
    const seafood = store.add(resolved, { text: 'loves seafood', type: 'preference', scope: 'user' });
    const early = store.add(resolved, { text: 'fine with early mornings', type: 'constraint', scope: 'user' });
    const existing = store.loadAll(resolved);
    const ops = [
      { op: 'UPDATE', id: seafood.id, text: 'is vegetarian — no seafood', type: 'preference', scope: 'user' },
      { op: 'DELETE', id: early.id },
      { op: 'ADD', text: 'wants a quiet anniversary dinner', type: 'preference', scope: 'trip' },
      { op: 'NOOP', text: 'running late today' }
    ];
    const next = memory.computeRecords(existing, ops, { tripId: 'it_x', source: 'chat' });
    const texts = next.map((r) => r.text);
    assert.ok(texts.includes('is vegetarian — no seafood'));
    assert.ok(!texts.includes('loves seafood'));
    assert.ok(!texts.includes('fine with early mornings'));
    assert.ok(!texts.includes('running late today'));
    const added = next.find((r) => r.text.includes('anniversary'));
    assert.equal(added.scope, 'trip');
    assert.equal(added.tripId, 'it_x');
  } finally { cleanup(u); }
});

test('recall merges user + matching trip scope only', () => {
  const u = freshUser();
  const resolved = prefs.resolveUserId(u);
  try {
    store.add(resolved, { text: 'durable: prefers boutique hotels', type: 'preference', scope: 'user' });
    store.add(resolved, { text: 'this trip: celebrating a birthday', type: 'preference', scope: 'trip', tripId: 'it_1' });
    store.add(resolved, { text: 'other trip note', type: 'preference', scope: 'trip', tripId: 'it_2' });

    const noTrip = memory.recall({ userId: u }).records.map((r) => r.text);
    assert.deepEqual(noTrip, ['durable: prefers boutique hotels']);

    const withTrip = memory.recall({ userId: u, tripId: 'it_1' }).records.map((r) => r.text).sort();
    assert.deepEqual(withTrip, ['durable: prefers boutique hotels', 'this trip: celebrating a birthday'].sort());
    assert.ok(!withTrip.includes('other trip note'));

    const userScopeOnly = memory.recall({ userId: u, tripId: 'it_1', scope: 'user' }).records.map((r) => r.text);
    assert.deepEqual(userScopeOnly, ['durable: prefers boutique hotels']);
  } finally { cleanup(u); }
});

test('recall ranks query-relevant records ahead of the rest', () => {
  const u = freshUser();
  const resolved = prefs.resolveUserId(u);
  try {
    store.add(resolved, { text: 'enjoys hiking and trails', type: 'preference', scope: 'user', keywords: ['hiking'] });
    store.add(resolved, { text: 'enjoys fine dining', type: 'preference', scope: 'user', keywords: ['dining'] });
    const ranked = memory.recall({ userId: u, query: 'best hiking near the city' }).records;
    assert.match(ranked[0].text, /hiking/);
  } finally { cleanup(u); }
});

test('preferences facade migrates legacy arrays into the store once', () => {
  const u = freshUser();
  const resolved = prefs.resolveUserId(u);
  try {
    fs.mkdirSync(USERS_DIR, { recursive: true });
    fs.writeFileSync(path.join(USERS_DIR, `${resolved}.json`), JSON.stringify({
      profileInstruction: 'Legacy traveler.',
      preferences: [{ text: 'likes street food', ts: 1700000000 }],
      constraints: [{ text: 'no red-eye flights', ts: 1700000001 }]
    }));

    const loaded = prefs.load(u);
    assert.equal(loaded.profileInstruction, 'Legacy traveler.');
    assert.deepEqual(loaded.preferences.map((p) => p.text), ['likes street food']);
    assert.deepEqual(loaded.constraints.map((c) => c.text), ['no red-eye flights']);

    const records = store.loadAll(resolved);
    assert.equal(records.length, 2);
    assert.ok(records.every((r) => r.scope === 'user'));

    // getSummary reflects migrated data and profileInstruction.
    const summary = prefs.getSummary(u);
    assert.match(summary, /Legacy traveler\./);
    assert.match(summary, /likes street food/);
    assert.match(summary, /no red-eye flights/);
  } finally { cleanup(u); }
});

test('save() diff-sync removes dropped entries and keeps the rest', () => {
  const u = freshUser();
  const resolved = prefs.resolveUserId(u);
  try {
    prefs.recordPreference(u, 'A');
    prefs.recordPreference(u, 'B');
    prefs.save({ preferences: [{ text: 'A' }], constraints: [], profileInstruction: 'P' }, u);
    const loaded = prefs.load(u);
    assert.deepEqual(loaded.preferences.map((p) => p.text), ['A']);
    assert.equal(loaded.profileInstruction, 'P');
  } finally { cleanup(u); }
});

test('reset clears profile and all records', () => {
  const u = freshUser();
  try {
    prefs.recordPreference(u, 'something');
    prefs.save({ profileInstruction: 'x' }, u);
    prefs.reset(u);
    const loaded = prefs.load(u);
    assert.equal(loaded.profileInstruction, '');
    assert.deepEqual(loaded.preferences, []);
    assert.deepEqual(loaded.constraints, []);
  } finally { cleanup(u); }
});
