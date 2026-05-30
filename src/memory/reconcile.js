const Anthropic = require('@anthropic-ai/sdk');
const semaphore = require('../middleware/llmSemaphore');

const RECONCILE_MODEL = 'claude-haiku-4-5';

function buildPrompt({ existing, candidates, source, context }) {
  const existingBlock = existing.length
    ? existing.map((r) => `- id=${r.id} | ${r.type} | scope=${r.scope} | "${r.text}"`).join('\n')
    : '(none)';
  const candidateBlock = candidates.map((c) => `- "${c}"`).join('\n');
  const contextLine = context ? `\nContext: ${context}` : '';
  return `You maintain a traveler's long-term memory for a trip-planning agent. Reconcile new observations against existing memories and decide what to store.

SOURCE of observations: ${source}${contextLine}

EXISTING MEMORIES:
${existingBlock}

NEW OBSERVATIONS:
${candidateBlock}

For each new observation decide ONE operation:
- ADD: a genuinely new, reusable fact not already covered.
- UPDATE: it refines or contradicts an existing memory — set "id" to the existing record's id and "text" to the corrected statement (e.g. existing "loves seafood" + observation "went vegetarian" → UPDATE that id to "is vegetarian — no seafood or meat").
- DELETE: it invalidates an existing memory with no replacement — set "id" to that record's id.
- NOOP: already captured, or one-off/situational (e.g. "already did this", "too expensive this trip", "running late today"). Drop it.

Classify each stored memory:
- type: "preference" (reusable taste/detail, e.g. "prefers boutique hotels") or "constraint" (hard limit, e.g. "no activities before 9am"). Allergies, intolerances, medical/dietary restrictions, mobility limits, and safety needs are ALWAYS "constraint" — and keep their wording faithful (don't turn "allergic to X" into "avoids X").
- scope: "user" (durable across all trips) or "trip" (only this trip — e.g. a date-specific or this-trip-only note). Default to "user" unless the observation is clearly trip-specific.
- salience: 0.0–1.0 confidence that this is a real, lasting signal.
- keywords: 2–5 lowercase tags for retrieval.

Return ONLY JSON, no markdown:
{"ops":[{"op":"ADD|UPDATE|DELETE|NOOP","id":"<existing id, for UPDATE/DELETE>","text":"...","type":"preference|constraint","scope":"user|trip","salience":0.0,"keywords":[]}]}`;
}

function parseOps(raw) {
  try {
    const stripped = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(stripped);
    return Array.isArray(parsed?.ops) ? parsed.ops : [];
  } catch {
    return null;
  }
}

// Returns an array of operations, or null when reconciliation could not run
// (no key / parse failure) so the caller can fall back to a plain ADD.
async function reconcile({ existing = [], candidates = [], source = 'manual', context = '' }) {
  const cleaned = candidates.map((c) => String(c || '').trim()).filter(Boolean);
  if (!cleaned.length) return [];
  if (!process.env.ANTHROPIC_API_KEY) return null;

  await semaphore.acquire();
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: RECONCILE_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt({ existing, candidates: cleaned, source, context }) }]
    });
    const text = (response.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    return parseOps(text);
  } finally {
    semaphore.release();
  }
}

module.exports = { reconcile, buildPrompt, parseOps, RECONCILE_MODEL };
