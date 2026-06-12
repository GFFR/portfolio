const crypto = require('crypto');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function adminEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function adminAuth(req, res, next) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return res.status(404).end();

  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Chat logs"');
    return res.status(401).end();
  }

  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const colon = decoded.indexOf(':');
  const pass = colon >= 0 ? decoded.slice(colon + 1) : '';

  if (!safeEqual(pass, password)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Chat logs"');
    return res.status(401).end();
  }

  next();
}

module.exports = { adminAuth, adminEnabled };
