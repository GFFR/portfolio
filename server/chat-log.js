const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHAT_LOG_DIR = process.env.CHAT_LOG_DIR || path.join(__dirname, '..', 'data', 'chats');
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureDir() {
  if (!fs.existsSync(CHAT_LOG_DIR)) fs.mkdirSync(CHAT_LOG_DIR, { recursive: true });
}

function normalizeSessionId(id) {
  if (typeof id === 'string' && SESSION_ID_RE.test(id)) return id;
  return crypto.randomUUID();
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

function writeSession(session) {
  ensureDir();
  fs.writeFileSync(sessionPath(session.sessionId), JSON.stringify(session, null, 2));
}

function preview(text, max = 120) {
  const oneLine = String(text || '').replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

function logExchange({ sessionId, ip, lang, question, answer, meta = {} }) {
  const id = normalizeSessionId(sessionId);
  const now = new Date().toISOString();
  const existing = readSession(id);

  const session = existing || {
    sessionId: id,
    createdAt: now,
    ip: ip || null,
    messages: [],
  };

  session.updatedAt = now;
  if (!existing && ip) session.ip = ip;

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

  writeSession(session);

  const tag = `[chat] ${id.slice(0, 8)}`;
  console.log(`${tag} you: ${preview(question)}`);
  console.log(`${tag} gram: ${preview(answer)}${meta.budgetExhausted ? ' (budget)' : ''}${meta.error ? ` (${meta.error})` : ''}`);

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
      sessions.push({
        sessionId: data.sessionId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        ip: data.ip || null,
        exchanges: userMsgs.length,
        preview: lastUser ? preview(lastUser.content, 80) : '',
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
  listSessions,
  CHAT_LOG_DIR,
};
