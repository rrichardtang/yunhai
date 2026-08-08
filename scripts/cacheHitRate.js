#!/usr/bin/env node
// Phase 1B step 0: what is the Places cache actually worth, before building for it.
//
//   node scripts/cacheHitRate.js
//
// Replays every venue name in data/bakeoff/ through each keying scheme and counts
// how many lookups a warm cache would have served. No API calls — the names are
// already on disk, so this costs nothing and decides whether the normalise and
// alias layers are worth writing.
const fs = require('fs');
const path = require('path');
const { normalize } = require('../src/services/placesCache');

const OUT_DIR = path.join(__dirname, '..', 'data', 'bakeoff');
const RESERVED = new Set(['results.json', 'brave-cassette.json']);

function loadLookups(dir) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.raw.json') && !RESERVED.has(f))
    .flatMap((file) => {
      const match = file.match(/^(.*)-run(\d+)-(.*)\.json$/);
      if (!match) return [];
      const city = match[3].replace(/_/g, ' ');
      return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
        // Mirrors placesQuery: venue_name when the model named one, else the
        // activity's own label.
        .map((a) => ({
          arm: match[1],
          city,
          query: String(a?.venue_name || '').trim() || String(a?.name || '').trim(),
          named: !!String(a?.venue_name || '').trim()
        }))
        .filter((l) => l.query);
    });
}

const exactKey = (l) => `${l.query.trim().toLowerCase()}|${l.city.trim().toLowerCase()}`;
const normalKey = (l) => `${normalize(l.query, l.city)}|${l.city.trim().toLowerCase()}`;

// Every lookup after the first for a given key is a hit a warm cache would serve.
function hits(lookups, keyOf) {
  const seen = new Set();
  let hit = 0;
  for (const lookup of lookups) {
    const key = keyOf(lookup);
    if (seen.has(key)) hit += 1;
    else seen.add(key);
  }
  return { hit, distinct: seen.size };
}

function report(lookups) {
  const total = lookups.length;
  const named = lookups.filter((l) => l.named);
  const unnamed = total - named.length;
  const exact = hits(lookups, exactKey);
  const normal = hits(lookups, normalKey);

  const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
  const lines = [
    `lookups: ${total}  (named venue ${named.length}, label-only ${unnamed})`,
    '',
    `exact key      hits ${String(exact.hit).padStart(4)}  ${pct(exact.hit).padStart(6)}   distinct ${exact.distinct}`,
    `normalised     hits ${String(normal.hit).padStart(4)}  ${pct(normal.hit).padStart(6)}   distinct ${normal.distinct}`,
    `  gained by normalising: ${normal.hit - exact.hit}`,
    '',
    // Skipping label-only lookups is Phase 1B item 3. They are the permanently
    // uncacheable population — the key is a sentence describing an activity.
    `label-only lookups, skippable: ${unnamed} (${pct(unnamed)} of all calls)`,
    `named-venue lookups after skipping: ${named.length}`
  ];

  const namedExact = hits(named, exactKey);
  const namedNormal = hits(named, normalKey);
  lines.push(
    `  of those, exact-key hits ${namedExact.hit}, normalised ${namedNormal.hit}`,
    '',
    'Pairs that only normalisation collapses (the layer\'s whole value):'
  );
  const byNormal = new Map();
  for (const lookup of lookups) {
    const key = normalKey(lookup);
    if (!byNormal.has(key)) byNormal.set(key, new Set());
    byNormal.get(key).add(lookup.query);
  }
  const collapsed = [...byNormal.values()].filter((forms) => forms.size > 1);
  for (const forms of collapsed.slice(0, 15)) lines.push(`  ${[...forms].join('  ==  ')}`);
  if (!collapsed.length) lines.push('  (none — normalisation buys nothing on this data)');
  return lines.join('\n');
}

if (require.main === module) {
  const lookups = loadLookups(OUT_DIR);
  if (!lookups.length) {
    console.error(`No activity lists in ${OUT_DIR}. Run the bake-off first.`);
    process.exit(1);
  }
  console.log(report(lookups));
}

module.exports = { loadLookups, hits, report, exactKey, normalKey };
