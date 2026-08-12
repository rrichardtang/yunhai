const test = require('node:test');
const assert = require('node:assert/strict');
const {
  runChecks,
  typeMixVsProfile,
  repeatedVenues,
  venueCityMismatch,
  crossCityDayTrips,
  selfContradictingPitfall,
  mealCoverage
} = require('./evalChecks');

// Every fixture below is the shape of a defect the 2026-08-08 blind read found
// by hand in the Sonnet 4.6 arm, paired with the gpt-5.6+lean shape that did not
// have it. A check that cannot separate those two pairs is not worth running.
const OWNER_PROFILE = {
  answers: {
    pace: 3, foodTravel: 5, outdoorNature: 5, shoppingPerson: 4,
    museumPerson: 2, livePerformances: 2, structuredTours: 1, nightlifeBars: 1
  }
};

const act = (name, overrides = {}) => ({
  name,
  city: 'Shangri-La City',
  venue_name: name,
  type: 'landmark',
  why_it_fits: '',
  pitfall: '',
  ...overrides
});

const findingsFor = (all, check) => all.filter((f) => f.check === check);

test('12 tours against structuredTours 1/5 is caught; zero tours is not', () => {
  // The real Sonnet list: Impression Lijiang, Naxi Ancient Music, Thangka
  // Workshop, Butter Tea Ceremony, Pu'er Tea Tasting and friends, all typed tour.
  const sonnet = Array.from({ length: 12 }, (_, i) => act(`Tour ${i}`, { type: 'tour' }))
    .concat(Array.from({ length: 21 }, (_, i) => act(`Sight ${i}`)));
  const lean = Array.from({ length: 33 }, (_, i) => act(`Sight ${i}`));

  const hit = findingsFor(typeMixVsProfile(sonnet, OWNER_PROFILE), 'typeMixVsProfile')
    .find((f) => f.detail.includes('structuredTours'));
  assert.ok(hit, 'expected a structuredTours finding');
  assert.match(hit.detail, /12 guided tours against structuredTours 1\/5/);

  const clean = typeMixVsProfile(lean, OWNER_PROFILE).find((f) => f.detail.includes('structuredTours'));
  assert.equal(clean, undefined);
});

test('an Evening Bar Crawl against nightlifeBars 1/5 is caught by wording', () => {
  // filterInvalidTypes drops type:nightlife, so a bar crawl always arrives typed
  // as something else. Matching the type alone would never have seen this one.
  const list = [
    act('Evening Bar Crawl', { type: 'neighborhood' }),
    act('Old Town Pub Route', { type: 'neighborhood' }),
    ...Array.from({ length: 10 }, (_, i) => act(`Sight ${i}`))
  ];
  const hit = typeMixVsProfile(list, OWNER_PROFILE).find((f) => f.detail.includes('nightlifeBars'));
  assert.ok(hit);
  assert.deepEqual(hit.names, ['Evening Bar Crawl', 'Old Town Pub Route']);
});

test('the over-correction case: a 5/5 museum traveler getting no museums', () => {
  // This is the failure a future prompt edit is most likely to introduce, and
  // the reason the check is symmetric rather than a one-sided "too many" rule.
  const museumLover = { answers: { museumPerson: 5, structuredTours: 4, foodTravel: 3 } };
  const noMuseums = Array.from({ length: 18 }, (_, i) => act(`Walk ${i}`, { type: 'neighborhood' }));

  const hit = typeMixVsProfile(noMuseums, museumLover).find((f) => f.detail.includes('museumPerson'));
  assert.ok(hit);
  assert.match(hit.detail, /no museums against museumPerson 5\/5/);

  const withMuseums = [...noMuseums, act('Kunsthistorisches', { type: 'museum' })];
  assert.equal(
    typeMixVsProfile(withMuseums, museumLover).find((f) => f.detail.includes('museumPerson')),
    undefined
  );
});

test('7 meals across 4 restaurants is caught — Compass 3x, Xiaocai 2x', () => {
  const meal = (venue) => act(venue, { type: 'meal', venue_name: venue });
  const sonnet = [
    meal('Compass'), meal('Compass'), meal('Compass'),
    meal('Xiaocai'), meal('Xiaocai'),
    meal('Flying Tiger'), meal('Tara Gallery Cafe')
  ];

  const findings = repeatedVenues(sonnet);
  assert.equal(findings.length, 2);
  assert.ok(findings.every((f) => f.severity === 'high'), 'repeated meals are high severity');
  assert.match(findings[0].detail, /"Compass" used 3x \(3 of them meals\)/);

  // The lean arm's 12 Lijiang meals across 12 distinct restaurants.
  const lean = ['Zhang', 'Li', 'Wang', 'Chen'].map(meal);
  assert.deepEqual(repeatedVenues(lean), []);
});

test('a venue-less meal spelled "Name, City" does not read as a duplicate', () => {
  // normalizeActivity writes venue_name as `${name}, ${city}` when the model
  // gave no venue, so the city has to come off before comparing.
  const list = [
    act('Naxi Kitchen', { type: 'meal', venue_name: 'Naxi Kitchen, Lijiang', city: 'Lijiang' }),
    act('Naxi Kitchen', { type: 'meal', venue_name: 'Naxi Kitchen', city: 'Lijiang' })
  ];
  const findings = repeatedVenues(list);
  assert.equal(findings.length, 1, 'the same restaurant twice is still one finding');
});

