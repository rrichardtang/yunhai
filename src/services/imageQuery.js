const KEYWORD_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'at', 'in', 'for', 'on', 'with', 'from', 'to',
  'of', 'by', 'near', 'around', 'best', 'top'
]);

// Words a stock photo of this kind of activity is likely to be described with.
const TYPE_HINTS = {
  meal: ['food', 'restaurant', 'dining', 'meal', 'cuisine', 'dish', 'kitchen', 'cafe'],
  museum: ['museum', 'gallery', 'art', 'exhibition', 'sculpture', 'painting'],
  landmark: ['landmark', 'monument', 'architecture', 'temple', 'building', 'tower', 'palace'],
  neighborhood: ['street', 'alley', 'town', 'village', 'market', 'rooftop', 'sunset'],
  shopping: ['shop', 'store', 'market', 'shopping', 'craft', 'bazaar'],
  sports: ['hiking', 'trail', 'outdoor', 'adventure', 'mountain', 'climbing'],
  tour: ['tour', 'guide', 'sightseeing', 'traveler', 'boat']
};

function toWordSet(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
  );
}

function extractKeywords(text, { excludeWords = new Set(), limit = Infinity } = {}) {
  const words = String(text || '')
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
    .filter(Boolean);

  const keywords = [];
  for (const word of words) {
    const normalized = word.toLowerCase();
    if (KEYWORD_STOPWORDS.has(normalized)) continue;
    if (excludeWords.has(normalized)) continue;
    if (normalized.length <= 1) continue;
    if (keywords.some((k) => k.toLowerCase() === normalized)) continue;
    keywords.push(word);
    if (keywords.length >= limit) break;
  }

  return keywords;
}

// City names arrive fully qualified from Google Places autocomplete
// ("Shangri-La City, Diqing Tibetan Autonomous Prefecture, Yunnan, China").
// Only the leading segment is useful as a search term or a UI label.
function shortCity(name) {
  return String(name || '').split(',')[0].trim();
}

function cityImageQueries(city) {
  const short = shortCity(city);
  if (!short) return [];
  return [short, `${short} old town street`, `${short} landscape nature`];
}

// Higher is better; 0 means nothing in the photo's description relates to the
// activity, which is still a usable city shot but loses to any real overlap.
function scoreImageMatch({ name = '', type = '', city = '' } = {}, imageText = '') {
  const imageWords = toWordSet(imageText);
  if (!imageWords.size) return 0;

  const excludeWords = toWordSet(shortCity(city));
  const activityWords = extractKeywords(name, { excludeWords }).map((w) => w.toLowerCase());

  let score = 0;
  for (const word of new Set(activityWords)) {
    if (imageWords.has(word)) score += 2;
  }
  for (const hint of TYPE_HINTS[String(type).trim().toLowerCase()] || []) {
    if (imageWords.has(hint)) score += 1;
  }
  return score;
}

module.exports = { extractKeywords, toWordSet, shortCity, cityImageQueries, scoreImageMatch };
