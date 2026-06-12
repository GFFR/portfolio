const { buildSystemPrompt } = require('./prompts');
const { isBudgetExhausted, recordUsage } = require('./budget');
const { logExchange, readSession, getMessagesForModel } = require('./chat-log');
const { resolveSessionId } = require('./session-id');
const { emptyLead, extractLead, isLeadQualified, markNotified } = require('./leads');
const { notifyLead } = require('./notify');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
const SITE_URL = process.env.SITE_URL || 'https://goncalofframalho.com';
const SITE_TITLE = process.env.SITE_TITLE || 'Gonçalo Ramalho · Product Console';

const HOLIDAY_MESSAGES = {
  en: "gram is on holidays — he should return soon. ☀️ Commands still work fine. For Gonçalo directly: email mynameis@goncalofframalho.com (try `book`).",
  pt: "o gram está de férias — ele volta em breve. ☀️ Os comandos continuam a funcionar. Para falar com o Gonçalo: mynameis@goncalofframalho.com (experimenta `book`).",
};

function detectLang(text) {
  const sample = (text || '').toLowerCase();
  const ptHints = /\b(olá|ola|como|qual|quem|onde|trabalho|experiência|experiencia|currículo|curriculo|disponível|disponivel|fala|português|portugues|obrigad)\b/;
  const enHints = /\b(what|who|where|how|experience|work|hire|available|tell me|about)\b/;
  if (ptHints.test(sample) && !enHints.test(sample)) return 'pt';
  if (enHints.test(sample) && !ptHints.test(sample)) return 'en';
  return sample.match(/[áàâãéêíóôõúç]/i) ? 'pt' : 'en';
}

function holidayMessage(lang) {
  return HOLIDAY_MESSAGES[lang] || HOLIDAY_MESSAGES.en;
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function processLeadAfterReply({ sessionId, lang, question, answer }) {
  const session = readSession(sessionId);
  if (!session) return emptyLead();

  const messages = [
    ...(session.messages || []),
    { role: 'user', content: question },
    { role: 'assistant', content: answer },
  ];

  const currentLead = session.lead || emptyLead();
  const updatedLead = await extractLead({
    messages,
    currentLead,
    lang,
  });

  if (!isLeadQualified(updatedLead) || updatedLead.notifiedAt) {
    return updatedLead;
  }

  const result = await notifyLead({ sessionId, lead: updatedLead });
  if (result.ok) {
    return markNotified(sessionId);
  }

  updatedLead.notifyError = result.error || 'send_failed';
  return updatedLead;
}

async function streamChat(req, res) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(503);
    sseWrite(res, 'error', { message: 'Chat is not configured yet.' });
    res.end();
    return;
  }

  const { message, lang: clientLang, sessionId } = req.body || {};
  const question = typeof message === 'string' ? message.trim() : '';

  if (!question || question.length > 2000) {
    res.status(400);
    sseWrite(res, 'error', { message: 'Invalid question.' });
    res.end();
    return;
  }

  const lang = clientLang === 'pt' || clientLang === 'en' ? clientLang : detectLang(question);
  const chatSessionId = resolveSessionId(req, res, sessionId);
  const existingSession = readSession(chatSessionId);
  const leadState = existingSession?.lead || emptyLead();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (isBudgetExhausted()) {
    const answer = holidayMessage(lang);
    sseWrite(res, 'token', { text: answer });
    sseWrite(res, 'done', { budgetExhausted: true });
    logExchange({
      sessionId: chatSessionId,
      ip: req.ip,
      lang,
      question,
      answer,
      meta: { budgetExhausted: true },
      lead: leadState,
    });
    res.end();
    return;
  }

  const history = getMessagesForModel(existingSession);
  const messages = [
    { role: 'system', content: buildSystemPrompt(leadState) },
    ...history,
    { role: 'user', content: question },
  ];

  let upstream;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': SITE_URL,
        'X-Title': SITE_TITLE,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        max_tokens: parseInt(process.env.MAX_TOKENS || '400', 10),
        temperature: parseFloat(process.env.TEMPERATURE || '0.3', 10),
      }),
    });
  } catch (err) {
    const answer = 'Could not reach the model. Try again or use `email`.';
    sseWrite(res, 'error', { message: answer });
    logExchange({
      sessionId: chatSessionId,
      ip: req.ip,
      lang,
      question,
      answer,
      meta: { error: 'upstream_unreachable' },
      lead: leadState,
    });
    res.end();
    return;
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    console.error('[chat] OpenRouter error', upstream.status, errText.slice(0, 500));
    const answer = lang === 'pt'
      ? 'Algo correu mal. Tenta de novo ou usa `email`.'
      : 'Something went wrong. Try again or use `email`.';
    sseWrite(res, 'error', { message: answer });
    logExchange({
      sessionId: chatSessionId,
      ip: req.ip,
      lang,
      question,
      answer,
      meta: { error: `openrouter_${upstream.status}` },
      lead: leadState,
    });
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage = null;
  let fullAnswer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;

        let parsed;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        if (parsed.usage) usage = parsed.usage;

        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullAnswer += delta;
          sseWrite(res, 'token', { text: delta });
        }
      }
    }
  } catch (err) {
    console.error('[chat] stream error', err);
    const answer = 'Stream interrupted.';
    sseWrite(res, 'error', { message: answer });
    logExchange({
      sessionId: chatSessionId,
      ip: req.ip,
      lang,
      question,
      answer: fullAnswer || answer,
      meta: { error: 'stream_interrupted', partial: Boolean(fullAnswer) },
      lead: leadState,
    });
    res.end();
    return;
  }

  if (usage) recordUsage(usage);

  let finalLead = leadState;
  try {
    finalLead = await processLeadAfterReply({
      sessionId: chatSessionId,
      lang,
      question,
      answer: fullAnswer,
    });
  } catch (err) {
    console.error('[chat] lead processing error', err);
  }

  logExchange({
    sessionId: chatSessionId,
    ip: req.ip,
    lang,
    question,
    answer: fullAnswer,
    meta: { usage: usage || null },
    lead: finalLead,
  });

  sseWrite(res, 'done', {
    usage: usage || null,
    lead: finalLead?.status && finalLead.status !== 'none' ? {
      status: finalLead.status,
      intent: finalLead.intent,
    } : null,
  });
  res.end();
}

module.exports = { streamChat, detectLang, holidayMessage };
