const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const rateLimit = require('express-rate-limit');
const { streamChat } = require('./chat');
const { getBudgetState } = require('./budget');
const { adminAuth, adminEnabled } = require('./admin-auth');
const { pageRouter, apiRouter } = require('./admin');
const { setNoCache } = require('./no-cache');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT = path.join(__dirname, '..');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '16kb' }));

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many questions. Take a breath — commands still work.' },
});

app.get('/api/health', (_req, res) => {
  setNoCache(res);
  res.json({
    ok: true,
    chat: Boolean(process.env.OPENROUTER_API_KEY),
    budget: getBudgetState(),
  });
});

app.post('/api/chat', chatLimiter, (req, res) => {
  streamChat(req, res).catch((err) => {
    console.error('[chat] unhandled', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal error' });
    else res.end();
  });
});

if (adminEnabled()) {
  app.use('/admin', adminAuth, pageRouter);
  app.use('/api/admin', adminAuth, apiRouter);
}

app.use(express.static(ROOT, {
  index: 'index.html',
  maxAge: 0,
  etag: false,
  lastModified: false,
  setHeaders(res) {
    setNoCache(res);
  },
}));

const ASSET_PATH = /\.(?:css|js|mjs|json|png|jpe?g|gif|webp|svg|ico|woff2?|map)$/i;

app.use((req, res) => {
  setNoCache(res);
  if (ASSET_PATH.test(req.path)) {
    res.status(404).type('text/plain').send('Not found');
    return;
  }
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Product Console running on :${PORT}`);
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('OPENROUTER_API_KEY not set — chat disabled, static site only');
  }
  if (adminEnabled()) {
    console.log('Admin logs at /admin/logs');
  }
});
