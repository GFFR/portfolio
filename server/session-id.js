const crypto = require('crypto');

const COOKIE_NAME = 'gram_chat_session';
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidSessionId(id) {
  return typeof id === 'string' && SESSION_ID_RE.test(id);
}

function parseCookieSession(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    if (key !== COOKIE_NAME) continue;
    const id = decodeURIComponent(trimmed.slice(eq + 1));
    if (isValidSessionId(id)) return id;
  }
  return null;
}

function setSessionCookie(res, id) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
}

function resolveSessionId(req, res, clientId) {
  const fromClient = isValidSessionId(clientId) ? clientId : null;
  const fromCookie = parseCookieSession(req);
  const id = fromClient || fromCookie || crypto.randomUUID();
  setSessionCookie(res, id);
  return id;
}

module.exports = { resolveSessionId, isValidSessionId };