test('Tiger Leaping Gorge filed under Shangri-La with venue city Lijiang', () => {
  // Places snapped this to a plausible coordinate, so it scored as a clean
  // resolve and every existing column missed it.
  const list = [
    act('Tiger Leaping Gorge Hike', { city: 'Lijiang' }),
    act('Songzanlin Monastery', { city: 'Shangri-La City' })
  ];
  const findings = venueCityMismatch(list, 'Shangri-La City, Diqing Tibetan Autonomous Prefecture, Yunnan, China');
  assert.equal(findings.length, 1);
  assert.match(findings[0].detail, /filed under Lijiang, list is Shangri-La City/);
});

test('a cross-city day trip to a city the traveler moves to later', () => {
  // The trip carries the full "Shangri-La City, Diqing..." string; the activity
  // says "Shangri-La". The check has to bridge that or it never fires.
  const lijiangList = [
    act('Lijiang to Shangri-La Scenic Drive (Day Trip)', { city: 'Lijiang' }),
    act('Black Dragon Pool Park', { city: 'Lijiang' })
  ];
  const otherCities = [{ name: 'Shangri-La City, Diqing Tibetan Autonomous Prefecture, Yunnan, China' }];

  const findings = crossCityDayTrips(lijiangList, otherCities);
  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0].names, ['Lijiang to Shangri-La Scenic Drive (Day Trip)']);

  assert.deepEqual(crossCityDayTrips([act('Black Dragon Pool Park')], otherCities), []);
});

test('an activity whose own pitfall argues against doing it', () => {
  // Both real: Meili Snow Mountain "requires an overnight stay in Deqin", and
  // the gorge entry whose pitfall calls the single-day version brutal.
  const list = [
    act('Meili Snow Mountain', { pitfall: 'Requires an overnight stay in Deqin to see sunrise.' }),
    act('Tiger Leaping Gorge', { pitfall: 'The single-day version is brutal.' }),
    act('Songzanlin Monastery', { pitfall: 'Arrive before 10am to avoid tour buses.' })
  ];
  const findings = selfContradictingPitfall(list);
  assert.deepEqual(findings.map((f) => f.names[0]), ['Meili Snow Mountain', 'Tiger Leaping Gorge']);
  assert.match(findings[0].detail, /needs an overnight stay/);
});

test('zero meals for a 6-day stay is high severity, not an empty column', () => {
  // applyMealPoolCap deleted all 12 of GPT-5.6's Lijiang restaurants and the
  // report rendered it as "the model returned no meals".
  const noMeals = Array.from({ length: 20 }, (_, i) => act(`Sight ${i}`));
  const [finding] = mealCoverage(noMeals, 6);
  assert.equal(finding.severity, 'high');
  assert.match(finding.detail, /0 meals for a 6-day stay/);

  const withMeals = [...noMeals, ...Array.from({ length: 11 }, (_, i) => act(`Meal ${i}`, { type: 'meal' }))];
  assert.deepEqual(mealCoverage(withMeals, 6), []);
});

test('runChecks over a whole scenario reports each defect once, keyed by check', () => {
  const scenario = {
    id: 'owner-yunnan',
    city: { name: 'Shangri-La City, Diqing, Yunnan, China', startDate: '2026-10-13', endDate: '2026-10-17' },
    otherCities: [{ name: 'Lijiang, Yunnan, China' }],
    profile: OWNER_PROFILE
  };
  const activities = [
    ...Array.from({ length: 12 }, (_, i) => act(`Tour ${i}`, { type: 'tour' })),
    act('Compass', { type: 'meal', venue_name: 'Compass' }),
    act('Compass', { type: 'meal', venue_name: 'Compass' }),
    act('Meili Snow Mountain', { pitfall: 'Requires an overnight stay in Deqin.' })
  ];

  const { byCheck, total } = runChecks(activities, scenario);
  assert.equal(byCheck.repeatedVenues, 1);
  assert.equal(byCheck.selfContradictingPitfall, 1);
  assert.ok(byCheck.typeMixVsProfile >= 1);
  assert.equal(total, Object.values(byCheck).reduce((a, b) => a + b, 0));
});

test('a clean list produces no findings at all', () => {
  const scenario = {
    city: { name: 'Vienna, Austria', startDate: '2026-05-01', endDate: '2026-05-03' },
    profile: { answers: { museumPerson: 5, foodTravel: 4, structuredTours: 3 } }
  };
  const activities = [
    act('Kunsthistorisches Museum', { city: 'Vienna', type: 'museum' }),
    act('Naschmarkt Lunch', { city: 'Vienna', type: 'meal', venue_name: 'Naschmarkt Deli' }),
    act('Figlmuller', { city: 'Vienna', type: 'meal', venue_name: 'Figlmuller' }),
    act('Cafe Central', { city: 'Vienna', type: 'meal', venue_name: 'Cafe Central' }),
    act('Belvedere', { city: 'Vienna', type: 'museum' }),
    act('Stadtpark Walk', { city: 'Vienna', type: 'neighborhood' })
  ];
  assert.deepEqual(runChecks(activities, scenario).findings, []);
});
