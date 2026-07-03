function extractText(content = []) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c?.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

function stripCodeFences(raw = '') {
  let cleaned = String(raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

function extractBalanced(raw = '', open = '{') {
  const close = open === '{' ? '}' : ']';
  const text = String(raw || '');
  const start = text.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function repairTruncatedJson(raw = '') {
  let text = String(raw || '').trim();
  text = text.replace(/,\s*$/, '');
  text = text.replace(/,?\s*"[^"]*"\s*:\s*(?:"[^"]*)?$/, '');
  const opens = [];
  let inStr = false, esc = false;
  for (const ch of text) {
    if (inStr) { if (esc) { esc = false; } else if (ch === '\\') { esc = true; } else if (ch === '"') { inStr = false; } continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{' || ch === '[') opens.push(ch);
    if (ch === '}' || ch === ']') opens.pop();
  }
  while (opens.length) {
    const open = opens.pop();
    text += open === '{' ? '}' : ']';
  }
  return text;
}

function tryParseJson(raw, open) {
  const stripped = stripCodeFences(raw);
  const attempts = [stripped];
  const extracted = extractBalanced(stripped, open);
  if (extracted && extracted !== stripped) attempts.push(extracted);
  const relaxed = extracted
    ? extracted.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    : null;
  if (relaxed && !attempts.includes(relaxed)) attempts.push(relaxed);
  const repaired = repairTruncatedJson(extracted || stripped);
  if (!attempts.includes(repaired)) attempts.push(repaired);

  const wantArray = open === '[';
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (wantArray ? Array.isArray(parsed) : (parsed && typeof parsed === 'object' && !Array.isArray(parsed))) {
        return parsed;
      }
    } catch {
      // try next strategy
    }
  }
  return null;
}

const tryParseJsonObject = (raw = '') => tryParseJson(raw, '{');
const tryParseJsonArray = (raw = '') => tryParseJson(raw, '[');

module.exports = { extractText, stripCodeFences, extractBalanced, repairTruncatedJson, tryParseJsonObject, tryParseJsonArray };
