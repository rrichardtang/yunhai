const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPrompt, parseOps } = require('./memory/reconcile');

test('parseOps reads a clean ops array', () => {
  const ops = parseOps('{"ops":[{"op":"ADD","text":"likes jazz","type":"preference","scope":"user"}]}');
  assert.equal(ops.length, 1);
  assert.equal(ops[0].op, 'ADD');
});

test('parseOps strips markdown fences', () => {
  const ops = parseOps('```json\n{"ops":[{"op":"NOOP"}]}\n```');
  assert.equal(ops[0].op, 'NOOP');
});

test('parseOps returns null on invalid JSON', () => {
  assert.equal(parseOps('not json at all'), null);
});

test('parseOps returns [] when ops key is missing', () => {
  assert.deepEqual(parseOps('{"foo":1}'), []);
});

test('buildPrompt includes existing memories, candidates, and source', () => {
  const prompt = buildPrompt({
    existing: [{ id: 'mem_1', type: 'preference', scope: 'user', text: 'loves seafood' }],
    candidates: ['went vegetarian'],
    source: 'chat',
    context: 'trip it_9'
  });
  assert.match(prompt, /id=mem_1/);
  assert.match(prompt, /loves seafood/);
  assert.match(prompt, /went vegetarian/);
  assert.match(prompt, /SOURCE of observations: chat/);
  assert.match(prompt, /trip it_9/);
});

test('buildPrompt handles an empty existing set', () => {
  const prompt = buildPrompt({ existing: [], candidates: ['no early mornings'], source: 'decline' });
  assert.match(prompt, /\(none\)/);
  assert.match(prompt, /no early mornings/);
});
