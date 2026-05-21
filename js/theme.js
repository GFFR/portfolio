(function () {
  var STORAGE_KEY = 'theme';
  var root = document.documentElement;

  function systemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function apply(theme) {
    root.dataset.theme = theme;
  }

  function resolve() {
    return getStored() || systemTheme();
  }

  apply(resolve());

  window.__theme = {
    get: function () { return root.dataset.theme; },
    set: function (theme, persist) {
      if (theme !== 'light' && theme !== 'dark') return;
      apply(theme);
      if (persist !== false) {
        try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
      }
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    },
    clear: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      apply(systemTheme());
    },
    toggle: function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      this.set(next);
      return next;
    }
  };

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (getStored()) return;
    apply(e.matches ? 'dark' : 'light');
  });

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;

    function syncButton() {
      var dark = root.dataset.theme === 'dark';
      btn.setAttribute('aria-pressed', dark ? 'false' : 'true');
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.title = dark ? 'Light mode' : 'Dark mode';
    }

    syncButton();
    btn.addEventListener('click', function () {
      window.__theme.toggle();
      syncButton();
    });
    window.addEventListener('themechange', syncButton);
  });
})();
