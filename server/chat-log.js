const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHAT_LOG_DIR = process.env.CHAT_LOG_DIR || path.join(__dirname, '..', 'data', 'chats');
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_HISTORY_MESSAGES = parseInt(process.env.CHAT_HISTORY_MAX_MESSAGES || '16', 10);

function ensureDir() {
  if (!fs.existsSync(CHAT_LOG_DIR)) fs.mkdirSync(CHAT_LOG_DIR, { recursive: true });
}

function normalizeSessionId(id) {
  if (typeof id === 'string' && SESSION_ID_RE.test(id)) return id;
  return null;
}

function sessionPath(sessionId) {
  return path.join(CHAT_LOG_DIR, `${sessionId}.json`);
}

function readSession(sessionId) {
  const file = sessionPath(sessionId);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    /* corrupt file — start fresh */
  }
  return null;
}

function writeSessionData(session) {
  ensureDir();
  fs.writeFileSync(sessionPath(session.sessionId), JSON.stringify(session, null, 2));
}

function preview(text, max = 120) {
  const oneLine = String(text || '').replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

function getMessagesForModel(session) {
  const messages = session?.messages || [];
  const modelMessages = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      modelMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' && msg.content) {
      modelMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  if (modelMessages.length <= MAX_HISTORY_MESSAGES) return modelMessages;
  return modelMessages.slice(-MAX_HISTORY_MESSAGES);
}

function logExchange({ sessionId, ip, lang, question, answer, meta = {}, lead = undefined }) {
  const id = normalizeSessionId(sessionId);
  if (!id) {
    console.warn('[chat] skipped log — missing session id');
    return null;
  }
  const now = new Date().toISOString();
  const existing = readSession(id);

  const session = existing || {
    sessionId: id,
    createdAt: now,
    ip: ip || null,
    messages: [],
    lead: null,
  };

  session.updatedAt = now;
  if (!existing && ip) session.ip = ip;
  if (lead !== undefined) session.lead = lead;

  session.messages.push({
    at: now,
    role: 'user',
    lang: lang || null,
    content: question,
  });

  session.messages.push({
    at: now,
    role: 'assistant',
    content: answer,
    ...meta,
  });

  writeSessionData(session);

  const tag = `[chat] ${id.slice(0, 8)}`;
  console.log(`${tag} you: ${preview(question)}`);
  console.log(`${tag} gram: ${preview(answer)}${meta.budgetExhausted ? ' (budget)' : ''}${meta.error ? ` (${meta.error})` : ''}`);
  if (session.lead?.intent) {
    console.log(`${tag} lead: ${session.lead.intentLabel || session.lead.intent} (${session.lead.status})`);
  }

  return id;
}

function listSessions() {
  ensureDir();
  let files;
  try {
    files = fs.readdirSync(CHAT_LOG_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const sessions = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CHAT_LOG_DIR, file), 'utf8'));
      const messages = data.messages || [];
      const userMsgs = messages.filter((m) => m.role === 'user');
      const lastUser = userMsgs[userMsgs.length - 1];
      const lead = data.lead || null;
      sessions.push({
        sessionId: data.sessionId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        ip: data.ip || null,
        exchanges: userMsgs.length,
        preview: lastUser ? preview(lastUser.content, 80) : '',
        lead: lead ? {
          status: lead.status,
          intent: lead.intent,
          intentLabel: lead.intentLabel,
          notifiedAt: lead.notifiedAt,
        } : null,
      });
    } catch {
      /* skip corrupt files */
    }
  }

  sessions.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return sessions;
}

module.exports = {
  logExchange,
  normalizeSessionId,
  readSession,
  writeSessionData,
  getMessagesForModel,
  listSessions,
  CHAT_LOG_DIR,
};
