const Anthropic = require('@anthropic-ai/sdk');
const { getSummary } = require('./preferences');

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `## Role
You are a blunt, opinionated travel planning agent. Your job is to design itineraries tailored to the specific traveler's preferences and profile. You are not a generalist — you filter everything through what this specific user actually enjoys. Be concise. At most 3 sentences per activity. Use provided accommodation and trip entry context to shape recommendation timing and geography.

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

When in doubt between two activities, recommend the one that better fits the traveler's stated preferences.

---

## Output Format

Return a JSON array of activity objects. Each object must have these fields:
- name (string)
- type (string: show / tour / food / sports / cultural / walk / sunset / neighborhood / breakfast / lunch / dinner)
- city (string)
- start_location (string)
- end_location (string)
- why_it_fits (string, 1-2 sentences)
- pitfall (string, 1 sentence)
- booking_advice (string, 1 sentence)
- smarter_alternative (string or null)
- verdict (string: "Recommend" / "Recommend with caveats" / "Skip")
- dedicated_time_block (boolean — true if this requires 2+ hours of committed time)
- suggested_time (string — e.g. "9:00am", "2:00pm", "sunset")
- duration_hours (number)

For each activity, provide realistic start and end locations based on the activity description and the city. Use recognizable landmarks, neighborhoods, or points of interest.

Example object:
{
  "name": "Wander Alfama at Dawn",
  "type": "walk",
  "city": "Lisbon",
  "start_location": "Alfama neighborhood, Lisbon",
  "end_location": "Miradouro da Graça, Lisbon",
  "why_it_fits": "..."
}

Return ONLY the JSON array, no markdown, no explanation.`;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function extractTextBlock(content) {
  if (!Array.isArray(content)) return '';
  return content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

function stripCodeFences(raw = '') {
  let cleaned = String(raw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

function extractLikelyJsonArray(raw = '') {
  const text = String(raw || '');
  const start = text.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '[') depth += 1;
    if (ch === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function tryParseJsonArray(raw = '') {
  const attempts = [];
  const stripped = stripCodeFences(raw);
  attempts.push(stripped);

  const extracted = extractLikelyJsonArray(stripped);
  if (extracted && extracted !== stripped) attempts.push(extracted);

  const relaxed = extracted
    ? extracted
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
    : null;
  if (relaxed && !attempts.includes(relaxed)) attempts.push(relaxed);

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // try next strategy
    }
  }

  return null;
}

function normalizeActivity(raw = {}, fallbackCity = '') {
  const verdictRaw = String(raw.verdict || '').trim();
  const verdict = ['Recommend', 'Recommend with caveats', 'Skip'].includes(verdictRaw)
    ? verdictRaw
    : 'Recommend';

  const duration = Number(raw.duration_hours);
  return {
    name: String(raw.name || 'Untitled activity').trim(),
    type: String(raw.type || 'tour').trim().toLowerCase(),
    city: String(raw.city || fallbackCity).trim(),
    start_location: String(raw.start_location || '').trim(),
    end_location: String(raw.end_location || '').trim(),
    why_it_fits: String(raw.why_it_fits || '').trim(),
    pitfall: String(raw.pitfall || '').trim(),
    booking_advice: String(raw.booking_advice || '').trim(),
    smarter_alternative: raw.smarter_alternative == null ? null : String(raw.smarter_alternative).trim(),
    verdict,
    dedicated_time_block: Boolean(raw.dedicated_time_block),
    suggested_time: String(raw.suggested_time || '').trim() || '10:00am',
    duration_hours: Number.isFinite(duration) && duration > 0 ? duration : 1.5
  };
}

async function planCity(city, profile = null, userId = 'default', travels = []) {
  const { name, startDate, endDate, notes, accommodations } = city;
  const client = getClient();
  if (!client) {
    const err = new Error('Anthropic API key not configured');
    err.code = 'ANTHROPIC_KEY_MISSING';
    throw err;
  }

  const cityAccommodations = Array.isArray(accommodations) && accommodations.length
    ? accommodations.map((accommodation) => `${accommodation.type || 'Accommodation'}: ${accommodation.name || 'Unnamed accommodation'} | ${accommodation.address || 'Address missing'} | ${accommodation.checkIn || '?'} → ${accommodation.checkOut || '?'}`).join('\n')
    : 'No accommodations provided for this city yet.';

  const relatedTravels = Array.isArray(travels)
    ? travels.filter((travel) => {
      const entryPoint = String(travel?.entryPoint || '').trim().toLowerCase();
      const cityName = String(name || '').trim().toLowerCase();
      return entryPoint.includes(cityName);
    })
    : [];

  const travelContext = relatedTravels.length
    ? relatedTravels.map((travel) => `Entry via ${travel.entryPoint || '?'} @ ${travel.dateTime || '?'}`).join('\n')
    : 'No trip entry details explicitly tied to this city.';

  const prompt = `Plan activities for: ${name} (${startDate} to ${endDate}).\n${notes ? `City-specific notes from the traveler: ${notes}\n` : ''}Accommodation context:\n${cityAccommodations}\n\nTravel entry context touching this city:\n${travelContext}\n\nUse accommodation and travel timing when choosing and sequencing activities (e.g. lighter arrivals/departures, practical first/last activities near accommodation or transport hubs). Return a maximum of 6-8 activities. Be concise.\n\nReturn JSON only.`;

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
  const parsed = tryParseJsonArray(response);

  if (!parsed) {
    console.error('Failed to parse Claude JSON response (all parse strategies failed).');
    throw new Error(`Claude returned invalid JSON for ${name}.`);
  }

  return parsed.map((item) => normalizeActivity(item, name));
}

module.exports = { planCity };
