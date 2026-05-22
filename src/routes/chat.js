const OpenAI = require('openai');
const { getAuthedUserId, parseUserId } = require('../middleware/auth');
const { getSummary: getPreferenceSummary } = require('../preferences');
const {
  getSession,
  setTripContext,
  addMessage,
  getHistory,
  compactHistory,
  clearSession,
  getCachedPrompt
} = require('../chat');
const { searchForChat, isConfigured: isBraveConfigured, shouldUseBrave } = require('../braveSearch');
const {
  buildChatSystemPrompt,
  parseChatResponse,
  processChatSignals,
  toOpenAiMessages,
  looksLikeHelpQuestion
} = require('../services/chatPrompt');

const CHAT_CONCIERGE_MODEL = 'gpt-5.4-mini';

function register(app) {
  app.post('/api/chat/message', async (req, res) => {
    const { sessionId, message, tripContext } = req.body || {};
    if (!sessionId || !message || typeof message !== 'string') {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key not configured for chat.' });
    }

    try {
      const userId = parseUserId(getAuthedUserId(req));
      const prefSummary = getPreferenceSummary(userId);

      getSession(sessionId);
      setTripContext(sessionId, tripContext || {});
      addMessage(sessionId, 'user', message);

      const isHelp = looksLikeHelpQuestion(message);
      const systemPrompt = isHelp
        ? buildChatSystemPrompt(tripContext || {}, prefSummary, { includeWebsiteGuide: true })
        : getCachedPrompt(sessionId, tripContext || {}, () => buildChatSystemPrompt(tripContext || {}, prefSummary));

      let searchContext = '';
      if (!isHelp && isBraveConfigured() && shouldUseBrave('chat_concierge', { userMessage: message })) {
        try {
          const searchResults = await searchForChat(message, { count: 5 });
          if (searchResults) {
            searchContext = `\n\n## Web Search Results\nThese are real-time search results for the user's question. When answering factual questions (recommendations, rankings, ratings, hours, prices), you MUST ground your answer in these results — name specific places, cite the source, and include actionable links. Be concise and confident. If results are sparse or conflicting, say so plainly and provide the best fallback recommendation.\n${searchResults}`;
          }
        } catch (e) {
          console.error('[chat] brave search failed, continuing without:', e.message);
        }
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: CHAT_CONCIERGE_MODEL,
        max_completion_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt + searchContext },
          ...toOpenAiMessages(getHistory(sessionId))
        ]
      });

      const rawText = response.choices?.[0]?.message?.content?.trim() || '';

      const { reply, signals } = parseChatResponse(rawText);
      processChatSignals(signals, userId);

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

module.exports = { register };
