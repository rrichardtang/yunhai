const { debugLog } = require('./services/debugLog');

const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 300;
const REQUEST_TIMEOUT_MS = 4000;
const MAX_RETRIES = 2;

const QUERY_CACHE = new Map();

function getApiKey() {
  return process.env.BRAVE_API_KEY || '';
}

function isConfigured() {
  return Boolean(getApiKey());
}

function nowIso() {
  return new Date().toISOString();
}

function telemetry(event, payload = {}) {
  const body = JSON.stringify({ event, at: nowIso(), ...payload });
  console.log(`[brave] ${body}`);
  debugLog('brave', body);
}

function cacheKey(query, options = {}) {
  return JSON.stringify({
    query: String(query || '').trim().toLowerCase(),
    count: Number(options.count || 5),
    freshness: options.freshness || ''
  });
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of QUERY_CACHE.entries()) {
    if (entry.expiresAt <= now) QUERY_CACHE.delete(key);
  }
  if (QUERY_CACHE.size <= CACHE_MAX_ENTRIES) return;
  const entries = [...QUERY_CACHE.entries()].sort((a, b) => a[1].storedAt - b[1].storedAt);
  const toDelete = QUERY_CACHE.size - CACHE_MAX_ENTRIES;
  for (let i = 0; i < toDelete; i += 1) QUERY_CACHE.delete(entries[i][0]);
}

function getCached(key) {
  const entry = QUERY_CACHE.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    QUERY_CACHE.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  QUERY_CACHE.set(key, {
    value,
    storedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS
  });
  pruneCache();
}

function normalizeResult(raw = {}, index = 0) {
  return {
    id: String(raw.profile?.url || raw.url || `brave-${index}`),
    title: String(raw.title || '').trim(),
    url: String(raw.url || '').trim(),
    snippet: String(raw.description || '').trim(),
    source: 'brave_web',
    score: null,
    publishedAt: raw.age || null
  };
}

function weakResults(results = []) {
  if (!Array.isArray(results) || !results.length) return true;
  const withLinks = results.filter((r) => /^https?:\/\//i.test(String(r.url || ''))).length;
  const withSnippets = results.filter((r) => String(r.snippet || '').length > 20).length;
  return withLinks < Math.min(2, results.length) || withSnippets === 0;
}

function summarizeError(error) {
  if (!error) return null;
  return {
    name: String(error.name || 'Error'),
    message: String(error.message || 'Unknown Brave error')
  };
}

async function fetchBrave(query, options = {}) {
  const key = getApiKey();
  if (!key) {
    return {
      ok: false,
      provider: 'brave',
      task: options.task || 'general',
      query,
      retrievedAt: nowIso(),
      results: [],
      meta: {
        cached: false,
        retries: 0,
        error: { code: 'BRAVE_KEY_MISSING', message: 'Brave API key missing' }
      }
    };
  }

  const count = Math.max(1, Math.min(10, Number(options.count || 5)));
  const params = new URLSearchParams({ q: query, count: String(count) });
  if (options.freshness) params.set('freshness', String(options.freshness));

  let retries = 0;
  let lastError = null;

  while (retries <= MAX_RETRIES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${BRAVE_API_URL}?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': key
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        const retryable = res.status === 429 || (res.status >= 500 && res.status <= 599);
        const err = new Error(`Brave HTTP ${res.status}`);
        err.code = `HTTP_${res.status}`;
        if (retryable && retries < MAX_RETRIES) {
          retries += 1;
          await new Promise((r) => setTimeout(r, 150 * retries));
          continue;
        }
        return {
          ok: false,
          provider: 'brave',
          task: options.task || 'general',
          query,
          retrievedAt: nowIso(),
          results: [],
          meta: {
            cached: false,
            retries,
            error: { code: err.code, message: err.message }
          }
        };
      }

      const data = await res.json();
      const normalized = (data?.web?.results || []).slice(0, count).map(normalizeResult);
      return {
        ok: true,
        provider: 'brave',
        task: options.task || 'general',
        query,
        retrievedAt: nowIso(),
        results: normalized,
        meta: {
          cached: false,
          retries,
          weak: weakResults(normalized),
          error: null
        }
      };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (retries < MAX_RETRIES) {
        retries += 1;
        await new Promise((r) => setTimeout(r, 150 * retries));
        continue;
      }
      break;
    }
  }

  return {
    ok: false,
    provider: 'brave',
    task: options.task || 'general',
    query,
    retrievedAt: nowIso(),
    results: [],
    meta: {
      cached: false,
      retries,
      error: summarizeError(lastError)
    }
  };
}

