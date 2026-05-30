const test = require('node:test');
const assert = require('node:assert');
const { runChatTurn } = require('./chat');

function fakeOpenAI(turns) {
  const queue = [...turns];
  const calls = [];
  return {
    calls,
    chat: {
      completions: {
        create: async (req) => {
          calls.push(req);
          return { choices: [{ message: queue.shift() }] };
        }
      }
    }
  };
}

function toolCallMsg(id, query) {
  return { role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name: 'web_search', arguments: JSON.stringify({ query }) } }] };
}

test('model search turn runs web_search with the model\'s exact query, then answers', async () => {
  const openai = fakeOpenAI([
    toolCallMsg('c1', 'dinner near Park Hotel Tokyo, Shiodome'),
    { role: 'assistant', content: '{"reply":"Try X.","signals":[]}' }
  ]);
  const searched = [];
  const search = async (q) => { searched.push(q); return '1. X — http://x'; };

  const out = await runChatTurn({ openai, braveConfigured: true, messages: [{ role: 'system', content: 's' }], search });

  assert.deepEqual(searched, ['dinner near Park Hotel Tokyo, Shiodome']);
  assert.equal(out.reply, 'Try X.');
  // second create call must include the tool result message
  const lastReq = openai.calls[1];
  assert.ok(lastReq.messages.some((m) => m.role === 'tool' && m.content.includes('http://x')));
});

test('search calls are capped at 2; tools disabled on the forced turn', async () => {
  const openai = fakeOpenAI([
    toolCallMsg('a', 'q1'),
    toolCallMsg('b', 'q2'),
    toolCallMsg('c', 'q3'),
    { role: 'assistant', content: '{"reply":"done","signals":[]}' }
  ]);
  let searches = 0;
  const search = async () => { searches++; return 'res'; };

  const out = await runChatTurn({ openai, braveConfigured: true, messages: [{ role: 'system', content: 's' }], search });

  assert.equal(searches, 2);
  assert.equal(out.reply, 'done');
  // the 4th create call (after cap reached) must not offer tools
  assert.equal(openai.calls[openai.calls.length - 1].tools, undefined);
});

test('no-search path: model answers directly with zero searches', async () => {
  const openai = fakeOpenAI([{ role: 'assistant', content: '{"reply":"app answer","signals":[]}' }]);
  let searches = 0;
  const out = await runChatTurn({ openai, braveConfigured: true, messages: [{ role: 'system', content: 's' }], search: async () => { searches++; return ''; } });
  assert.equal(searches, 0);
  assert.equal(out.reply, 'app answer');
});

test('Brave unconfigured: tools are not offered', async () => {
  const openai = fakeOpenAI([{ role: 'assistant', content: '{"reply":"from context","signals":[]}' }]);
  const out = await runChatTurn({ openai, braveConfigured: false, messages: [{ role: 'system', content: 's' }], search: async () => 'res' });
  assert.equal(out.reply, 'from context');
  assert.equal(openai.calls[0].tools, undefined);
});
