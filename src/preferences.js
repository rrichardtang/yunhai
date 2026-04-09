const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const MAX_SIGNALS = 100;
const MAX_CONSTRAINTS = 20;
const DISTILL_THRESHOLD = 10;
const DEFAULT_USER_ID = 'default';

const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','then','than','to','of','for','in','on','at','by','with','from','as','is','are','was','were','be','been','being','it','its','this','that','these','those','their','there','here','into','over','under','about','after','before','during','through','around','across','you','your','they','them','will','would','can','could','should','very','more','most','high','low','great','good','nice','best','trip','travel','activity','experience','city'
]);

function defaults() {
  return {
    liked: { types: [], keywords: [] },
    disliked: { types: [], keywords: [] },
    constraints: [],
    signals: [],
    distilledProfile: '',
    signalsSinceDistill: 0
  };
}

function ensureDataDir() {
  fs.mkdirSync(USERS_DIR, { recursive: true });
}

function resolveUserId(userId) {
  const resolved = userId == null ? DEFAULT_USER_ID : String(userId).trim();
  if (!resolved) {
    const err = new Error('userId must be a non-empty string');
    err.statusCode = 400;
    throw err;
  }
  if (resolved.length > 64 || !/^[A-Za-z0-9-]+$/.test(resolved)) {
    const err = new Error('userId must be <= 64 chars and contain only letters, numbers, and hyphens');
    err.statusCode = 400;
    throw err;
  }
  return resolved;
}

function userPrefsPath(userId) {
  return path.join(USERS_DIR, `${resolveUserId(userId)}.json`);
}

function normalize(prefs) {
  const safe = defaults();
  if (!prefs || typeof prefs !== 'object') return safe;
  safe.signals = Array.isArray(prefs.signals) ? prefs.signals.slice(-MAX_SIGNALS) : [];
  safe.constraints = Array.isArray(prefs.constraints) ? prefs.constraints.slice(-MAX_CONSTRAINTS) : [];
  safe.distilledProfile = typeof prefs.distilledProfile === 'string' ? prefs.distilledProfile : '';
  safe.signalsSinceDistill = Number(prefs.signalsSinceDistill) || 0;
  if (prefs.liked && typeof prefs.liked === 'object') {
    safe.liked.types = Array.isArray(prefs.liked.types) ? prefs.liked.types : [];
    safe.liked.keywords = Array.isArray(prefs.liked.keywords) ? prefs.liked.keywords : [];
  }
  if (prefs.disliked && typeof prefs.disliked === 'object') {
    safe.disliked.types = Array.isArray(prefs.disliked.types) ? prefs.disliked.types : [];
    safe.disliked.keywords = Array.isArray(prefs.disliked.keywords) ? prefs.disliked.keywords : [];
  }
  return safe;
}

function load(userId = DEFAULT_USER_ID) {
  ensureDataDir();
  const resolvedUserId = resolveUserId(userId);
  const prefsPath = userPrefsPath(resolvedUserId);
  try {
    if (!fs.existsSync(prefsPath)) {
      const initial = defaults();
      save(initial, resolvedUserId);
      return initial;
    }
    const raw = fs.readFileSync(prefsPath, 'utf8');
    return normalize(JSON.parse(raw));
  } catch {
    const fresh = defaults();
    save(fresh, resolvedUserId);
    return fresh;
  }
}

