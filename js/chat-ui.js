/* ============ gram chat UI (inline + floating widget) ============ */
(function () {
  const out = document.getElementById('gram-chat-messages');
  const form = document.getElementById('gram-chat-form');
  const input = document.getElementById('gram-chat-input');
  const emptyEl = document.getElementById('gram-chat-empty');
  const host = document.getElementById('gram-chat-host');
  const inlineSlot = document.getElementById('gram-chat-inline-slot');
  const floatSlot = document.getElementById('gram-chat-float-slot');
  const layer = document.getElementById('gram-chat-layer');
  const backdrop = layer?.querySelector('.gram-chat-backdrop');
  const dock = document.getElementById('chat-dock');
  const section = document.getElementById('chat');
  const fullscreenBtn = document.getElementById('gram-chat-fs-btn');
  const closeBtn = document.getElementById('gram-chat-close-btn');
  if (!out || !form || !input || !host || !inlineSlot || !floatSlot || !layer) return;

  let greetingSent = false;
  let greetingPending = false;
  let fullscreenActive = false;
  let fullscreenReturnSlot = 'inline';
  let floatOpen = false;
  let sectionVisible = false;
  let placeholderTimer = null;
  let placeholderIndex = 0;

  const PLACEHOLDERS = [
    "Ask for Gonçalo's email",
    "I'd like to see his LinkedIn",
    "Is he available for advisory work?",
    "Tell me about the Brixel platform",
    "What's his experience with AI transformation?",
  ];

  const MOBILE_MQ = window.matchMedia('(max-width: 720px)');

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

  function placeHost(slot) {
    const target = slot === 'inline' ? inlineSlot : floatSlot;
    if (host.parentNode !== target) {
      target.appendChild(host);
    }
    host.classList.toggle('is-inline', slot === 'inline');
    host.classList.toggle('is-float', slot === 'float');
  }

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  function hasScrolledPastHeroOnMobile() {
    if (!isMobile()) return true;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const hero = document.getElementById('boot') || document.querySelector('.hero');
    if (hero) {
      const rect = hero.getBoundingClientRect();
      return rect.bottom < window.innerHeight * 0.55;
    }
    return scrollY > Math.min(window.innerHeight * 0.4, 280);
  }

  function updateDockVisibility() {
    if (!dock) return;
    const show = !sectionVisible
      && !floatOpen
      && !fullscreenActive
      && hasScrolledPastHeroOnMobile();
    dock.classList.toggle('is-visible', show);
    document.body.classList.toggle('has-chat-dock', show);
  }

  function isSectionInView() {
    if (!section) return false;
    const rect = section.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.92 && rect.bottom > 48;
  }

  function focusInline() {
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { input.focus({ preventScroll: true }); }, 400);
  }

  function openFloat() {
    if (sectionVisible) {
      focusInline();
      return;
    }
    if (floatOpen || fullscreenActive) return;

    floatOpen = true;
    placeHost('float');
    layer.classList.add('is-open');
    layer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gram-chat-float-open');
    updateDockVisibility();
    scrollToEnd();
    setTimeout(function () { input.focus({ preventScroll: true }); }, MOBILE_MQ.matches ? 120 : 80);
    ensureGreeting();
  }

  function closeFloat() {
    if (!floatOpen) return;

    floatOpen = false;
    layer.classList.remove('is-open');
    layer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gram-chat-float-open');

    updateDockVisibility();
  }

  function onSectionVisible(visible) {
    sectionVisible = visible;

    if (visible) {
      if (floatOpen) closeFloat();
      if (fullscreenActive) exitFullscreen();
      placeHost('inline');
      updateDockVisibility();
      return;
    }

    if (!fullscreenActive) {
      placeHost('float');
    }
    updateDockVisibility();
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

  function restoreHostAfterFullscreen() {
    if (fullscreenReturnSlot === 'inline' && sectionVisible) {
      placeHost('inline');
    } else if (floatOpen) {
      placeHost('float');
    } else if (sectionVisible) {
      placeHost('inline');
    } else {
      placeHost('float');
    }
  }

  function enterFullscreen() {
    if (fullscreenActive || !host || MOBILE_MQ.matches) return;

    fullscreenReturnSlot = sectionVisible ? 'inline' : 'float';
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
    restoreHostAfterFullscreen();
    updateFullscreenUi();
  }

  function toggleFullscreen() {
    if (fullscreenActive) exitFullscreen();
    else enterFullscreen();
  }

  function handleClose() {
    if (fullscreenActive) {
      exitFullscreen();
      return;
    }
    if (floatOpen) closeFloat();
  }

  function openChatFromShortcut() {
    if (sectionVisible) {
      input.focus({ preventScroll: true });
      ensureGreeting();
      return;
    }
    openFloat();
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

  function handleChatLinkClick(e) {
    if (sectionVisible) return;
    e.preventDefault();
    openFloat();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    sendMessage(input.value);
  });

  function unlockInput() {
    if (input.hasAttribute('readonly')) input.removeAttribute('readonly');
  }

  input.addEventListener('focus', function () {
    unlockInput();
    form.classList.add('is-focused');
    stopPlaceholderRotation();
    ensureGreeting();
  });

  input.addEventListener('mousedown', unlockInput);
  input.addEventListener('touchstart', unlockInput, { passive: true });

  input.addEventListener('blur', function () {
    form.classList.remove('is-focused');
    if (!input.value) startPlaceholderRotation();
  });

  host.addEventListener('click', function (e) {
    const trigger = e.target.closest('[data-ask]');
    if (!trigger) return;
    sendMessage(trigger.getAttribute('data-ask'));
    input.focus({ preventScroll: true });
  });

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullscreen);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', handleClose);
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeFloat);
  }

  if (dock) {
    dock.addEventListener('click', openFloat);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (fullscreenActive) {
      exitFullscreen();
      e.preventDefault();
      return;
    }
    if (floatOpen) {
      closeFloat();
      e.preventDefault();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!isSpaceChatShortcut(e)) return;
    e.preventDefault();
    openChatFromShortcut();
  });

  document.querySelectorAll('a[href="#chat"]').forEach(function (link) {
    link.addEventListener('click', handleChatLinkClick);
  });

  if (section) {
    const dockIO = new IntersectionObserver(function ([entry]) {
      onSectionVisible(entry.isIntersecting);
    }, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });
    dockIO.observe(section);
  }

  window.addEventListener('beforeprint', function () {
    if (!sectionVisible) placeHost('inline');
  });

  window.addEventListener('scroll', function () {
    updateDockVisibility();
  }, { passive: true });

  MOBILE_MQ.addEventListener('change', updateDockVisibility);

  sectionVisible = isSectionInView();
  if (sectionVisible) {
    placeHost('inline');
  } else {
    placeHost('float');
  }
  updateDockVisibility();

  if (location.hash === '#chat') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    if (sectionVisible) focusInline();
    else openFloat();
  }

  input.placeholder = PLACEHOLDERS[0];
  startPlaceholderRotation();
})();
