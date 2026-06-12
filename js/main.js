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
