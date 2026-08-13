#!/usr/bin/env node
// Runs src/evalChecks.js over saved bake-off lists and prints what fires.
//
//   node scripts/checkFixtures.js                        # committed fixtures
//   node scripts/checkFixtures.js data/bakeoff/*.json    # anything on disk
//
// The point is held-out validation. The checks were written while reading the
// sonnet-4-6 and gpt-5.6+lean lists, so those two arms cannot test them —
// reproducing findings you designed against is circular. The same 2026-08-08
// blind read also adjudicated the two gpt-5.6 arms and judged them acceptable,
// and no check was ever tuned on them. A finding there is a false positive
// against a human label, which is the only kind of evidence that counts here.
const fs = require('fs');
const path = require('path');

const { runChecks } = require('../src/evalChecks');

const FIXTURE_DIR = path.join(__dirname, '..', 'evals', 'fixtures');

// The bake-off trip both cities came from. A list is scored as the city its
// filename names, with the other city as the one the traveler also stays in.
const CITIES = {
  Lijiang: { name: 'Lijiang, Yunnan, China', startDate: '2026-10-08', endDate: '2026-10-13' },
  'Shangri-La_City': { name: 'Shangri-La City, Diqing Tibetan Autonomous Prefecture, Yunnan, China', startDate: '2026-10-13', endDate: '2026-10-17' }
};

const OWNER_PROFILE = {
  answers: {
    pace: 3, foodTravel: 5, outdoorNature: 5, shoppingPerson: 4,
    museumPerson: 2, livePerformances: 2, structuredTours: 1, nightlifeBars: 1
  }
};

// What the human read concluded per arm, so a run says whether the checks agree
// rather than leaving the reader to remember. changelog [2026-08-08].
const HUMAN_VERDICT = {
  'sonnet-4-6': 'REJECTED — 12 tours, repeated meal venues, cross-city day trip',
  'gpt-5.6+lean': 'CLEARED — none of the above',
  'gpt-5.6': 'acceptable — 5 museums, 0 tours; the read said museums were never the problem',
  'gpt-5.6+gpt': 'acceptable — 0 museums, 0 tours'
};

const TUNED_ON = new Set(['sonnet-4-6', 'gpt-5.6+lean']);

function parseName(file) {
  const match = path.basename(file).match(/^(.*)-run(\d+)-(.*)\.json$/);
  if (!match) return null;
  return { arm: match[1], city: match[3] };
}

function scenarioFor(cityKey) {
  const city = CITIES[cityKey];
  if (!city) return null;
  const other = Object.values(CITIES).find((c) => c.name !== city.name);
  return { city, otherCities: [{ name: other.name }], profile: OWNER_PROFILE };
}

function main() {
  const args = process.argv.slice(2);
  const files = args.length
    ? args
    : fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(FIXTURE_DIR, f));

  const rows = [];
  for (const file of files) {
    const parsed = parseName(file);
    const scenario = parsed && scenarioFor(parsed.city);
    if (!scenario) {
      console.log(`skipped ${path.basename(file)} — not a <arm>-run<N>-<city>.json list from the bake-off trip`);
      continue;
    }

    const activities = JSON.parse(fs.readFileSync(file, 'utf8'));
    const { findings } = runChecks(activities, scenario);
    const high = findings.filter((f) => f.severity === 'high');
    rows.push({ ...parsed, count: activities.length, findings, high: high.length });

    const heldOut = TUNED_ON.has(parsed.arm) ? '' : '   [HELD OUT — no check was tuned on this arm]';
    console.log(`\n=== ${parsed.arm} / ${parsed.city} — ${activities.length} activities, ${findings.length} findings (${high.length} high)${heldOut}`);
    console.log(`    human read: ${HUMAN_VERDICT[parsed.arm] || 'not adjudicated'}`);
    for (const f of findings) console.log(`    [${f.severity}] ${f.check}: ${f.detail}`);
    if (!findings.length) console.log('    (clean)');
  }

  const heldOut = rows.filter((r) => !TUNED_ON.has(r.arm));
  if (!heldOut.length) return;

  const falsePositives = heldOut.filter((r) => r.high > 0);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Held-out arms: ${heldOut.length} list(s) the checks were never tuned against.`);
  console.log(falsePositives.length
    ? `FALSE POSITIVES: ${falsePositives.map((r) => `${r.arm}/${r.city} (${r.high} high)`).join(', ')}\n`
      + 'The human read judged these arms acceptable, so a high-severity finding here is the\n'
      + 'checks disagreeing with the label. Fix the threshold before trusting a verdict.'
    : 'No high-severity findings on any held-out arm — the checks agree with the human label\n'
      + 'on lists they were never shaped by.');
}

main();
