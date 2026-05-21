/* ============ Opbar height → hero min-height ============ */
(function () {
  const bar = document.querySelector('.opbar');
  if (!bar) return;
  const set = () => document.documentElement.style.setProperty('--opbar-h', bar.offsetHeight + 'px');
  set();
  window.addEventListener('resize', set);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(set).observe(bar);
  }
})();

/* ============ Cursor halo (rAF-driven, eased) ============ */
(function () {
  const halo = document.getElementById('halo');
  if (!halo || matchMedia('(hover: none)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let cx = mx, cy = my;
  let firstMove = true;
  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (firstMove) { cx = mx; cy = my; document.body.classList.add('has-halo'); firstMove = false; }
  });
  window.addEventListener('mouseleave', () => document.body.classList.remove('has-halo'));
  window.addEventListener('mouseenter', () => document.body.classList.add('has-halo'));
  const root = document.documentElement;
  function tick() {
    cx += (mx - cx) * 0.14;
    cy += (my - cy) * 0.14;
    halo.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    root.style.setProperty('--mx', cx + 'px');
    root.style.setProperty('--my', cy + 'px');
    requestAnimationFrame(tick);
  }
  tick();
  window.addEventListener('touchstart', () => { document.body.classList.remove('has-halo'); halo.style.display = 'none'; }, { once: true, passive: true });
})();

/* ============ Live Lisbon clock ============ */
const clock = document.getElementById('clock');
function tickClock() {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  clock.textContent = fmt.format(d);
}
tickClock(); setInterval(tickClock, 1000);

/* ============ Reveal-on-scroll ============ */
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
}, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* ============ Stat counters ============ */
function animateCount(node) {
  const target = parseInt(node.dataset.count, 10);
  const dur = 1100; const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = Math.round(target * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
const countIO = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { animateCount(e.target); countIO.unobserve(e.target); } });
}, { threshold: 0.4 });
document.querySelectorAll('[data-count]').forEach(n => countIO.observe(n));

/* ============ Releases: expand/collapse ============ */
document.querySelectorAll('.release').forEach(r => {
  const head = r.querySelector('.release-head');
  head.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    r.classList.toggle('open');
  });
  if (r.hasAttribute('data-open')) r.classList.add('open');
});

