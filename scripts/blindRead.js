#!/usr/bin/env node
// Renders the bake-off's saved activity lists for human judgement.
//
//   node scripts/blindRead.js [--city Lijiang]
//
// The table scores what can be counted: whether a venue exists, how many
// distinct ones, how fast, how much. It cannot score whether an activity suits
// this traveller, whether a pitfall is real or a platitude, or whether an
// insider tip is local knowledge. That needs reading, and reading is biased by
// knowing which model wrote what — so arms are relabelled A/B/C and the key is
// held to the end of the file.
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'data', 'bakeoff');
const RESERVED = new Set(['results.json', 'brave-cassette.json']);

// Label per (arm, city) rather than per arm, so learning A in one city tells you
// nothing about A in the next.
function labelFor(arm, city, arms) {
  const score = (name) => {
    let h = 0;
    for (const ch of `${name}|${city}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
  };
  const order = [...arms].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
  return String.fromCharCode(65 + order.indexOf(arm));
}

// Two producers write activity lists here. The bake-off writes
// `<arm>-run<N>-<city>.json`; the prompt eval writes
// `eval-<scenario>-<baseline|candidate>.json`. Both are worth reading blind, and
// the eval's are the only unlabelled output available for a second human review
// — which is the one thing that would let the harness claim more than a single
// adjudication. Chat evals hold an object rather than a list, so they are
// excluded by name and by shape.
function parseFilename(file) {
  const bakeoff = file.match(/^(.*)-run(\d+)-(.*)\.json$/);
  if (bakeoff) return { arm: bakeoff[1], run: Number(bakeoff[2]), city: bakeoff[3].replace(/_/g, ' ') };

  const promptEval = file.match(/^eval-(?!chat-)(.+)-(baseline|candidate)\.json$/);
  if (promptEval) return { arm: promptEval[2], run: 1, city: promptEval[1] };

  return null;
}

function loadRuns(dir = OUT_DIR) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.raw.json') && !RESERVED.has(f))
    .map((file) => {
      const parsed = parseFilename(file);
      if (!parsed) return null;
      const activities = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (!Array.isArray(activities)) return null;
      return { ...parsed, activities };
    })
    .filter(Boolean);
}

const minutesToHours = (m) => (Number.isFinite(m) ? `${(m / 60).toFixed(1)}h` : '?');

function renderActivity(activity, index) {
  const cost = activity?.cost?.estimated_usd;
  const lines = [
    `**${index + 1}. ${activity.name}**  ·  ${activity.type || 'untyped'}`,
    `- venue: ${activity.venue_name || '_(none — unstructured by design)_'}`,
    `- ${activity?.timing?.preferred_time || 'no preferred time'} · ${minutesToHours(activity?.timing?.duration_minutes)} · ${Number.isFinite(cost) ? `$${cost}` : 'no cost'} · hours ${activity?.timing?.opening_hours || '—'}`
  ];
  const field = (label, value) => {
    if (value) lines.push(`- **${label}:** ${String(value).replace(/\s+/g, ' ').trim()}`);
  };
  field('why it fits', activity.why_it_fits);
  field('pitfall', activity.pitfall);
  field('insider tip', activity.insider_tips);
  field('smarter alternative', activity.smarter_alternative);
  if (!activity.insider_tips) lines.push('- **insider tip:** _(none returned)_');
  return lines.join('\n');
}

function buildReport(runs, cityFilter = null) {
  const cities = [...new Set(runs.map((r) => r.city))].filter((c) => !cityFilter || c.toLowerCase().includes(cityFilter.toLowerCase()));
  const arms = [...new Set(runs.map((r) => r.arm))].sort();
  const out = ['# Blind activity read', ''];
  out.push('Judge fit, specificity, and whether the tips are real local knowledge. Ignore counts —');
  out.push('the table already covers those. The key is at the bottom; read first, look after.');
  const key = [];

  for (const city of cities) {
    out.push('', `## ${city}`, '');
    const forCity = runs.filter((r) => r.city === city).sort((a, b) => a.run - b.run);
    const labelled = forCity
      .map((r) => ({ ...r, label: labelFor(r.arm, city, arms) }))
      .sort((a, b) => a.label.localeCompare(b.label) || a.run - b.run);

    for (const entry of labelled) {
      const suffix = forCity.filter((r) => r.arm === entry.arm).length > 1 ? ` (run ${entry.run})` : '';
      const count = entry.activities.length;
      out.push(`### ${city} — list ${entry.label}${suffix}  ·  ${count} activit${count === 1 ? 'y' : 'ies'}`, '');
      const meals = entry.activities.filter((a) => a.type === 'meal').length;
      out.push(`_${meals} meal${meals === 1 ? '' : 's'} in this list._`, '');
      out.push(entry.activities.map(renderActivity).join('\n\n'), '');
      key.push(`- ${city} list ${entry.label}${suffix} = \`${entry.arm}\``);
    }
  }

  out.push('', '---', '', '## Key — read the lists first', '', ...key.sort(), '');
  return out.join('\n');
}

if (require.main === module) {
  const arg = (flag) => {
    const index = process.argv.indexOf(flag);
    return index === -1 ? null : process.argv[index + 1];
  };

  const runs = loadRuns();
  if (!runs.length) {
    console.error(`No activity lists in ${OUT_DIR}. Run the bake-off or scripts/evalPlan.js first.`);
    process.exit(1);
  }

  const report = buildReport(runs, arg('--city'));
  const dest = path.join(OUT_DIR, arg('--out') || 'blind-read.md');

  // blind-read.md holds the 2026-08-08 adjudication, which is the only human
  // ground truth the eval harness has and lives in gitignored data/. Silently
  // regenerating over it would destroy the labels every check is validated
  // against, so overwriting is refused rather than merely warned about.
  if (fs.existsSync(dest) && !process.argv.includes('--force')) {
    console.error(`${path.relative(process.cwd(), dest)} already exists — refusing to overwrite.`);
    console.error('It may hold a human adjudication that cannot be regenerated. Pass --out <name>.md');
    console.error('to write elsewhere, or --force if you are certain it is disposable.');
    process.exit(1);
  }

  fs.writeFileSync(dest, report);
  const scenarios = [...new Set(runs.map((r) => r.city))];
  console.log(`${runs.length} list(s) across ${scenarios.length} scenario(s) → ${path.relative(process.cwd(), dest)}`);
  console.log('Arms are relabelled per scenario; the key is at the bottom. Read first, look after.');
}

module.exports = { buildReport, loadRuns, labelFor, renderActivity };