function save(prefs, userId = DEFAULT_USER_ID) {
  ensureDataDir();
  const prefsPath = userPrefsPath(userId);
  const tmpPath = `${prefsPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(normalize(prefs), null, 2));
  fs.renameSync(tmpPath, prefsPath);
}

function tokenize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function topFrequent(counter, minCount = 2, limit = 12) {
  return [...counter.entries()]
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function deriveSummaries(signals) {
  const likedTypeCounts = new Map();
  const dislikedTypeCounts = new Map();
  const likedKeywordCounts = new Map();
  const dislikedKeywordCounts = new Map();

  for (const signal of signals) {
    const verdict = signal?.verdict === 'approved' ? 'approved' : 'declined';
    const type = String(signal?.type || '').trim().toLowerCase();
    const words = tokenize(`${signal?.name || ''} ${signal?.why_it_fits || ''}`);

    if (type) {
      const typeMap = verdict === 'approved' ? likedTypeCounts : dislikedTypeCounts;
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    }

    const keywordMap = verdict === 'approved' ? likedKeywordCounts : dislikedKeywordCounts;
    for (const word of words) {
      keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
    }
  }

  return {
    liked: {
      types: topFrequent(likedTypeCounts),
      keywords: topFrequent(likedKeywordCounts)
    },
    disliked: {
      types: topFrequent(dislikedTypeCounts),
      keywords: topFrequent(dislikedKeywordCounts)
    }
  };
}

function recordSignal({ userId = DEFAULT_USER_ID, name, type, verdict, city, why_it_fits }) {
  const prefs = load(userId);
  const signal = {
    name: String(name || '').trim(),
    type: String(type || '').trim().toLowerCase(),
    verdict: verdict === 'approved' ? 'approved' : 'declined',
    city: String(city || '').trim(),
    why_it_fits: String(why_it_fits || '').trim(),
    ts: Math.floor(Date.now() / 1000)
  };

  prefs.signals.push(signal);
  prefs.signals = prefs.signals.slice(-MAX_SIGNALS);
  prefs.signalsSinceDistill++;

  const summaries = deriveSummaries(prefs.signals);
  prefs.liked = summaries.liked;
  prefs.disliked = summaries.disliked;

  save(prefs, userId);
  return prefs;
}

function recordConstraint(userId = DEFAULT_USER_ID, constraint) {
  const text = String(constraint || '').trim();
  if (!text) return null;
  const prefs = load(userId);
  const lower = text.toLowerCase();
  if (prefs.constraints.some((c) => c.text.toLowerCase() === lower)) return prefs;
  prefs.constraints.push({ text, ts: Math.floor(Date.now() / 1000) });
  prefs.constraints = prefs.constraints.slice(-MAX_CONSTRAINTS);
  prefs.signalsSinceDistill++;
  save(prefs, userId);
  return prefs;
}

function needsDistillation(userId = DEFAULT_USER_ID) {
  const prefs = load(userId);
  return prefs.signalsSinceDistill >= DISTILL_THRESHOLD;
}

function buildDistillPrompt(prefs, selfReportedProfile) {
  const parts = [];

  if (prefs.distilledProfile) {
    parts.push(`Current traveler profile:\n${prefs.distilledProfile}`);
  }

  if (selfReportedProfile) {
    const answers = selfReportedProfile?.answers || {};
    const sliderToLabel = { 1: 'Not interested', 2: 'Slightly interested', 3: 'Neutral', 4: 'Very interested', 5: 'Loves this' };
    const questionMap = [
      ['museumPerson', 'Museum person'], ['foodTravel', 'Travels for food'],
      ['livePerformances', 'Live performances'], ['outdoorNature', 'Outdoor / nature'],
      ['nightlifeBars', 'Nightlife and bars'], ['structuredTours', 'Structured tours']
    ];
    const lines = questionMap
      .map(([key, label]) => {
        const v = Math.round(Number(answers[key]) || 0);
        return v >= 1 && v <= 5 ? `- ${label}: ${sliderToLabel[v]}` : null;
      })
      .filter(Boolean);
    if (lines.length) parts.push(`Self-reported preferences:\n${lines.join('\n')}`);
    const aboutMe = String(selfReportedProfile?.aboutMe || '').trim();
    if (aboutMe) parts.push(`About me: ${aboutMe}`);
    const instruction = String(selfReportedProfile?.profileInstruction || '').trim();
    if (instruction) parts.push(`Profile instruction: ${instruction}`);
  }

  if (prefs.signals.length) {
    const signalLines = prefs.signals.slice(-30).map((s) => {
      const label = s.verdict === 'approved' ? 'Liked' : 'Declined';
      return `- ${label}: ${s.name || s.type}${s.city ? ` (${s.city})` : ''}`;
    });
    parts.push(`Recent activity signals:\n${signalLines.join('\n')}`);
  }

  if (prefs.constraints.length) {
    parts.push(`Stated constraints:\n${prefs.constraints.map((c) => `- ${c.text}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

async function distill(userId = DEFAULT_USER_ID, selfReportedProfile = null) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const prefs = load(userId);
  if (!prefs.signals.length && !prefs.constraints.length && !prefs.distilledProfile) return null;

  const context = buildDistillPrompt(prefs, selfReportedProfile);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are writing a traveler profile for a travel planning AI. Based on all the data below, write a detailed profile in third person ("This traveler...") that captures who this person is as a traveler. Cover: what they love, what they avoid, scheduling preferences (morning/evening person, pace), food and dining style, cultural interests, constraints, and any quirks. Be specific and opinionated — this profile drives all future recommendations. If there is an existing profile, refine and extend it with new evidence — don't start from scratch. Output ONLY the profile text.\n\n${context}`
    }]
  });

  const paragraph = (response.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  if (!paragraph) return null;

  prefs.distilledProfile = paragraph;
  prefs.signalsSinceDistill = 0;
  prefs.signals = prefs.signals.slice(-10);
  prefs.constraints = [];

  const summaries = deriveSummaries(prefs.signals);
  prefs.liked = summaries.liked;
  prefs.disliked = summaries.disliked;

  save(prefs, userId);
  console.log(`[preferences] Distilled profile for user ${userId}`);
  return paragraph;
}

