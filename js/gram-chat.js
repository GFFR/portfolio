/* ============ gram chat (streaming API client) ============ */
(function () {
  const SESSION_KEY = 'gram-chat-session';
  let activeController = null;
  let sessionId = null;

  function persistSessionId(id) {
    sessionId = id;
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch (_) {
      /* private browsing */
    }
    try {
      sessionStorage.setItem(SESSION_KEY, id);
    } catch (_) {
      /* in-memory fallback */
    }
  }

  function loadSessionId() {
    if (sessionId) return sessionId;
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        sessionId = stored;
        return sessionId;
      }
    } catch (_) {
      /* storage blocked */
    }
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        sessionId = stored;
        persistSessionId(stored);
        return sessionId;
      }
    } catch (_) {
      /* storage blocked */
    }
    return null;
  }

  function getSessionId() {
    const existing = loadSessionId();
    if (existing) return existing;
    persistSessionId(crypto.randomUUID());
    return sessionId;
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

  function linkify(text) {
    const escaped = escapeHtml(text);
    return escaped
      .replace(/`([^`]+)`/g, '<span class="gram-chat-accent">$1</span>')
      .replace(/(mynameis@goncalofframalho\.com)/g, '<a class="gram-chat-accent" href="mailto:$1">$1</a>')
      .replace(/(goncaloramalho88@gmail\.com)/g, '<a class="gram-chat-accent" href="mailto:$1">$1</a>');
  }

  function createGramLine(out) {
    const line = document.createElement('div');
    line.className = 'gram-chat-msg gram';
    line.innerHTML =
      '<span class="gram-chat-label gram-chat-label-gram" aria-hidden="true">gram</span>' +
      '<span class="gram-chat-bubble">' +
        '<span class="gram-chat-out"></span>' +
        '<span class="gram-chat-typing" role="status" aria-label="typing">' +
          '<span class="gram-chat-typing-dot"></span>' +
          '<span class="gram-chat-typing-dot"></span>' +
          '<span class="gram-chat-typing-dot"></span>' +
        '</span>' +
      '</span>';
    out.appendChild(line);
    out.classList.add('has-thread');
    out.scrollTop = out.scrollHeight;
    return line.querySelector('.gram-chat-out');
  }

  function scrollOut(out) {
    if (out) out.scrollTop = out.scrollHeight;
  }

  const STREAM_TIMEOUT_MS = 45000;

  function parseHttpError(errText) {
    let message = 'Could not reach gram. Try again in a moment.';
    const dataMatch = errText.match(/^data:\s*(.+)$/m);
    if (dataMatch) {
      try {
        const parsed = JSON.parse(dataMatch[1]);
        if (parsed.message) message = parsed.message;
      } catch (_) { /* keep default */ }
      return message;
    }
    try {
      const parsed = JSON.parse(errText);
      if (typeof parsed.error === 'string') message = parsed.error;
      else if (parsed.message && typeof parsed.message === 'string') message = parsed.message;
      else if (parsed.message?.error) message = parsed.message.error;
    } catch (_) { /* keep default */ }
    return message;
  }

  async function consumeSseStream(res, outEl, line, out) {
    let fullText = '';
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

        if ((event === 'token' || event === 'message') && data.text) {
          fullText += data.text;
          outEl.innerHTML = linkify(fullText);
          scrollOut(out);
        } else if (event === 'error') {
          line.classList.add('warn');
          outEl.innerHTML = escapeHtml(data.message || 'Error.');
          scrollOut(out);
        }
      }
    }

    return fullText;
  }

  function removeEmptyGramLine(line, outEl, fullText) {
    if (!line || fullText.trim()) return;
    const empty = !outEl.textContent.trim() && !outEl.innerHTML.trim();
    if (empty) line.remove();
  }

  async function streamFromEndpoint(endpoint, body, out) {
    if (activeController) activeController.abort();

    const outEl = createGramLine(out);
    const line = outEl.closest('.gram-chat-msg');
    line.classList.add('is-streaming');
    let fullText = '';
    let timedOut = false;

    activeController = new AbortController();
    const signal = activeController.signal;
    const timeoutId = setTimeout(function () {
      timedOut = true;
      activeController?.abort();
    }, STREAM_TIMEOUT_MS);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        line.classList.add('warn');
        outEl.innerHTML = escapeHtml(parseHttpError(errText));
        scrollOut(out);
        return '';
      }

      fullText = await consumeSseStream(res, outEl, line, out);

      if (!fullText.trim()) {
        line.classList.add('warn');
        outEl.textContent = 'No response — try again or email mynameis@goncalofframalho.com.';
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        if (timedOut && !fullText.trim()) {
          line.classList.add('warn');
          outEl.textContent = 'Taking too long — try again in a moment.';
        } else {
          removeEmptyGramLine(line, outEl, fullText);
        }
        return fullText;
      }
      line.classList.add('warn');
      outEl.textContent = 'Connection lost — check your network and try again.';
    } finally {
      clearTimeout(timeoutId);
      line?.classList.remove('is-streaming');
      activeController = null;
      scrollOut(out);
    }

    return fullText;
  }

  async function greeting(out) {
    const lang = (typeof navigator !== 'undefined' && navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
    await streamFromEndpoint('/api/chat/greeting', { lang, sessionId: getSessionId() }, out);
  }

  async function ask(question, out) {
    const q = (question || '').trim();
    if (!q) return;

    await streamFromEndpoint('/api/chat', {
      message: q,
      lang: detectLang(q),
      sessionId: getSessionId(),
    }, out);
  }

  window.GramChat = {
    ask,
    greeting,
    getSessionId,
  };
})();
