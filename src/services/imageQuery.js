const KEYWORD_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'at', 'in', 'for', 'on', 'with', 'from', 'to',
  'of', 'by', 'near', 'around', 'best', 'top'
]);

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

function buildImageSearchQuery({ name = '', type = '', city = '' } = {}) {
  const normalizedType = String(type || '').trim().toLowerCase();
  const normalizedCity = String(city || '').trim();
  const keywords = extractKeywords(name, { excludeWords: toWordSet(normalizedCity) });
  const typeWords = toWordSet(normalizedType);

  const filteredKeywords = keywords.filter((word) => !typeWords.has(word.toLowerCase()));
  const preciseQuery = [filteredKeywords.join(' '), normalizedType, normalizedCity]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (preciseQuery) return preciseQuery;
  if (normalizedType && normalizedCity) return `${normalizedType} ${normalizedCity}`.trim();
  return String(name || '').trim() || normalizedCity;
}

module.exports = { extractKeywords, toWordSet, buildImageSearchQuery };
