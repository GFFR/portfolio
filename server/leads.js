const fs = require('fs');
const path = require('path');
const { loadKnowledge } = require('./prompts');
const { readSession, writeSessionData } = require('./chat-log');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const EXTRACT_MODEL = process.env.LEAD_EXTRACT_MODEL || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
const SITE_URL = process.env.SITE_URL || 'https://goncalofframalho.com';
const SITE_TITLE = process.env.SITE_TITLE || 'Gonçalo Ramalho · Product Console';
const LEADS_DIR = process.env.LEADS_DIR || path.join(__dirname, '..', 'data', 'leads');
const INTENT_CONFIDENCE_MIN = parseFloat(process.env.LEAD_INTENT_CONFIDENCE_MIN || '0.5', 10);

const CONTACT_FIELDS = ['email', 'linkedin', 'phone'];

function ensureLeadsDir() {
  if (!fs.existsSync(LEADS_DIR)) fs.mkdirSync(LEADS_DIR, { recursive: true });
}

function emptyLead() {
  return {
    status: 'none',
    intent: null,
    intentLabel: null,
    intentDetail: null,
    intentConfidence: 0,
    fields: {
      name: null,
      email: null,
      company: null,
      role: null,
      linkedin: null,
      phone: null,
      timeline: null,
      timezone: null,
      message: null,
    },
    summary: null,
    notifiedAt: null,
    notifyError: null,
  };
}

