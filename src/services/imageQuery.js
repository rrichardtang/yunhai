const IMAGE_QUERY_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'at', 'in', 'for', 'on', 'with', 'from', 'to'
]);

function extractImageKeywords(name = '', city = '') {
  const cityWords = new Set(
    String(city || '')
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
  );

  const words = String(name || '')
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
    .filter(Boolean);

  const keywords = [];
  for (const word of words) {
    const normalized = word.toLowerCase();
    if (IMAGE_QUERY_STOPWORDS.has(normalized)) continue;
    if (cityWords.has(normalized)) continue;
    if (normalized.length <= 1) continue;
    if (keywords.some((k) => k.toLowerCase() === normalized)) continue;
    keywords.push(word);
  }

  return keywords;
}

function buildImageSearchQuery({ name = '', type = '', city = '' } = {}) {
  const normalizedType = String(type || '').trim().toLowerCase();
  const normalizedCity = String(city || '').trim();
  const keywords = extractImageKeywords(name, normalizedCity);
  const typeWords = new Set(
    normalizedType
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
  );

  const filteredKeywords = keywords.filter((word) => !typeWords.has(word.toLowerCase()));
  const preciseQuery = [filteredKeywords.join(' '), normalizedType, normalizedCity]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (preciseQuery) return preciseQuery;
  if (normalizedType && normalizedCity) return `${normalizedType} ${normalizedCity}`.trim();
  return String(name || '').trim() || normalizedCity;
}

module.exports = { extractImageKeywords, buildImageSearchQuery };
