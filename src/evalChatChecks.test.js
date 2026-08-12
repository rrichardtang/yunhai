const test = require('node:test');
const assert = require('node:assert/strict');
const { runChatChecks, sentenceCount, markdownViolations, inventedLinks, signalFindings } = require('./evalChatChecks');

test('markdown the prompt forbids is caught; a link is not', () => {
  assert.equal(markdownViolations('Try **Compass** tonight.').length, 1);
  assert.equal(markdownViolations('## Options').length, 1);
  assert.equal(markdownViolations('- Compass\n- Xiaocai').length, 1);
  assert.equal(markdownViolations('1. Compass\n2. Xiaocai').length, 1);
  assert.equal(markdownViolations('Use `Draft`.').length, 1);

  // [label](url) is the one construct the prompt allows.
  assert.deepEqual(markdownViolations('Try [Compass](https://x.test/compass) tonight.'), []);
});

test('a URL that appears in no search result is flagged', () => {
  const results = '1. Compass — https://real.test/compass';
  assert.deepEqual(inventedLinks('Try [Compass](https://real.test/compass).', results), []);

  const invented = inventedLinks('Try [Compass](https://tabelog.com/placeholder).', results);
  assert.equal(invented.length, 1);
  assert.match(invented[0].detail, /appears in no search result/);
});

test('an empty search result set means no link is defensible', () => {
  const findings = inventedLinks('Head to [some place](https://example.com/x).', '');
  assert.equal(findings.length, 1);
});

test('sentence counting ignores link URLs and common abbreviations', () => {
  assert.equal(sentenceCount('Go to Compass. It opens at 6pm. Book ahead.'), 3);
  assert.equal(sentenceCount('Try [Compass](https://x.test/a/b.c/d) tonight.'), 1);
  assert.equal(sentenceCount('Arrive at 8 a.m. for the queue.'), 1);
});

test('an allergy downgraded to a preference is caught', () => {
  // The prompt is explicit: allergies are constraints, never softened to
  // "avoids". The reply text reads fine either way — only the signal shows it.
  const expected = [{ kind: 'constraint', mustInclude: 'sushi', mustNotMatch: 'avoid|dislike|prefer' }];

  assert.deepEqual(signalFindings([{ constraint: 'Allergic to sushi' }], expected), []);

  const downgraded = signalFindings([{ preference: 'Avoids sushi' }], expected);
  assert.equal(downgraded.length, 1);
  assert.match(downgraded[0].detail, /captured as preference, expected constraint/);

  const softened = signalFindings([{ constraint: 'Avoids sushi' }], expected);
  assert.equal(softened.length, 1);
  assert.equal(softened[0].check, 'signalSoftened');

  const missing = signalFindings([], expected);
  assert.match(missing[0].detail, /no constraint captured/);
});

test('a clean reply produces no findings', () => {
  const result = runChatChecks({
    reply: 'Compass is the pick for late noodles, five minutes from your place. It runs until midnight.',
    signals: [],
    expect: { maxSentences: 3, maxLinks: 0 },
    searchResults: ''
  });
  assert.deepEqual(result.findings, []);
  assert.equal(result.sentences, 2);
});

test('a long formatted reply with an invented link fires every relevant check', () => {
  const result = runChatChecks({
    reply: '**Here is everything.** First, go north. Second, eat here. Third, sleep. Fourth, leave. Try [X](https://made-up.test/x).',
    signals: [],
    expect: { maxSentences: 3 },
    searchResults: '1. Real — https://real.test/a'
  });
  assert.ok(result.byCheck.markdown);
  assert.ok(result.byCheck.inventedLink);
  assert.ok(result.byCheck.replyLength);
});

test('a reply that failed to parse as JSON is reported, not scored as clean', () => {
  const result = runChatChecks({ reply: '', expect: {}, searchResults: '' });
  assert.equal(result.byCheck.emptyReply, 1);
});
