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

/* ============ Toolkit / chip filter on case files ============ */
(function () {
  const cases = document.querySelectorAll('.case[data-skills]');
  const tks = document.querySelectorAll('.tk[data-skill]');
  const chips = document.querySelectorAll('.chip[data-skill]');
  const hint = document.getElementById('tk-filter-hint');
  const label = document.getElementById('tk-filter-label');
  const clearBtn = document.getElementById('tk-filter-clear');
  if (!cases.length) return;

  const skillLabels = { strategy: 'Strategy', product: 'Product', operations: 'Operations', engineering: 'Engineering', design: 'Design', ai: 'AI' };
  let active = null;

  function applyFilter(skill) {
    active = skill;
    cases.forEach(c => {
      const skills = (c.dataset.skills || '').split(/\s+/);
      c.classList.toggle('is-dimmed', skill && !skills.includes(skill));
    });
    tks.forEach(t => {
      const on = t.dataset.skill === skill;
      t.classList.toggle('is-filter-active', on);
      t.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    chips.forEach(ch => ch.classList.toggle('is-active', ch.dataset.skill === skill));
    if (hint && label) {
      if (skill) {
        label.textContent = skillLabels[skill] || skill;
        hint.hidden = false;
      } else {
        hint.hidden = true;
      }
    }
  }

  function onPick(skill) {
    applyFilter(active === skill ? null : skill);
  }

  tks.forEach(t => {
    t.addEventListener('click', () => onPick(t.dataset.skill));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(t.dataset.skill); }
    });
  });
  chips.forEach(ch => {
    ch.addEventListener('click', (e) => {
      e.stopPropagation();
      onPick(ch.dataset.skill);
      document.getElementById('toolkit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  if (clearBtn) clearBtn.addEventListener('click', () => applyFilter(null));
})();

/* ============ Console ============ */
const out = document.getElementById('console-out');
const form = document.getElementById('console-form');
const input = document.getElementById('console-input');

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
    print('available · <span class="console-accent">help · whoami · status · email · linkedin · call · cv · github · site · skills · stack · brands · clear · 42</span>');
  },
  whoami() { print('Gonçalo Ramalho — Product &amp; Innovation Leader. I turn ambiguity into shipped work. Lisbon.'); },
  status() { print('<span class="console-accent">● open to selective engagements · advisory, fractional, and full-time considered.</span>'); },
  email() { print('opening mail client → <a class="console-accent" href="mailto:goncaloramalho88@gmail.com">goncaloramalho88@gmail.com</a>'); window.location.href = 'mailto:goncaloramalho88@gmail.com'; },
  linkedin() { print('opening → <a class="console-accent" target="_blank" rel="noopener" href="https://www.linkedin.com/in/goncalofframalho/">linkedin.com/in/goncalofframalho</a>'); window.open('https://www.linkedin.com/in/goncalofframalho/', '_blank'); },
  call() { print('dialing → <a class="console-accent" href="tel:+351910236363">+351 910 236 363</a>'); },
  site() { print('opening → <a class="console-accent" target="_blank" rel="noopener" href="https://goncalofframalho.com">goncalofframalho.com</a>'); window.open('https://goncalofframalho.com', '_blank'); },
  cv() { print('the site you are reading <em>is</em> the cv. for a printable version, email me.'); },
  book() { print('to book a call, email <a class="console-accent" href="mailto:goncaloramalho88@gmail.com">goncaloramalho88@gmail.com</a> with a 1-line context and your timezone.'); },
  github() { print('roots in front-end (Angular era), now AI-augmented building. private repos mostly. happy to walk through anything in conversation.'); },
  skills() { print('strategy · product · operations · engineering · design · ai — see <a class="console-accent" href="#toolkit">04 capabilities</a>'); },
  stack() { print('hands-on: react · next · node · tailwind · figma · supabase · langchain · openai · claude · zapier · n8n · airtable · notion · linear · whatever the job needs.'); },
  brands() { print('Activate: Google · Schweppes · MTV · Nike · VW · Pandora. Platforms: Brixel · Gridwork · Avila Spaces. Plus Swiss banking &amp; insurance partners under NDA.'); },
  clear() { out.innerHTML = ''; },
  '42'() { print('the answer · also: a good roadmap fits on one page.'); }
};

function run(rawCmd) {
  const cmd = (rawCmd || '').trim().toLowerCase();
  if (!cmd) return;
  echo(cmd);
  if (commands[cmd]) commands[cmd]();
  else print('command not found', 'system');
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  run(input.value);
  input.value = '';
});

document.querySelectorAll('.console-actions a[data-cmd]').forEach(a => {
  a.addEventListener('click', () => {
    const cmd = a.dataset.cmd;
    echo(cmd);
    print('opening → <a class="console-accent" href="' + a.getAttribute('href') + '">' + a.textContent.replace(/^→\s*/, '') + '</a>');
  });
});

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