function getSummary(profile = null, userId = DEFAULT_USER_ID) {
  const prefs = load(userId);

  if (prefs.distilledProfile) {
    const parts = [prefs.distilledProfile];
    if (prefs.constraints.length) {
      parts.push(`Additional constraints: ${prefs.constraints.map((c) => c.text).join('; ')}`);
    }
    return parts.join('\n');
  }

  const parts = [];
  const liked = [...prefs.liked.types, ...prefs.liked.keywords].slice(0, 8);
  const disliked = [...prefs.disliked.types, ...prefs.disliked.keywords].slice(0, 8);

  const profileInstruction = String(profile?.profileInstruction || '').trim();
  if (profileInstruction) {
    parts.push(profileInstruction);
  }

  const answers = profile?.answers && typeof profile.answers === 'object' ? profile.answers : {};
  const questionMap = [
    ['museumPerson', 'Museum person'], ['foodTravel', 'Travels for food'],
    ['livePerformances', 'Live performances'], ['outdoorNature', 'Outdoor / nature activities'],
    ['nightlifeBars', 'Nightlife and bars'], ['structuredTours', 'Structured tours'],
    ['pace', 'Trip pace']
  ];
  const sliderToLabel = { 1: 'Not interested', 2: 'Slightly interested', 3: 'Neutral', 4: 'Very interested', 5: 'Loves this' };
  const paceToLabel = { 1: 'Very relaxed', 2: 'Easy-going', 3: 'Moderate', 4: 'Active', 5: 'Non-stop' };

  const profileLines = questionMap
    .map(([key, label]) => {
      const raw = Number(answers[key]);
      const value = Number.isFinite(raw) ? Math.max(1, Math.min(5, Math.round(raw))) : null;
      if (!value) return null;
      const labelText = key === 'pace' ? paceToLabel[value] : sliderToLabel[value];
      if (!labelText) return null;
      return `- ${label}: ${labelText}`;
    })
    .filter(Boolean);

  const notes = String(profile?.aboutMe || '').trim();
  if (!profileInstruction && (profileLines.length || notes)) {
    if (profileLines.length) parts.push(profileLines.join('\n'));
    if (notes) parts.push(`About me: ${notes}`);
  }

  if (liked.length || disliked.length) {
    const learned = ['Based on past trips, this traveler has consistently approved'];
    if (liked.length) learned[0] += `: ${liked.join(', ')}.`;
    else learned[0] += ' few repeat patterns.';
    if (disliked.length) learned.push(`They have declined: ${disliked.join(', ')}.`);
    parts.push(learned.join(' '));
  }

  if (prefs.constraints.length) {
    parts.push(`Constraints: ${prefs.constraints.map((c) => c.text).join('; ')}`);
  }

  return parts.join('\n');
}

function reset(userId = DEFAULT_USER_ID) {
  const fresh = defaults();
  save(fresh, userId);
  return fresh;
}

module.exports = { load, save, recordSignal, recordConstraint, needsDistillation, distill, getSummary, reset, resolveUserId, DEFAULT_USER_ID };
