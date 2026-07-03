const Anthropic = require('@anthropic-ai/sdk');

const SESSION_STORE = new Map();
const MAX_SESSIONS = 500;
const MODEL_CONTEXT_WINDOW_TOKENS = 200000;
const COMPACT_THRESHOLD_TOKENS = 8000;
const CHARS_PER_TOKEN = 4;

function createEmptySession(userId) {
  return {
    userId: userId || null,
    touchedAt: Date.now(),
    history: [],
    tripContext: {},
    cachedSystemPrompt: null,
    contextHash: null
  };
}

function evictIdlestSession() {
  let idlest = null;
  for (const [key, session] of SESSION_STORE) {
    if (!idlest || session.touchedAt < SESSION_STORE.get(idlest).touchedAt) idlest = key;
  }
  if (idlest) SESSION_STORE.delete(idlest);
}

function getSession(sessionId, userId) {
  if (!sessionId) return null;
  if (!SESSION_STORE.has(sessionId)) {
    if (SESSION_STORE.size >= MAX_SESSIONS) evictIdlestSession();
    SESSION_STORE.set(sessionId, createEmptySession(userId));
  }
  const session = SESSION_STORE.get(sessionId);
  session.touchedAt = Date.now();
  return session;
}

function peekSession(sessionId) {
  return (sessionId && SESSION_STORE.get(sessionId)) || null;
}

function hashContext(context) {
  return JSON.stringify(context);
}

function setTripContext(sessionId, context = {}) {
  const session = getSession(sessionId);
  if (!session) return null;
  session.tripContext = {
    ...(session.tripContext || {}),
    ...(context || {})
  };
  return session;
}

function getCachedPrompt(sessionId, context, buildFn) {
  const session = getSession(sessionId);
  if (!session) return buildFn();
  const hash = hashContext(context);
  if (session.contextHash === hash && session.cachedSystemPrompt) {
    return session.cachedSystemPrompt;
  }
  const prompt = buildFn();
  session.contextHash = hash;
  session.cachedSystemPrompt = prompt;
  return prompt;
}

function addMessage(sessionId, role, content) {
  const session = getSession(sessionId);
  if (!session) return null;
  session.history.push({ role, content: String(content || '') });
  return session;
}

function getHistory(sessionId) {
  const session = getSession(sessionId);
  if (!session) return [];
  return session.history;
}

function estimateHistoryTokens(history = []) {
  const chars = history.reduce((sum, msg) => sum + String(msg?.content || '').length, 0);
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

async function summarizeHistory(history = []) {
  if (!process.env.ANTHROPIC_API_KEY) return '';
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const transcript = history.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Summarize this conversation history into a compact paragraph that preserves all key facts, decisions, preferences, and questions discussed. Be concise.\n\n${transcript}`
      }
    ]
  });

  return (response.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

async function compactHistory(sessionId) {
  const session = getSession(sessionId);
  if (!session) return false;

  const beforeCount = session.history.length;
  if (beforeCount <= 8) return false;

  const estimatedTokens = estimateHistoryTokens(session.history);
  if (estimatedTokens <= COMPACT_THRESHOLD_TOKENS) return false;

  const keepTail = session.history.slice(-8);
  const head = session.history.slice(0, -8);
  const summary = await summarizeHistory(head);
  const summaryText = summary || 'Prior discussion covered trip preferences and decisions. Continue with this context.';

  session.history = [
    { role: 'system', content: `[Conversation summary: ${summaryText}]` },
    ...keepTail
  ];

  console.log(`[chat] Compacted history for session ${sessionId}: ${beforeCount} → ${session.history.length} messages`);
  return true;
}

function clearSession(sessionId) {
  if (!sessionId) return;
  SESSION_STORE.delete(sessionId);
}

module.exports = {
  getSession,
  peekSession,
  setTripContext,
  addMessage,
  getHistory,
  compactHistory,
  clearSession,
  getCachedPrompt
};
