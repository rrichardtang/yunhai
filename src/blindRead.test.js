const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReport, labelFor } = require('../scripts/blindRead');

const activity = (name, extra = {}) => ({
  name,
  type: 'landmark',
  venue_name: `${name} Venue`,
  timing: { duration_minutes: 90, preferred_time: '09:00', opening_hours: '09:00-17:00' },
  cost: { estimated_usd: 10 },
  why_it_fits: `why ${name}`,
  pitfall: `pitfall ${name}`,
  insider_tips: `tip ${name}`,
  ...extra
});

const runs = [
  { arm: 'sonnet-4-6', run: 1, city: 'Lijiang', activities: [activity('Alpha')] },
  { arm: 'gpt-5.6', run: 1, city: 'Lijiang', activities: [activity('Beta')] },
  { arm: 'sonnet-4-6', run: 1, city: 'Shangri-La', activities: [activity('Gamma')] },
  { arm: 'gpt-5.6', run: 1, city: 'Shangri-La', activities: [activity('Delta')] }
];

test('the key matches the labels the lists were rendered under', () => {
  const report = buildReport(runs);
  for (const { arm, city, activities } of runs) {
    const label = labelFor(arm, city, ['gpt-5.6', 'sonnet-4-6']);
    assert.match(report, new RegExp(`### ${city} — list ${label}\\b`), `${city}/${arm} section`);
    assert.ok(report.includes(`- ${city} list ${label} = \`${arm}\``), `${city}/${arm} key line`);
    // The label must sit above the activity it actually introduces.
    const section = report.indexOf(`### ${city} — list ${label}`);
    const name = report.indexOf(activities[0].name, section);
    assert.ok(name > section && name - section < 600, `${activities[0].name} under its own heading`);
  }
});

test('an arm does not carry the same label across cities', () => {
  // Otherwise learning A in the first city unblinds every city after it.
  const arms = ['gpt-5.6', 'sonnet-4-6'];
  const perCity = ['Lijiang', 'Shangri-La'].map((city) => labelFor('sonnet-4-6', city, arms));
  assert.notEqual(perCity[0], perCity[1]);
});

test('the key comes after every list', () => {
  const report = buildReport(runs);
  assert.ok(report.indexOf('## Key') > report.lastIndexOf('### Shangri-La'));
});

test('a missing insider tip is called out rather than silently omitted', () => {
  const report = buildReport([
    { arm: 'a', run: 1, city: 'Lijiang', activities: [activity('Quiet', { insider_tips: null })] }
  ]);
  assert.match(report, /insider tip:\*\* _\(none returned\)_/);
});

test('meal count is stated per list, including zero', () => {
  const report = buildReport([
    { arm: 'a', run: 1, city: 'Lijiang', activities: [activity('Sight'), activity('Walk')] }
  ]);
  assert.match(report, /_0 meals in this list\._/);
});

test('--city narrows to one city', () => {
  const report = buildReport(runs, 'shangri');
  assert.ok(report.includes('## Shangri-La'));
  assert.ok(!report.includes('## Lijiang'));
});
