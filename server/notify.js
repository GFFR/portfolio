const RESEND_URL = 'https://api.resend.com/emails';

function notifyEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.LEAD_NOTIFY_EMAIL);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fieldRow(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:6px 12px 6px 0;color:#8b8792;vertical-align:top">${escHtml(label)}</td><td style="padding:6px 0">${escHtml(value)}</td></tr>`;
}

function buildLeadEmail({ sessionId, lead, siteUrl }) {
  const f = lead.fields || {};
  const contact = f.email || f.linkedin || f.phone || '—';
  const subject = `New lead: ${lead.intentLabel || lead.intent || 'unknown'} — ${f.name || contact}`;

  const adminUrl = `${siteUrl.replace(/\/$/, '')}/admin/logs`;
  const rows = [
    fieldRow('Intent', lead.intentLabel || lead.intent),
    lead.intentDetail ? fieldRow('Intent detail', lead.intentDetail) : '',
    fieldRow('Name', f.name),
    fieldRow('Email', f.email),
    fieldRow('LinkedIn', f.linkedin),
    fieldRow('Phone', f.phone),
    fieldRow('Company', f.company),
    fieldRow('Role', f.role),
    fieldRow('Timeline', f.timeline),
    fieldRow('Timezone', f.timezone),
    fieldRow('Message', f.message),
    fieldRow('Summary', lead.summary),
    fieldRow('Session', sessionId),
  ].join('');

  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1a1a1a;max-width:560px">
      <p style="margin:0 0 16px;font-size:15px">New chat lead on <strong>goncalofframalho.com</strong></p>
      <table style="font-size:14px;line-height:1.5">${rows}</table>
      <p style="margin:20px 0 0;font-size:13px;color:#666">
        <a href="${escHtml(adminUrl)}">View chat logs</a> · session <code>${escHtml(sessionId)}</code>
      </p>
    </div>
  `.trim();

  return { subject, html };
}

async function notifyLead({ sessionId, lead }) {
  if (!notifyEnabled()) {
    console.warn('[notify] skipped — RESEND_API_KEY or LEAD_NOTIFY_EMAIL not set');
    return { ok: false, error: 'not_configured' };
  }

  const from = process.env.LEAD_FROM_EMAIL || 'gram <onboarding@resend.dev>';
  const to = process.env.LEAD_NOTIFY_EMAIL;
  const siteUrl = process.env.SITE_URL || 'https://goncalofframalho.com';
  const { subject, html } = buildLeadEmail({ sessionId, lead, siteUrl });

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[notify] Resend error', res.status, errText.slice(0, 300));
      return { ok: false, error: `resend_${res.status}` };
    }

    const data = await res.json().catch(() => ({}));
    console.log(`[notify] lead email sent for ${sessionId.slice(0, 8)} → ${to}`);
    return { ok: true, id: data.id || null };
  } catch (err) {
    console.error('[notify] send failed', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { notifyLead, notifyEnabled, buildLeadEmail };
