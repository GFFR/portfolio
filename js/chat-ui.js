/* ============ gram chat UI ============ */
(function () {
  const out = document.getElementById('gram-chat-messages');
  const form = document.getElementById('gram-chat-form');
  const input = document.getElementById('gram-chat-input');
  const emptyEl = document.getElementById('gram-chat-empty');
  const host = document.getElementById('gram-chat-host');
  const fullscreenBtn = document.getElementById('gram-chat-fs-btn');
  const quickEl = document.getElementById('gram-chat-quick');

  if (!out || !form || !input) return;

  let greetingSent = false;
  let greetingPending = false;
  let fullscreenActive = false;
  let fullscreenOrigin = null;
  let placeholderTimer = null;
  let placeholderIndex = 0;

  const PLACEHOLDERS = [
    "Ask for Gonçalo's email",
    "I'd like to see his LinkedIn",
    "Is he available for advisory work?",
    "Tell me about the Brixel platform",
    "What's his experience with AI transformation?",
  ];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function hideEmpty() {
    if (emptyEl) emptyEl.hidden = true;
  }

  function echoUser(text) {
    hideEmpty();
    const line = document.createElement('div');
    line.className = 'gram-chat-msg user';
    line.innerHTML =
      '<span class="gram-chat-label" aria-hidden="true">you</span>' +
      '<span class="gram-chat-bubble">' + escapeHtml(text) + '</span>';
    out.appendChild(line);
    out.classList.add('has-thread');
    scrollToEnd();
  }

  function scrollToEnd() {
    out.scrollTop = out.scrollHeight;
  }

  async function ensureGreeting() {
    if (greetingSent || greetingPending) return;
    if (!window.GramChat?.greeting) return;

    greetingPending = true;
    hideEmpty();
    try {
      await GramChat.greeting(out);
      greetingSent = true;
    } finally {
      greetingPending = false;
    }
  }

  async function sendMessage(text) {
    const q = (text || '').trim();
    if (!q) return;

    stopPlaceholderRotation();
    await ensureGreeting();
    echoUser(q);
    input.value = '';

    if (window.GramChat?.ask) {
      await GramChat.ask(q, out);
    }
  }

  function startPlaceholderRotation() {
    if (placeholderTimer || document.activeElement === input) return;
    placeholderTimer = setInterval(function () {
      if (input.value || document.activeElement === input) return;
      placeholderIndex = (placeholderIndex + 1) % PLACEHOLDERS.length;
      input.placeholder = PLACEHOLDERS[placeholderIndex];
    }, 4500);
  }

  function stopPlaceholderRotation() {
    if (!placeholderTimer) return;
    clearInterval(placeholderTimer);
    placeholderTimer = null;
  }

  function updateFullscreenUi() {
    if (!fullscreenBtn) return;
    fullscreenBtn.setAttribute('aria-pressed', fullscreenActive ? 'true' : 'false');
    fullscreenBtn.setAttribute('aria-label', fullscreenActive ? 'Exit fullscreen' : 'Enter fullscreen');
    fullscreenBtn.title = fullscreenActive ? 'Exit fullscreen' : 'Fullscreen';
  }

  function enterFullscreen() {
    if (fullscreenActive || !host) return;
    fullscreenOrigin = {
      parent: host.parentNode,
      next: host.nextSibling,
    };
    document.body.appendChild(host);
    fullscreenActive = true;
    host.classList.add('is-fullscreen');
    document.body.classList.add('gram-chat-fullscreen-open');
    updateFullscreenUi();
    scrollToEnd();
    setTimeout(function () { input.focus({ preventScroll: true }); }, 80);
  }

  function exitFullscreen() {
    if (!fullscreenActive || !host) return;
    fullscreenActive = false;
    host.classList.remove('is-fullscreen');
    document.body.classList.remove('gram-chat-fullscreen-open');
    if (fullscreenOrigin?.parent) {
      fullscreenOrigin.parent.insertBefore(host, fullscreenOrigin.next);
    }
    fullscreenOrigin = null;
    updateFullscreenUi();
  }

  function toggleFullscreen() {
    if (fullscreenActive) exitFullscreen();
    else enterFullscreen();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener('focus', function () {
    form.classList.add('is-focused');
    stopPlaceholderRotation();
    ensureGreeting();
  });

  input.addEventListener('blur', function () {
    form.classList.remove('is-focused');
    if (!input.value) startPlaceholderRotation();
  });

  if (quickEl) {
    quickEl.addEventListener('click', function (e) {
      const chip = e.target.closest('[data-ask]');
      if (!chip) return;
      sendMessage(chip.getAttribute('data-ask'));
      input.focus({ preventScroll: true });
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullscreen);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && fullscreenActive) {
      exitFullscreen();
      e.preventDefault();
    }
  });

  function openChatFromShortcut() {
    document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { input.focus({ preventScroll: true }); }, 400);
  }

  function isSpaceChatShortcut(e) {
    if (e.key !== ' ' && e.code !== 'Space') return false;
    if (e.repeat) return false;
    const el = document.activeElement;
    if (!el) return true;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
    if (el.isContentEditable) return false;
    if (el.closest('button, a[href], summary, [role="button"], [role="link"]')) return false;
    return true;
  }

  document.addEventListener('keydown', function (e) {
    if (!isSpaceChatShortcut(e)) return;
    e.preventDefault();
    openChatFromShortcut();
  });

  /* ============ Chat dock ============ */
  const dock = document.getElementById('chat-dock');
  const section = document.getElementById('chat');

  if (dock && section) {
    const dockIO = new IntersectionObserver(function ([entry]) {
      const show = !entry.isIntersecting;
      dock.classList.toggle('is-visible', show);
      document.body.classList.toggle('has-chat-dock', show);
    }, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });
    dockIO.observe(section);

    dock.addEventListener('click', function () {
      setTimeout(function () { input.focus({ preventScroll: true }); }, 500);
    });
  }

  input.placeholder = PLACEHOLDERS[0];
  startPlaceholderRotation();
})();
