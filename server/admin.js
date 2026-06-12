const path = require('path');
const express = require('express');
const { listSessions, readSession, normalizeSessionId } = require('./chat-log');
const { setNoCache } = require('./no-cache');

const VIEWS = path.join(__dirname, 'views');

const pageRouter = express.Router();
const apiRouter = express.Router();

pageRouter.get('/logs', (_req, res) => {
  setNoCache(res);
  res.sendFile(path.join(VIEWS, 'logs.html'));
});

apiRouter.get('/sessions', (_req, res) => {
  setNoCache(res);
  res.json({ sessions: listSessions() });
});

apiRouter.get('/sessions/:sessionId', (req, res) => {
  setNoCache(res);
  const sessionId = normalizeSessionId(req.params.sessionId);
  if (sessionId !== req.params.sessionId) {
    res.status(400).json({ error: 'Invalid session id' });
    return;
  }

  const session = readSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json(session);
});

module.exports = { pageRouter, apiRouter };
