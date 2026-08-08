#!/usr/bin/env node
// Post-deploy check for the Places layer. Makes ~3 real API calls.
//
//   node scripts/smokePlaces.js [--city Lijiang]
//
// Unit tests cover this against a stub, which cannot catch a field mask Google
// rejects. A venue-less activity asks for the coordinate alone, so a malformed
// minimal mask silently costs every district walk its map pin — worth three calls
// to rule out before spending a bake-off run on it.
require('dotenv').config();

const { enrichWithPlaceDetails } = require('../src/services/placesEnrich');

const CITIES = {
  Lijiang: { center: { lat: 26.8721, lng: 100.2299 }, venue: 'Mu Family Mansion', label: 'Dayan Back-Lane Walk' },
  'Shangri-La': { center: { lat: 27.8269, lng: 99.7065 }, venue: 'Ganden Sumtseling Monastery', label: 'Dukezong Backstreets at Dawn' }
};

async function main() {
  const arg = process.argv.indexOf('--city');
  const cityName = arg === -1 ? 'Lijiang' : process.argv[arg + 1];
  const city = CITIES[cityName];
  if (!city) {
    console.error(`Unknown city ${cityName}. Available: ${Object.keys(CITIES).join(', ')}`);
    process.exit(1);
  }

  const named = { name: city.venue, venue_name: `${city.venue}, ${cityName}`, type: 'landmark', timing: {} };
  const unnamed = { name: city.label, venue_name: null, type: 'neighborhood', timing: { opening_hours: '' } };
  await enrichWithPlaceDetails([named, unnamed], cityName, city.center);

  const show = (a) => [
    `  ${a.name}`,
    `    coords ${a.location?.lat ?? 'MISSING'}, ${a.location?.lng ?? 'MISSING'}`,
    `    hours  ${JSON.stringify(a.timing?.opening_hours || '')}`,
    `    photo  ${a.imageUrl ? 'yes' : 'no'}`
  ].join('\n');

  console.log(`named venue (full lookup)\n${show(named)}`);
  console.log(`venue-less (minimal lookup)\n${show(unnamed)}`);

  const checks = [
    [Number.isFinite(Number(named.location?.lat)), 'named venue resolved a coordinate'],
    [!!named.imageUrl, 'named venue got a Places photo'],
    [Number.isFinite(Number(unnamed.location?.lat)), 'venue-less activity still got a coordinate'],
    [!unnamed.imageUrl, 'venue-less activity got NO Places photo (falls through to the city pool)'],
    [!unnamed.timing?.opening_hours, 'venue-less activity got NO Places hours (a district gate is not its window)']
  ];
  let failed = 0;
  console.log('');
  for (const [ok, label] of checks) {
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  }
  process.exit(failed ? 1 : 0);
}

main();