/* ============ Earlier builds accordion ============ */
const earlier = document.getElementById('releases-earlier');
if (earlier) {
  const btn = earlier.querySelector('.releases-earlier-head');
  btn.addEventListener('click', () => {
    const open = earlier.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

/* ============ Print: expand content & finalize counters ============ */
function prepareForPrint() {
  document.querySelectorAll('[data-count]').forEach((n) => {
    n.textContent = n.getAttribute('data-count');
  });
  document.querySelectorAll('.release').forEach((r) => r.classList.add('open'));
  if (earlier) {
    earlier.classList.add('open');
    const earlierBtn = earlier.querySelector('.releases-earlier-head');
    if (earlierBtn) earlierBtn.setAttribute('aria-expanded', 'true');
  }
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
}
window.addEventListener('beforeprint', prepareForPrint);
if (window.matchMedia) {
  window.matchMedia('print').addEventListener('change', (e) => {
    if (e.matches) prepareForPrint();
  });
}

/* ============ Console ============ */
const out = document.getElementById('console-out');
const form = document.getElementById('console-form');
const input = document.getElementById('console-input');
const inputRow = document.getElementById('console-input-row');
const inputMeasure = document.getElementById('console-input-measure');
const suggestEl = document.getElementById('console-suggest');
const unknownEl = document.getElementById('console-unknown');

function print(text, cls) {
  const line = document.createElement('div');
  line.className = 'console-line' + (cls ? ' ' + cls : '');
  line.innerHTML = '<span class="out">' + text + '</span>';
  out.appendChild(line);
  out.scrollTop = out.scrollHeight;
}
function echo(cmd) {
  const line = document.createElement('div');
  line.className = 'console-line';
  line.innerHTML = '<span class="prompt">$</span> <span class="text">' + cmd + '</span>';
  out.appendChild(line);
}

const commands = {
  help() {
    print('available · <span class="console-accent">help · whoami · status · email · linkedin · cv · github · site · skills · stack · brands · book · clear · 42</span>');
  },
  whoami() { print('Gonçalo Ramalho — Product &amp; Innovation Leader. I turn ambiguity into shipped work. Lisbon.'); },
  status() { print('<span class="console-accent">● open to selective engagements · advisory, fractional, and full-time considered.</span>'); },
  email() { print('opening mail client → <a class="console-accent" href="mailto:goncaloramalho88@gmail.com">goncaloramalho88@gmail.com</a>'); window.location.href = 'mailto:goncaloramalho88@gmail.com'; },
  linkedin() { print('opening → <a class="console-accent" target="_blank" rel="noopener" href="https://www.linkedin.com/in/goncalofframalho/">linkedin.com/in/goncalofframalho</a>'); window.open('https://www.linkedin.com/in/goncalofframalho/', '_blank'); },
  site() { print('opening → <a class="console-accent" target="_blank" rel="noopener" href="https://goncalofframalho.com">goncalofframalho.com</a>'); window.open('https://goncalofframalho.com', '_blank'); },
  cv() {
    print('this site prints as a CV — <span class="console-accent">File → Print</span> (or <kbd>Ctrl+P</kbd> / <kbd>⌘P</kbd>). Light mode, full changelog.');
    setTimeout(function () { window.print(); }, 400);
  },
  book() { print('to book a call, email <a class="console-accent" href="mailto:goncaloramalho88@gmail.com">goncaloramalho88@gmail.com</a> with a 1-line context and your timezone.'); },
  github() { print('roots in front-end (Angular era), now AI-augmented building. private repos mostly. happy to walk through anything in conversation.'); },
  skills() { print('strategy · product · operations · engineering · design · ai — see <a class="console-accent" href="#toolkit">04 capabilities</a>'); },
  stack() { print('hands-on: react · next · node · tailwind · figma · supabase · langchain · openai · claude · zapier · n8n · airtable · notion · linear · whatever the job needs.'); },
  brands() { print('Activate: Google · Schweppes · MTV · Nike · VW · Pandora. Platforms: Brixel · Gridwork · Avila Spaces. Plus Swiss banking &amp; insurance partners under NDA.'); },
  clear() { out.innerHTML = ''; },
  '42'() { print('the answer · also: a good roadmap fits on one page.'); }
};

const COMMAND_NAMES = Object.keys(commands).sort(function (a, b) {
  if (a === '42') return 1;
  if (b === '42') return -1;
  return a.localeCompare(b);
});

let suggestIndex = 0;
let suggestBlurTimer;

function resizeConsoleInput() {
  if (!input || !inputMeasure) return;
  inputMeasure.textContent = input.value;
  input.style.width = inputMeasure.offsetWidth + 'px';
}

function getMatchingCommands(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  return COMMAND_NAMES.filter(function (cmd) { return cmd.startsWith(q); });
}

function hideSuggest() {
  if (!suggestEl || !input) return;
  suggestEl.hidden = true;
  input.setAttribute('aria-expanded', 'false');
}

function renderSuggest() {
  if (!suggestEl || !input || !form) return;
  resizeConsoleInput();

  const raw = input.value;
  const q = raw.trim().toLowerCase();
  const hasInput = raw.length > 0;

  if (!hasInput || !form.classList.contains('is-focused')) {
    hideSuggest();
    if (unknownEl) unknownEl.hidden = true;
    return;
  }

  const matches = getMatchingCommands(raw);
  const showUnknown = matches.length === 0;

  if (unknownEl) {
    unknownEl.hidden = !showUnknown;
    if (showUnknown) {
      unknownEl.textContent = 'unknown command: ' + q + ' · type help for available commands';
    }
  }

  if (!matches.length) {
    hideSuggest();
    return;
  }

  if (suggestIndex >= matches.length) suggestIndex = matches.length - 1;
  if (suggestIndex < 0) suggestIndex = 0;

  suggestEl.innerHTML = matches.map(function (cmd, i) {
    const active = i === suggestIndex;
    return '<li role="option" data-cmd="' + cmd + '" class="' + (active ? 'is-active' : '') + '" aria-selected="' + active + '">' + cmd + '</li>';
  }).join('');
  suggestEl.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function run(rawCmd) {
  const cmd = (rawCmd || '').trim().toLowerCase();
  if (!cmd) return;
  echo(cmd);
  if (commands[cmd]) {
    commands[cmd]();
  } else {
    print('unknown command: <span class="console-accent">' + cmd + '</span> · try <span class="console-accent">help</span>', 'warn');
  }
}

if (form && input) {
  const unlockConsoleInput = function () { input.removeAttribute('readonly'); };

  input.addEventListener('focus', function () {
    clearTimeout(suggestBlurTimer);
    unlockConsoleInput();
    form.classList.add('is-focused');
    suggestIndex = 0;
    hideSuggest();
    if (unknownEl) unknownEl.hidden = true;
    resizeConsoleInput();
  });

  input.addEventListener('blur', function () {
    suggestBlurTimer = setTimeout(function () {
      form.classList.remove('is-focused');
      hideSuggest();
      if (unknownEl) unknownEl.hidden = true;
    }, 160);
  });

  input.addEventListener('input', function () {
    suggestIndex = 0;
    renderSuggest();
  });

  input.addEventListener('keydown', function (e) {
    const matches = getMatchingCommands(input.value);
    const panelOpen = suggestEl && !suggestEl.hidden && matches.length;

    if (panelOpen && e.key === 'ArrowDown') {
      e.preventDefault();
      suggestIndex = (suggestIndex + 1) % matches.length;
      renderSuggest();
      return;
    }
    if (panelOpen && e.key === 'ArrowUp') {
      e.preventDefault();
      suggestIndex = (suggestIndex - 1 + matches.length) % matches.length;
      renderSuggest();
      return;
    }
    if (panelOpen && e.key === 'Tab') {
      e.preventDefault();
      input.value = matches[suggestIndex] || matches[0];
      resizeConsoleInput();
      renderSuggest();
      return;
    }
    if (e.key === 'Escape') {
      hideSuggest();
      if (unknownEl) unknownEl.hidden = true;
      suggestIndex = 0;
    }
  });

  if (suggestEl) {
    suggestEl.addEventListener('mousedown', function (e) {
      e.preventDefault();
      const li = e.target.closest('li[data-cmd]');
      if (!li) return;
      run(li.getAttribute('data-cmd'));
      input.value = '';
      resizeConsoleInput();
      suggestIndex = 0;
      renderSuggest();
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    run(input.value);
    input.value = '';
    resizeConsoleInput();
    suggestIndex = 0;
    renderSuggest();
  });

  if (inputRow) {
    inputRow.addEventListener('click', function () {
      input.focus();
    });
  }

  resizeConsoleInput();
}

function openConsoleFromShortcut() {
  document.getElementById('console')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => input?.focus({ preventScroll: true }), 400);
}

function isSpaceConsoleShortcut(e) {
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

document.addEventListener('keydown', (e) => {
  if (!isSpaceConsoleShortcut(e)) return;
  e.preventDefault();
  openConsoleFromShortcut();
});

/* ============ Console dock ============ */
(function () {
  const dock = document.getElementById('console-dock');
  const section = document.getElementById('console');
  if (!dock || !section) return;

  const dockIO = new IntersectionObserver(([entry]) => {
    const show = !entry.isIntersecting;
    dock.classList.toggle('is-visible', show);
    document.body.classList.toggle('has-console-dock', show);
  }, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });
  dockIO.observe(section);

  dock.addEventListener('click', () => {
    setTimeout(() => input?.focus({ preventScroll: true }), 500);
  });
})();
