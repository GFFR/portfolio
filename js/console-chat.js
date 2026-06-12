/* ============ Console chat (streaming) ============ */
(function () {
  const ASK_PREFIX = 'ask ';
  const SESSION_KEY = 'gram-chat-session';
  let activeController = null;
  let sessionId = null;

  function persistSessionId(id) {
    sessionId = id;
    try {
      sessionStorage.setItem(SESSION_KEY, id);
    } catch (_) {
      /* in-memory fallback */
    }
  }

  function loadSessionId() {
    if (sessionId) return sessionId;
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        sessionId = stored;
        return sessionId;
      }
    } catch (_) {
      /* sessionStorage blocked */
    }
    return null;
  }

  function beginSession() {
    persistSessionId(crypto.randomUUID());
    return sessionId;
  }

  function getSessionId() {
    return loadSessionId() || beginSession();
  }

  function isAskInput(raw) {
    const t = (raw || '').trim();
    if (!t) return false;
    const lower = t.toLowerCase();
    return lower.startsWith(ASK_PREFIX) || t.startsWith('?');
  }

  function parseAskInput(raw) {
    const t = (raw || '').trim();
    if (t.startsWith('?')) return t.slice(1).trim();
    if (t.toLowerCase().startsWith(ASK_PREFIX)) return t.slice(ASK_PREFIX.length).trim();
    return t;
  }

  function detectLang(text) {
    const sample = (text || '').toLowerCase();
    if (/\b(olá|ola|como|qual|quem|onde|trabalho|experiência|experiencia|currículo|disponível|fala)\b/.test(sample)) return 'pt';
    if (/[áàâãéêíóôõúç]/i.test(sample)) return 'pt';
    return 'en';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function linkifyConsole(text) {
    const escaped = escapeHtml(text);
    return escaped
      .replace(/`([^`]+)`/g, '<span class="console-accent">$1</span>')
      .replace(/(goncaloramalho88@gmail\.com)/g, '<a class="console-accent" href="mailto:$1">$1</a>');
  }

  function createChatLine(out) {
    const line = document.createElement('div');
    line.className = 'console-line chat gram';
    line.innerHTML =
      '<span class="chat-label chat-label-gram" aria-hidden="true">gram</span>' +
      '<span class="chat-body">' +
        '<span class="out chat-out"></span>' +
        '<span class="chat-cursor" aria-hidden="true"></span>' +
      '</span>';
    out.appendChild(line);
    out.classList.add('has-chat-thread');
    out.scrollTop = out.scrollHeight;
    return line.querySelector('.chat-out');
  }

  function scrollOut(out) {
    if (out) out.scrollTop = out.scrollHeight;
  }

  async function ask(question, ctx) {
    const { out, print } = ctx;
    const q = (question || '').trim();

    if (!q) {
      print('usage · type <span class="console-accent">chat</span> to enter chat mode, or <span class="console-accent">chat &lt;question&gt;</span> / <span class="console-accent">? &lt;question&gt;</span>', 'warn');
      return;
    }

    if (activeController) activeController.abort();

    const outEl = createChatLine(out);
    const line = outEl.closest('.console-line');
    line.classList.add('is-streaming');
    let fullText = '';

    activeController = new AbortController();
    const signal = activeController.signal;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, lang: detectLang(q), sessionId: getSessionId() }),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let message = 'Could not reach chat. Try `email`.';
        const dataMatch = errText.match(/^data:\s*(.+)$/m);
        if (dataMatch) {
          try {
            const parsed = JSON.parse(dataMatch[1]);
            if (parsed.message) message = parsed.message;
          } catch (_) { /* keep default */ }
        } else {
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error) message = parsed.error;
          } catch (_) { /* keep default */ }
        }
        line.classList.add('warn');
        outEl.innerHTML = escapeHtml(message);
        scrollOut(out);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const lines = chunk.split('\n');
          let event = 'message';
          let dataStr = '';

          for (const ln of lines) {
            if (ln.startsWith('event:')) event = ln.slice(6).trim();
            else if (ln.startsWith('data:')) dataStr = ln.slice(5).trim();
          }

          if (!dataStr) continue;
          let data;
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (event === 'token' && data.text) {
            fullText += data.text;
            outEl.innerHTML = linkifyConsole(fullText);
            scrollOut(out);
          } else if (event === 'error') {
            line.classList.add('warn');
            outEl.innerHTML = escapeHtml(data.message || 'Error.');
            scrollOut(out);
          }
        }
      }

      if (!fullText) {
        outEl.innerHTML = '<span class="console-accent">…</span>';
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      line.classList.add('warn');
      outEl.textContent = 'Connection lost. Commands still work — try `email`.';
    } finally {
      line?.classList.remove('is-streaming');
      activeController = null;
      scrollOut(out);
    }
  }

  window.ConsoleChat = {
    isAskInput,
    parseAskInput,
    ask,
    beginSession,
  };
})();
