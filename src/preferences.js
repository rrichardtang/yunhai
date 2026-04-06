const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const MAX_SIGNALS = 100;
const DEFAULT_USER_ID = 'default';

const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','then','than','to','of','for','in','on','at','by','with','from','as','is','are','was','were','be','been','being','it','its','this','that','these','those','their','there','here','into','over','under','about','after','before','during','through','around','across','you','your','they','them','will','would','can','could','should','very','more','most','high','low','great','good','nice','best','trip','travel','activity','experience','city'
]);

function defaults() {
  return {
    liked: { types: [], keywords: [] },
    disliked: { types: [], keywords: [] },
    signals: []
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

  const summaries = deriveSummaries(prefs.signals);
  prefs.liked = summaries.liked;
  prefs.disliked = summaries.disliked;

  save(prefs, userId);
  return prefs;
}

function getSummary(profile = null, userId = DEFAULT_USER_ID) {
  const prefs = load(userId);
  const liked = [...prefs.liked.types, ...prefs.liked.keywords].slice(0, 8);
  const disliked = [...prefs.disliked.types, ...prefs.disliked.keywords].slice(0, 8);

  const parts = [];

  const answers = profile?.answers && typeof profile.answers === 'object' ? profile.answers : {};
  const questionMap = [
    ['museumPerson', 'Museum person'],
    ['foodTravel', 'Travels for food'],
    ['livePerformances', 'Live performances'],
    ['outdoorNature', 'Outdoor / nature activities'],
    ['nightlifeBars', 'Nightlife and bars'],
    ['structuredTours', 'Structured tours']
  ];

  const sliderToLabel = {
    1: 'Not interested',
    2: 'Slightly interested',
    3: 'Neutral',
    4: 'Very interested',
    5: 'Loves this'
  };

  const profileInstruction = String(profile?.profileInstruction || '').trim();
  if (profileInstruction) {
    parts.push(`## Traveler Instruction\n${profileInstruction}`);
  }

  const profileLines = questionMap
    .map(([key, label]) => {
      const raw = Number(answers[key]);
      const value = Number.isFinite(raw) ? Math.max(1, Math.min(5, Math.round(raw))) : null;
      if (!value || !sliderToLabel[value]) return null;
      return `- ${label}: ${sliderToLabel[value]}`;
    })
    .filter(Boolean);

  const notes = String(profile?.aboutMe || '').trim();
  if (!profileInstruction && (profileLines.length || notes)) {
    parts.push('## User Traveler Profile (self-reported)');
    if (profileLines.length) parts.push(profileLines.join('\n'));
    if (notes) parts.push(`About me: ${notes}`);
  }

  if (liked.length || disliked.length) {
    const learned = ['## Learned Preferences (from past trips)', 'Based on past trips, this traveler has consistently approved'];
    if (liked.length) learned[1] += `: ${liked.join(', ')}.`;
    else learned[1] += ' few repeat patterns.';
    if (disliked.length) learned.push(`They have declined: ${disliked.join(', ')}.`);
    learned.push('Prioritize interactive and sensory experiences. Deprioritize passive or ceremonial ones.');
    parts.push(learned.join(' '));
  }

  return parts.join('\n\n');
}

function reset(userId = DEFAULT_USER_ID) {
  const fresh = defaults();
  save(fresh, userId);
  return fresh;
}

module.exports = { load, save, recordSignal, getSummary, reset, resolveUserId, DEFAULT_USER_ID };
