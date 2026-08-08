const test = require('node:test');
const assert = require('node:assert/strict');
const { planCity } = require('./claude');

const CITY = {
  name: 'Lijiang, Yunnan, China',
  startDate: '2026-10-08',
  endDate: '2026-10-13',
  accommodation: { address: '' }
};

const meal = (name, opening_hours) => ({
  name,
  type: 'meal',
  city: 'Lijiang',
  venue_name: `${name}, Lijiang`,
  why_it_fits: `Order the stone pot fish and the wild mushroom stir-fry at ${name}.`,
  insider_tips: `Ask which mushrooms are in season at ${name}.`,
  suggested_time: '12:00pm',
  duration_hours: 1.5,
  estimated_cost_usd: 20,
  ...(opening_hours ? { opening_hours } : {})
});

const sight = (name) => ({ name, type: 'landmark', city: 'Lijiang', venue_name: `${name}, Lijiang`, suggested_time: '9:00am', duration_hours: 1.5, estimated_cost_usd: 8 });

async function plan(activities) {
  const generate = async () => ({ text: JSON.stringify(activities), stop_reason: 'end_turn' });
  generate.modelId = 'test';
  return planCity(CITY, null, 'meal-pool-test', [], null, null, 1, 1, 0, [], null, { generate });
}

test('a meal the model left hours off is kept, not silently deleted', async () => {
  // The prompt tells the model to null unknown hours and let Google fill them.
  // Screening on that null before enrichment ran deleted all 12 restaurants in a
  // real Lijiang run while reporting the list as merely "short on meals".
  // arrangeScheduler already defaults a hours-less meal to the lunch and dinner
  // windows, so there is nothing downstream for the drop to protect.
  const out = await plan([sight('Black Dragon Pool'), meal('Jiu Ge Rice Noodles', null), meal('Heshu Restaurant', null)]);
  const names = out.map((a) => a.name);
  assert.ok(names.includes('Jiu Ge Rice Noodles'), 'null-hours meal kept');
  assert.ok(names.includes('Heshu Restaurant'), 'second null-hours meal kept');
});

test('a meal keeps hours the model did supply', async () => {
  const out = await plan([meal('Muyu Ruin Restaurant', '11:30-14:30,17:30-22:00')]);
  assert.equal(out[0].timing.opening_hours, '11:30-14:30,17:30-22:00');
});

// minMeals is 2/day and 2026-10-08→10-13 is a 6-day stay.
const MEAL_CAP = 12;

test('the pool cap still trims overage, ranked by quality', async () => {
  const many = Array.from({ length: MEAL_CAP + 4 }, (_, i) => meal(`Restaurant ${i}`, '11:00-21:00'));
  const out = await plan(many);
  assert.equal(out.filter((a) => a.type === 'meal').length, MEAL_CAP);
});

test('the cap counts meals the model left hours off', async () => {
  // Otherwise a model following the prompt bypasses the cap entirely.
  const many = Array.from({ length: MEAL_CAP + 4 }, (_, i) => meal(`Restaurant ${i}`, null));
  const out = await plan(many);
  assert.equal(out.filter((a) => a.type === 'meal').length, MEAL_CAP);
});

test('non-meals are never touched by the meal pool logic', async () => {
  const out = await plan([sight('Mu Family Mansion'), sight('Wangu Pavilion'), meal('Spoon Rice Noodle', null)]);
  assert.equal(out.filter((a) => a.type === 'landmark').length, 2);
});
