const OpenAI = require('openai');
const { getAuthedUserId, parseUserId } = require('../middleware/auth');
const { recall } = require('../memory');
const {
  getSession,
  setTripContext,
  addMessage,
  getHistory,
  compactHistory,
  clearSession,
  getCachedPrompt
} = require('../chat');
const { isConfigured: isBraveConfigured } = require('../braveSearch');
const {
  buildChatSystemPrompt,
  parseChatResponse,
  processChatSignals,
  toOpenAiMessages
} = require('../services/chatPrompt');
const { WEB_SEARCH_TOOL, MAX_SEARCH_CALLS, runWebSearch } = require('../services/chatTools');

const CHAT_CONCIERGE_MODEL = 'gpt-5.4-mini';

async function runChatTurn({ openai, messages, braveConfigured, search = runWebSearch }) {
  let searchesUsed = 0;
  for (;;) {
    const offerTools = braveConfigured && searchesUsed < MAX_SEARCH_CALLS;
    const response = await openai.chat.completions.create({
      model: CHAT_CONCIERGE_MODEL,
      max_completion_tokens: 700,
      messages,
      ...(offerTools ? { tools: [WEB_SEARCH_TOOL], tool_choice: 'auto' } : {})
    });
    const msg = response.choices?.[0]?.message;
    if (!msg?.tool_calls?.length) {
      return parseChatResponse(msg?.content?.trim() || '');
    }
    messages.push(msg);
    for (const call of msg.tool_calls) {
      let content;
      if (searchesUsed >= MAX_SEARCH_CALLS) {
        content = 'Search limit reached. Answer with what you have.';
      } else {
        searchesUsed++;
        try {
          const { query } = JSON.parse(call.function.arguments || '{}');
          content = await search(query);
        } catch (e) {
          content = `Search failed: ${e.message}. Answer with what you have.`;
        }
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content });
    }
  }
}

function register(app) {
  app.post('/api/chat/message', async (req, res) => {
    const { sessionId, message, tripContext, tripId = null } = req.body || {};
    if (!sessionId || !message || typeof message !== 'string') {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key not configured for chat.' });
    }

    try {
      const userId = parseUserId(getAuthedUserId(req));
      const prefSummary = recall({ userId, tripId: tripId || null, query: message }).text;

      getSession(sessionId);
      setTripContext(sessionId, tripContext || {});
      addMessage(sessionId, 'user', message);

      const systemPrompt = getCachedPrompt(sessionId, tripContext || {}, () => buildChatSystemPrompt(tripContext || {}, prefSummary));

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const { reply, signals } = await runChatTurn({
        openai,
        braveConfigured: isBraveConfigured(),
        messages: [
          { role: 'system', content: systemPrompt },
          ...toOpenAiMessages(getHistory(sessionId))
        ]
      });
      processChatSignals(signals, userId, tripId || null);

      addMessage(sessionId, 'assistant', reply);
      await compactHistory(sessionId);

      return res.json({ reply, sessionId });
    } catch (error) {
      const history = getHistory(sessionId);
      if (history[history.length - 1]?.role === 'user') {
        history.pop();
      }
      return res.status(500).json({ error: error.message || 'Chat request failed' });
    }
  });

  app.get('/api/chat/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const session = getSession(sessionId);
    return res.json({ sessionId, history: session?.history || [] });
  });

  app.delete('/api/chat/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    clearSession(sessionId);
    return res.json({ ok: true });
  });
}

module.exports = { register, runChatTurn };