async function retrieve(query, options = {}) {
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      provider: 'brave',
      task: options.task || 'general',
      query: '',
      retrievedAt: nowIso(),
      results: [],
      meta: { cached: false, retries: 0, error: { code: 'EMPTY_QUERY', message: 'Query is empty' } }
    };
  }

  const key = cacheKey(trimmed, options);
  const cached = getCached(key);
  if (cached) {
    return {
      ...cached,
      retrievedAt: nowIso(),
      meta: {
        ...(cached.meta || {}),
        cached: true
      }
    };
  }

  const retrieval = await fetchBrave(trimmed, options);
  telemetry('retrieval', {
    task: retrieval.task,
    query: trimmed,
    ok: retrieval.ok,
    cached: false,
    retries: retrieval?.meta?.retries || 0,
    resultCount: retrieval.results.length,
    weak: Boolean(retrieval?.meta?.weak),
    error: retrieval?.meta?.error?.code || null
  });

  if (retrieval.ok) setCached(key, retrieval);
  return retrieval;
}

function buildPromptFragment(retrieval, options = {}) {
  const title = options.title || 'Live web retrieval';
  if (!retrieval || !Array.isArray(retrieval.results) || retrieval.results.length === 0) {
    return `${title}: no strong live results found. Say that plainly, then provide the best fallback from known trip context.`;
  }

  const bullets = retrieval.results
    .slice(0, Number(options.maxItems || 5))
    .map((r, index) => `${index + 1}. ${r.title}${r.url ? ` — ${r.url}` : ''}${r.snippet ? `\n   ${r.snippet}` : ''}`)
    .join('\n');

  const weakSuffix = retrieval?.meta?.weak
    ? '\nResults are sparse/conflicting; say this plainly and provide the best practical fallback.'
    : '';

  return `${title} (prefer concrete, bookable/visitable options with links):\n${bullets}${weakSuffix}`;
}

function shouldUseBrave(taskType, context = {}) {
  const task = String(taskType || '').toLowerCase();
  const text = String(context.userMessage || context.query || '').toLowerCase();

  if (['rewrite', 'summarization', 'formatting', 'internal_reasoning'].includes(task)) return false;

  if (task === 'chat_concierge') {
    const nonLivePatterns = [
      /\brewrite\b/, /\bsummarize\b/, /\breformat\b/, /\bformat\b/, /\bbrainstorm\b/, /\bthink step by step\b/
    ];
    if (nonLivePatterns.some((rx) => rx.test(text))) return false;

    const livePatterns = [
      /restaurant|eat|dinner|lunch|breakfast|bar|cafe/,
      /hotel|stay|accommodation|hostel|resort/,
      /activity|things to do|tour|ticket|attraction|museum|show|concert/,
      /shop|shopping|store|buy|boutique|market|mall|souvenir|outlet|district/,
      /flight|train|bus|transit|metro|ferry|transport/,
      /open now|hours|price|pricing|availability|book|booking|reservation|current/
    ];
    return livePatterns.some((rx) => rx.test(text));
  }

  if (task === 'planning' || task === 'entity_enrichment') return true;

  return Boolean(context.needsLiveGrounding);
}

module.exports = {
  retrieve,
  buildPromptFragment,
  shouldUseBrave,
  isConfigured
};
