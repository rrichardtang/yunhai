const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
process.env.CLERK_SECRET_KEY = 'sk_test';
process.env.CLERK_PUBLISHABLE_KEY = 'pk_test';
process.env.OWNER_USER_ID = 'user_owner';

const OUT_DIR = path.join(__dirname, '..', 'data', 'bakeoff');

// requireOwner compares getAuthedUserId(req) to OWNER_USER_ID, so a stubbed
// req.auth is enough to exercise both the allowed and denied paths.
function appAs(userId) {
  const express = require('express');
  const stub = express();
  stub.use((req, _res, next) => { req.auth = () => ({ userId }); next(); });
  stub.use(require('./server'));
  return stub;
}

// A real bake-off run costs API spend, so this must never clobber one: if the
// directory already exists it is moved aside and restored, not deleted.
const STASH = `${OUT_DIR}.teststash`;
let dirPreexisted = false;

test.before(() => {
  dirPreexisted = fs.existsSync(OUT_DIR);
  if (dirPreexisted) fs.renameSync(OUT_DIR, STASH);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), '# planCity bake-off\n\n| arm | resolved% |\n');
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), '[{"arm":"sonnet-4-6"}]');
  fs.writeFileSync(path.join(OUT_DIR, 'sonnet-4-6-run1-Lijiang.json'), '[{"name":"Black Dragon Pool Park"}]');
});

test.after(() => {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  if (dirPreexisted) fs.renameSync(STASH, OUT_DIR);
});

test('the owner sees the report and a listing of activity lists', async () => {
  const res = await request(appAs('user_owner')).get('/debug/bakeoff');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/plain/);
  assert.match(res.text, /planCity bake-off/);
  assert.match(res.text, /\/debug\/bakeoff\?file=sonnet-4-6-run1-Lijiang\.json/);
  // The cassette and the raw rows are not blind-read material.
  assert.doesNotMatch(res.text, /brave-cassette/);
});

test('a named activity list is served as JSON', async () => {
  const res = await request(appAs('user_owner')).get('/debug/bakeoff?file=sonnet-4-6-run1-Lijiang');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /application\/json/);
  assert.match(res.text, /Black Dragon Pool Park/);
});

test('an arm label containing "+" is reachable from the listing', async () => {
  // "+" decodes to a space in a query string, so the endpoint was printing links
  // for gpt-5.6+lean that it then could not resolve itself.
  const name = 'gpt-5.6+lean-run1-Lijiang.json';
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify([{ name: 'Wenhai Trek' }]));

  const listing = await request(appAs('user_owner')).get('/debug/bakeoff');
  assert.match(listing.text, /file=gpt-5\.6%2Blean-run1-Lijiang\.json/, 'listing encodes the +');

  for (const query of [encodeURIComponent(name), name]) {
    const res = await request(appAs('user_owner')).get(`/debug/bakeoff?file=${query}`);
    assert.equal(res.status, 200, `expected 200 for ${query}`);
    assert.match(res.text, /Wenhai Trek/);
  }
  fs.rmSync(path.join(OUT_DIR, name));
});

test('a non-owner cannot read bake-off results', async () => {
  const res = await request(appAs('user_someone_else')).get('/debug/bakeoff');
  assert.equal(res.status, 403);
});

test('path traversal finds no entry rather than escaping the directory', async () => {
  const attempts = [
    '../../.env',
    '../../package.json',
    '..%2f..%2fpackage.json',
    '/etc/passwd',
    'report.md/../../../package.json'
  ];
  for (const file of attempts) {
    const res = await request(appAs('user_owner')).get(`/debug/bakeoff?file=${encodeURIComponent(file)}`);
    assert.equal(res.status, 404, `expected 404 for ${file}`);
    assert.doesNotMatch(res.text, /travelplanner|dependencies/);
  }
});

test('a missing bake-off directory says how to produce one', async () => {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  const res = await request(appAs('user_owner')).get('/debug/bakeoff');
  assert.equal(res.status, 404);
  assert.match(res.text, /planCityBakeoff/);
  fs.mkdirSync(OUT_DIR, { recursive: true });
});
