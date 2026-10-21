/* Three-second entry animation; authentication credentials remain untouched. */
(() => {
  'use strict';
  let skipInitial = false;
  try {
    const record = JSON.parse(window.sessionStorage.getItem('bga-entry-intro-completed') || 'null');
    window.sessionStorage.removeItem('bga-entry-intro-completed');
    skipInitial =
      !!record &&
      Number.isFinite(record.at) &&
      Date.now() - record.at >= 0 &&
      Date.now() - record.at < 15000 &&
      record.path === window.location.pathname + window.location.search;
  } catch {
    /* Optional handoff state must never block entry. */
  }
  if (!skipInitial) {
    try {
      const match = (document.cookie || '').match(/(?:^|;\s*)bga_entry_intro=([^;]+)/);
      const record = match && JSON.parse(decodeURIComponent(match[1]));
      if (match) document.cookie = 'bga_entry_intro=; Max-Age=0; Path=/; SameSite=Lax';
      skipInitial =
        !!record &&
        Number.isFinite(record.at) &&
        Date.now() - record.at >= 0 &&
        Date.now() - record.at < 15000 &&
        record.path === window.location.pathname + window.location.search;
    } catch {
      /* The default entry remains available. */
    }
  }
  // This small blocking bootstrap runs before body parsing, avoiding a second overlay flash.
  if (skipInitial) document.documentElement.classList.add('entry-intro-skipped');
  function boot() {
    const panel = document.getElementById('entry-intro');
    if (!panel) return;
    let timer,
      observer,
      previous,
      active = false;
    function finish() {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      observer?.disconnect();
      if (panel.open) panel.close();
      panel.hidden = true;
      document.documentElement.classList.remove('entry-intro-active');
      if (previous?.isConnected && previous !== document.body)
        previous.focus({ preventScroll: true });
    }
    function promote() {
      if (!active || !panel.showModal) return;
      try {
        if (panel.open) panel.close();
        panel.showModal();
      } catch {
        /* The CSS-only introduction still ends automatically. */
      }
    }
    function play() {
      if (active) return;
      active = true;
      previous = document.activeElement;
      panel.hidden = false;
      try {
        const saved = JSON.parse(localStorage.getItem('ah-motion-settings') || 'null');
        panel.classList.toggle('entry-intro-reduced', saved?.enabled === false);
      } catch {
        /* Storage restrictions must not block entry. */
      }
      const elapsed =
        Number(
          panel.getAnimations?.().find((a) => a.animationName === 'entry-intro-curtain')
            ?.currentTime,
        ) || 0;
      // Do not block for another three seconds if the script arrived after the CSS animation.
      timer = setTimeout(finish, Math.max(0, 3000 - elapsed));
      document.documentElement.classList.add('entry-intro-active');
      promote();
      if (window.MutationObserver) {
        observer = new MutationObserver((entries) => {
          if (
            entries.some(
              (e) => e.target !== panel && e.target.tagName === 'DIALOG' && e.target.open,
            )
          )
            promote();
        });
        observer.observe(document.body, {
          subtree: true,
          attributes: true,
          attributeFilter: ['open'],
        });
      }
    }
    panel.querySelector('button').addEventListener('click', finish);
    panel.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish();
    });
    window.addEventListener('pagehide', finish);
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) play();
    });
    if (skipInitial) {
      if (panel.open) panel.close();
      panel.hidden = true;
      document.documentElement.classList.remove('entry-intro-skipped');
    } else play();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
