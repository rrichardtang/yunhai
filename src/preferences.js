const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PREFS_PATH = path.join(DATA_DIR, 'preferences.json');
const MAX_SIGNALS = 100;

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
  fs.mkdirSync(DATA_DIR, { recursive: true });
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

function load() {
  ensureDataDir();
  try {
    if (!fs.existsSync(PREFS_PATH)) {
      const initial = defaults();
      save(initial);
      return initial;
    }
    const raw = fs.readFileSync(PREFS_PATH, 'utf8');
    return normalize(JSON.parse(raw));
  } catch {
    const fresh = defaults();
    save(fresh);
    return fresh;
  }
}

function save(prefs) {
  ensureDataDir();
  const tmpPath = `${PREFS_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(normalize(prefs), null, 2));
  fs.renameSync(tmpPath, PREFS_PATH);
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

function recordSignal({ name, type, verdict, city, why_it_fits }) {
  const prefs = load();
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

  save(prefs);
  return prefs;
}

function getSummary(profile = null) {
  const prefs = load();
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
  const profileLines = questionMap
    .map(([key, label]) => {
      const value = answers[key];
      if (!['Yes', 'Meh', 'No'].includes(value)) return null;
      return `- ${label}: ${value}`;
    })
    .filter(Boolean);
  const notes = String(profile?.travelNotes || '').trim();
  const activityDislikes = String(profile?.activityDislikes || '').trim();
  if (profileLines.length || notes || activityDislikes) {
    parts.push('## User Traveler Profile (self-reported)');
    if (profileLines.length) parts.push(profileLines.join('\n'));
    if (notes) parts.push(`Travel notes: ${notes}`);
    if (activityDislikes) parts.push(`Activity dislikes: ${activityDislikes}`);
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

function reset() {
  const fresh = defaults();
  save(fresh);
  return fresh;
}

module.exports = { load, save, recordSignal, getSummary, reset };
