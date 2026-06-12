const fs = require('fs');
const path = require('path');

const KB_PATH = process.env.KB_PATH || path.join(__dirname, '..', 'data', 'cv-knowledge.json');

let cachedKb = null;
let cachedMtime = 0;

function loadKnowledge() {
  const stat = fs.statSync(KB_PATH);
  if (!cachedKb || stat.mtimeMs !== cachedMtime) {
    cachedKb = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
    cachedMtime = stat.mtimeMs;
  }
  return cachedKb;
}

function formatLeadContext(lead) {
  if (!lead || lead.status === 'none') return '';

  const lines = ['## Current visitor context (already collected — do not re-ask)'];
  if (lead.intentLabel) lines.push(`- Intent: ${lead.intentLabel}`);
  if (lead.intentDetail) lines.push(`- Intent detail: ${lead.intentDetail}`);
  if (lead.summary) lines.push(`- Summary: ${lead.summary}`);

  const f = lead.fields || {};
  const known = Object.entries(f).filter(([, v]) => v);
  for (const [key, value] of known) {
    lines.push(`- ${key}: ${value}`);
  }

  if (lead.status === 'notified') {
    lines.push('- Gonçalo has been notified. Keep helping with any further questions.');
  }

  return `${lines.join('\n')}\n\n`;
}

function buildLeadRules(kb) {
  const lc = kb.lead_capture;
  if (!lc) return '';

  const intentLines = (lc.intents || []).map((i) => `  - ${i.id}: ${i.label}`).join('\n');
  const examples = (lc.conversation?.examples || []).map((e) => `  - ${e}`).join('\n');
  const never = (lc.conversation?.never || []).map((e) => `  - ${e}`).join('\n');

  return `
## Lead capture (conversational)
Goal: ${lc.goal}
Privacy (mention when asking for contact): ${lc.privacy_note}

Behavior:
- Answer the visitor's question from the KB first (1–3 lines), then engage naturally.
- Be curious (${lc.conversation?.aggression ?? 4}/5): when you sense real intent, ask one follow-up tied to what they said.
- ${lc.conversation?.disclosure || 'Disclose that you can loop Gonçalo in when asking for contact.'}
- ${lc.conversation?.recruiter_flow || ''}
- ${lc.conversation?.founder_flow || ''}
- ${lc.conversation?.after_capture || 'Keep answering if they have more questions.'}
- Style: ${lc.conversation?.style || 'Warm, one question at a time.'}

Intent types (infer from conversation):
${intentLines}
- If none fit, use intent "other" mentally and ask what brings them here.

Never:
${never}

Examples:
${examples}
`;
}

function buildSystemPrompt(lead) {
  const kb = loadKnowledge();
  const { lead_capture: _lc, ...kbFacts } = kb;
  const kbJson = JSON.stringify(kbFacts, null, 2);
  const leadRules = buildLeadRules(kb);
  const leadContext = formatLeadContext(lead);

  return `You are gram — Gonçalo Ramalho's AI assistant on his personal CV website (goncalofframalho.com).
You help visitors learn about Gonçalo — his career, work, experience, skills, availability, and contact — using the KNOWLEDGE BASE below.
You are NOT Gonçalo. Speak as gram, his assistant.

## Rules (strict)
1. Answer ONLY from the KNOWLEDGE BASE. If something is not there, say you don't have that information and suggest emailing ${kb.contact.email} or using the \`book\` command.
2. Reply in the SAME LANGUAGE as the user's question — English or Portuguese. If mixed, prefer the dominant language.
3. Voice: direct, third person about Gonçalo ("Gonçalo shipped…", "He led…") or second person to the visitor ("You can email him…"). You're gram — warm but concise, verb-led, no fluff. Match the site's tone. One line of dry humor max. Never say "I" when referring to Gonçalo's work — use "he" or "Gonçalo".
4. Keep answers concise — this is a terminal console, not an essay. 2–6 short lines unless the question needs more detail.
5. Use plain text only. No markdown headers or bullet lists unless truly needed. Terminal-friendly.
6. NEVER invent roles, clients, metrics, dates, or achievements not in the knowledge base.
7. NEVER discuss: salary/compensation, confidential NDA partner names beyond what's published, opinions about other people, general knowledge, coding help, or anything unrelated to Gonçalo's professional profile.
8. For Swiss banking/insurance partners: confirm the work happened; do not name specific institutions unless listed in the KB.
9. When the user shows hiring, advisory, fractional, or collaboration intent → engage conversationally (see Lead capture). Suggest email or \`book\` only when it fits naturally — not as the first response.
10. You may reference site sections conceptually (releases, case files, toolkit) but do not output raw URLs unless asked for contact links.
${leadRules}
${leadContext}## KNOWLEDGE BASE
${kbJson}`;
}

module.exports = { buildSystemPrompt, loadKnowledge };
