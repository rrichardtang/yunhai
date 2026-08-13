// Deterministic checks over one chat reply. The concierge prompt states its
// format rules as absolutes — 2-3 sentences, no markdown but links, never a URL
// that did not come from a search result, allergies as constraints and never
// softened — so every one of them is checkable without a judge.
const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

const MARKDOWN_RULES = [
  { pattern: /\*/, detail: 'uses an asterisk (bold or italic)' },
  { pattern: /^#{1,6}\s/m, detail: 'uses a heading' },
  { pattern: /^\s*[-•]\s+/m, detail: 'uses a bullet list' },
  { pattern: /^\s*\d+\.\s+/m, detail: 'uses a numbered list' },
  { pattern: /`/, detail: 'uses a backtick' }
];

const stripLinks = (reply) => String(reply || '').replace(LINK_RE, '$1');

function linksIn(reply) {
  return [...String(reply || '').matchAll(LINK_RE)].map((match) => match[2].trim());
}

// Abbreviations first, so "e.g." and "8 a.m." do not each read as a sentence
// boundary and inflate the count past a cap the reply actually respected.
function sentenceCount(reply) {
  const text = stripLinks(reply)
    .replace(/\b(e\.g|i\.e|etc|vs|approx|a\.m|p\.m|Mr|Mrs|Ms|Dr|St)\./gi, '$1')
    .trim();
  if (!text) return 0;
  return text.split(/[.!?]+(?=\s+["'(\[]?[A-Z0-9]|\s*$)/).filter((part) => part.trim()).length;
}

function markdownViolations(reply) {
  const text = stripLinks(reply);
  return MARKDOWN_RULES
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => ({ check: 'markdown', severity: 'high', detail: `reply ${rule.detail}` }));
}

// The prompt allows exactly one source of URLs: the search results it was given.
// Anything else is invented, which is the failure mode the rule exists for.
function inventedLinks(reply, searchResults) {
  const haystack = String(searchResults || '');
  return linksIn(reply)
    .filter((url) => !haystack.includes(url))
    .map((url) => ({ check: 'inventedLink', severity: 'high', detail: `${url} appears in no search result` }));
}

function signalFindings(signals = [], expected = []) {
  const findings = [];
  for (const want of expected) {
    const match = signals.find((signal) => {
      const value = signal?.[want.kind];
      return typeof value === 'string' && value.toLowerCase().includes(String(want.mustInclude).toLowerCase());
    });

    if (!match) {
      const softened = signals.find((s) => String(s?.preference || s?.constraint || '').toLowerCase().includes(String(want.mustInclude).toLowerCase()));
      findings.push({
        check: 'signalCapture',
        severity: 'high',
        detail: softened
          ? `"${want.mustInclude}" captured as ${Object.keys(softened)[0]}, expected ${want.kind}`
          : `no ${want.kind} captured for "${want.mustInclude}"`
      });
      continue;
    }

    if (want.mustNotMatch && new RegExp(want.mustNotMatch, 'i').test(match[want.kind])) {
      findings.push({
        check: 'signalSoftened',
        severity: 'high',
        detail: `"${match[want.kind]}" softens the traveler's own wording`
      });
    }
  }
  return findings;
}

// Where the prompt's own rendering makes an answer knowable, assert it rather
// than asking the judge. bookingStatus() renders a null reference as "needs
// booking via <type>", so "already booked" is flatly wrong — and the judge got
// that one backwards, faulting the correct reply for not hedging.
function replyContentFindings(reply, expect) {
  const findings = [];
  const text = String(reply || '');
  for (const pattern of expect.replyMustNotMatch || []) {
    if (new RegExp(pattern, 'i').test(text)) {
      findings.push({ check: 'replyContradictsTrip', severity: 'high', detail: `reply matches /${pattern}/, which the itinerary contradicts` });
    }
  }
  for (const pattern of expect.replyMustMatch || []) {
    if (!new RegExp(pattern, 'i').test(text)) {
      findings.push({ check: 'replyMissingFact', severity: 'high', detail: `reply never states /${pattern}/, which the itinerary gives` });
    }
  }
  return findings;
}

function runChatChecks({ reply, signals = [], expect = {}, searchResults = null }) {
  const findings = [
    ...markdownViolations(reply),
    ...inventedLinks(reply, searchResults),
    ...signalFindings(signals, expect.signals),
    ...replyContentFindings(reply, expect)
  ];

  const sentences = sentenceCount(reply);
  if (expect.maxSentences && sentences > expect.maxSentences) {
    findings.push({ check: 'replyLength', severity: 'medium', detail: `${sentences} sentences, cap is ${expect.maxSentences}` });
  }

  const links = linksIn(reply);
  if (expect.maxLinks != null && links.length > expect.maxLinks) {
    findings.push({ check: 'linkCount', severity: 'medium', detail: `${links.length} links, cap is ${expect.maxLinks}` });
  }

  if (!String(reply || '').trim()) {
    findings.push({ check: 'emptyReply', severity: 'high', detail: 'reply is empty or failed to parse as JSON' });
  }

  const byCheck = {};
  for (const finding of findings) byCheck[finding.check] = (byCheck[finding.check] || 0) + 1;
  return { findings, byCheck, total: findings.length, sentences, links };
}

module.exports = { runChatChecks, sentenceCount, markdownViolations, inventedLinks, signalFindings, replyContentFindings, linksIn };
