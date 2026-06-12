const path = require('path');
const express = require('express');
const { listSessions, readSession } = require('./chat-log');
const { listLeads, getLeadForSession } = require('./leads');
const { isValidSessionId } = require('./session-id');
const { setNoCache } = require('./no-cache');

const VIEWS = path.join(__dirname, 'views');

const pageRouter = express.Router();
const apiRouter = express.Router();

pageRouter.get('/logs', (_req, res) => {
  setNoCache(res);
  res.sendFile(path.join(VIEWS, 'logs.html'));
});

pageRouter.get('/leads', (_req, res) => {
  setNoCache(res);
  res.sendFile(path.join(VIEWS, 'leads.html'));
});

apiRouter.get('/sessions', (_req, res) => {
  setNoCache(res);
  res.json({ sessions: listSessions() });
});

apiRouter.get('/sessions/:sessionId', (req, res) => {
  setNoCache(res);
  const sessionId = req.params.sessionId;
  if (!isValidSessionId(sessionId)) {
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

apiRouter.get('/leads', (_req, res) => {
  setNoCache(res);
  res.json({ leads: listLeads() });
});

apiRouter.get('/leads/:sessionId', (req, res) => {
  setNoCache(res);
  const sessionId = req.params.sessionId;
  if (!isValidSessionId(sessionId)) {
    res.status(400).json({ error: 'Invalid session id' });
    return;
  }

  const lead = getLeadForSession(sessionId);
  const session = readSession(sessionId);
  if (!lead && !session?.lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  res.json({
    ...(lead || { sessionId, lead: session.lead }),
    messages: session?.messages || [],
  });
});

module.exports = { pageRouter, apiRouter };