function getExcludedIntents() {
  return (process.env.LEAD_NOTIFY_EXCLUDE_INTENTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function intentIds() {
  const kb = loadKnowledge();
  return (kb.lead_capture?.intents || []).map((i) => i.id);
}

function hasContact(fields) {
  if (!fields) return false;
  return CONTACT_FIELDS.some((key) => {
    const val = fields[key];
    return typeof val === 'string' && val.trim().length > 0;
  });
}

function pickString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function mergeFields(existing, incoming) {
  const base = { ...emptyLead().fields, ...(existing || {}) };
  if (!incoming || typeof incoming !== 'object') return base;

  for (const [key, value] of Object.entries(incoming)) {
    const next = pickString(value);
    if (next) base[key] = next;
  }
  return base;
}

function resolveIntentLabel(intentId, intentDetail) {
  const kb = loadKnowledge();
  const match = (kb.lead_capture?.intents || []).find((i) => i.id === intentId);
  if (intentId === 'other' && intentDetail) return `Other: ${intentDetail}`;
  return match?.label || intentId || 'Unknown';
}

function mergeLead(existing, extracted) {
  const lead = { ...emptyLead(), ...(existing || {}) };
  if (!extracted || typeof extracted !== 'object') return lead;

  if (extracted.intent && intentIds().includes(extracted.intent)) {
    lead.intent = extracted.intent;
    lead.intentConfidence = Math.max(
      lead.intentConfidence || 0,
      typeof extracted.intentConfidence === 'number' ? extracted.intentConfidence : 0,
    );
  }

  const detail = pickString(extracted.intentDetail);
  if (detail) lead.intentDetail = detail;

  lead.fields = mergeFields(lead.fields, extracted.fields);
  const summary = pickString(extracted.summary);
  if (summary) lead.summary = summary;

  lead.intentLabel = resolveIntentLabel(lead.intent, lead.intentDetail);

  if (lead.intent && hasContact(lead.fields)) {
    lead.status = lead.notifiedAt ? 'notified' : 'qualified';
  } else if (lead.intent || hasContact(lead.fields)) {
    lead.status = 'gathering';
  }

  return lead;
}

function isLeadQualified(lead) {
  if (!lead?.intent) return false;
  if ((lead.intentConfidence || 0) < INTENT_CONFIDENCE_MIN) return false;
  if (getExcludedIntents().includes(lead.intent)) return false;
  if (!hasContact(lead.fields)) return false;
  if (lead.intent === 'other' && !lead.intentDetail) return false;
  return true;
}

function formatConversation(messages, maxTurns = 12) {
  const slice = (messages || []).slice(-maxTurns * 2);
  return slice
    .map((m) => `${m.role === 'user' ? 'Visitor' : 'gram'}: ${m.content}`)
    .join('\n');
}

async function extractLead({ messages, currentLead, lang }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return currentLead || emptyLead();

  const kb = loadKnowledge();
  const intents = kb.lead_capture?.intents || [];
  const intentList = intents.map((i) => `- ${i.id}: ${i.label}`).join('\n');

  const system = `You extract structured lead data from a CV-site chat between a visitor and gram (Gonçalo Ramalho's assistant).
Return ONLY valid JSON — no markdown, no commentary.

Schema:
{
  "intent": one of [${intents.map((i) => `"${i.id}"`).join(', ')}] or null,
  "intentConfidence": 0.0 to 1.0,
  "intentDetail": string or null (required when intent is "other"),
  "fields": {
    "name": string or null,
    "email": string or null,
    "company": string or null,
    "role": string or null,
    "linkedin": string or null,
    "phone": string or null,
    "timeline": string or null,
    "timezone": string or null,
    "message": string or null
  },
  "summary": one sentence describing why they reached out, or null
}

Intent options:
${intentList}

Rules:
- Only set fields explicitly stated or clearly implied in the conversation.
- Pick the best-fit intent; use "other" with intentDetail if none fit.
- linkedin can be a full URL or handle.
- Do not invent data.`;

  const userContent = `Language hint: ${lang || 'en'}

Already known lead state:
${JSON.stringify(currentLead || emptyLead(), null, 2)}

Conversation:
${formatConversation(messages)}

Extract updated lead JSON:`;

  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': SITE_URL,
        'X-Title': SITE_TITLE,
      },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        max_tokens: 300,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (err) {
    console.error('[leads] extract fetch failed', err.message);
    return currentLead || emptyLead();
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[leads] extract error', response.status, errText.slice(0, 300));
    return currentLead || emptyLead();
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return currentLead || emptyLead();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('[leads] invalid JSON from extractor');
    return currentLead || emptyLead();
  }

  return mergeLead(currentLead, parsed);
}

function saveLeadCopy(sessionId, session) {
  ensureLeadsDir();
  const file = path.join(LEADS_DIR, `${sessionId}.json`);
  fs.writeFileSync(file, JSON.stringify({
    sessionId,
    savedAt: new Date().toISOString(),
    lead: session.lead,
    ip: session.ip || null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: (session.messages || []).length,
  }, null, 2));
}

function listLeads() {
  ensureLeadsDir();
  const sessions = [];

  let files;
  try {
    files = fs.readdirSync(LEADS_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(LEADS_DIR, file), 'utf8'));
      const lead = data.lead || {};
      sessions.push({
        sessionId: data.sessionId,
        savedAt: data.savedAt,
        notifiedAt: lead.notifiedAt,
        intent: lead.intent,
        intentLabel: lead.intentLabel,
        intentDetail: lead.intentDetail,
        summary: lead.summary,
        fields: lead.fields,
        status: lead.status,
        ip: data.ip,
      });
    } catch {
      /* skip corrupt */
    }
  }

  sessions.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
  return sessions;
}

function getLeadForSession(sessionId) {
  const session = readSession(sessionId);
  if (!session?.lead) return null;
  return {
    sessionId,
    lead: session.lead,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ip: session.ip,
  };
}

function markNotified(sessionId, error = null) {
  const session = readSession(sessionId);
  if (!session) return null;

  session.lead = session.lead || emptyLead();
  session.lead.status = error ? 'qualified' : 'notified';
  if (!error) session.lead.notifiedAt = new Date().toISOString();
  session.lead.notifyError = error || null;
  writeSessionData(session);
  saveLeadCopy(sessionId, session);
  return session.lead;
}

module.exports = {
  emptyLead,
  extractLead,
  mergeLead,
  isLeadQualified,
  hasContact,
  saveLeadCopy,
  listLeads,
  getLeadForSession,
  markNotified,
  getExcludedIntents,
};
