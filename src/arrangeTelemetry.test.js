const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { logRun, readRecent, summarize } = require('./services/arrangeTelemetry');

const LOG_PATH = path.join(__dirname, '..', 'logs', 'arrange.jsonl');

test('logRun creates the log file and readRecent returns the entry', async () => {
  const hadFile = fs.existsSync(LOG_PATH);
  const before = hadFile ? fs.readFileSync(LOG_PATH, 'utf8') : null;

  logRun({ userId: 'u1', cityName: 'Kyoto', flexibleCount: 10, placedCount: 9, unplacedCount: 1, mealRedistributed: 1, droppedByReason: { no_time_slot_remaining: 1 } });
  assert.ok(fs.existsSync(LOG_PATH), 'log file created');
  const runs = await readRecent(5);
  const entry = runs[runs.length - 1];
  assert.equal(entry.cityName, 'Kyoto');
  assert.ok(entry.ts, 'timestamp attached');

  const summary = summarize([entry]);
  assert.equal(summary.total, 1);
  assert.equal(summary.placedPct, 90);
  assert.equal(summary.droppedByReason.no_time_slot_remaining, 1);

  if (before === null) fs.rmSync(LOG_PATH);
  else fs.writeFileSync(LOG_PATH, before);
});
