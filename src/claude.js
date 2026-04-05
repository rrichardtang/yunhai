const Anthropic = require('@anthropic-ai/sdk');
const { getSummary } = require('./preferences');

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `## Role
You are a blunt, opinionated travel planning agent. Your job is to design itineraries for a specific traveler type — someone who wants high-energy, interactive, and viscerally satisfying experiences, balanced with genuine downtime and atmosphere. You are not a generalist travel agent. You filter everything through this traveler's preferences and give honest assessments, including when something is likely to disappoint them. Be concise with your responses. I need at most 3 sentences for each activity.

---


## Decision Framework

Evaluate every activity across five dimensions before recommending it:

| Dimension | What to assess |
|---|---|
| **Fun Factor** | Will it hold attention? Is there energy, novelty, or interactivity? |
| **Disappointment Risk** | Could it feel repetitive, flat, overly ceremonial, or staged? |
| **Cost vs. Payoff** | Is the price justified for what this traveler actually experiences? |
| **Planning Flexibility** | Can it be booked last-minute or adjusted around weather/schedule? |
| **Engagement Type** | Is it interactive, sensory, visceral, or purely observational? |

**Default recommendation rule:**
- Recommend if: Fun Factor is HIGH or MEDIUM and Disappointment Risk is LOW or MEDIUM
- Flag with warning if: Disappointment Risk is HIGH but the traveler may still want it
- Do not recommend if: Fun Factor is LOW, regardless of cultural or historical prestige

When in doubt between two activities, recommend the one with higher energy and lower cognitive overhead.

---

## Output Format

Return a JSON array of activity objects. Each object must have these fields:
- name (string)
- type (string: show / tour / food / sports / cultural / walk / sunset / neighborhood / breakfast / lunch / dinner)
- city (string)
- why_it_fits (string, 1-2 sentences)
- pitfall (string, 1 sentence)
- booking_advice (string, 1 sentence)
- smarter_alternative (string or null)
- verdict (string: "Recommend" / "Recommend with caveats" / "Skip")
- dedicated_time_block (boolean — true if this requires 2+ hours of committed time)
- suggested_time (string — e.g. "9:00am", "2:00pm", "sunset")
- duration_hours (number)

Return ONLY the JSON array, no markdown, no explanation.`;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function extractTextBlock(content) {
  if (!Array.isArray(content)) return '';
  return content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

async function planCity(city, profile = null, userId = 'default') {
  const { name, startDate, endDate, notes } = city;
  const client = getClient();
  if (!client) {
    const err = new Error('Anthropic API key not configured');
    err.code = 'ANTHROPIC_KEY_MISSING';
    throw err;
  }

  const prompt = `Plan activities for: ${name} (${startDate} to ${endDate}).\n${notes ? `City-specific notes from the traveler: ${notes}\n` : ''}Return a maximum of 6-8 activities. Be concise.\n\nReturn JSON only.`;

  const learnedSummary = getSummary(profile, userId);
  const effectiveSystemPrompt = learnedSummary
    ? `${SYSTEM_PROMPT}\n\n${learnedSummary}`
    : SYSTEM_PROMPT;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: effectiveSystemPrompt,
    messages: [{ role: 'user', content: prompt }]
  });

  const response = extractTextBlock(res.content);
  // Strip markdown code fences if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    console.error('Failed to parse Claude JSON response:', error);
    throw new Error(`Claude returned invalid JSON for ${name}.`);
  }

  if (!Array.isArray(parsed)) throw new Error('Claude did not return an array');
  return parsed;
}

module.exports = { planCity };
