/* One three-second introduction per document entry; no login/session storage changes. */
(() => {
  'use strict';
  const originKey = 'bga-entry-intro-origin';
  window.EntryIntro = {
    prepareFrom(image) {
      if (!image) return;
      const rect = image.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      try {
        window.sessionStorage.setItem(
          originKey,
          JSON.stringify({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            at: Date.now(),
            kind: /\/register-/.test(image.currentSrc || image.src) ? 'register' : 'login',
          }),
        );
      } catch {
        /* The standard animation remains available when storage is blocked. */
      }
    },
  };
  const panel = document.getElementById('entry-intro');
  if (!panel) return;
  try {
    const origin = JSON.parse(window.sessionStorage.getItem(originKey) || 'null');
    window.sessionStorage.removeItem(originKey);
    if (
      origin &&
      ['x', 'y', 'width', 'height', 'at'].every((key) => Number.isFinite(origin[key])) &&
      origin.width > 0 &&
      origin.height > 0 &&
      Date.now() - origin.at >= 0 &&
      Date.now() - origin.at < 10000
    ) {
      const art = panel.querySelector('.entry-intro-art');
      if (art.offsetWidth && art.offsetHeight) {
        art.style.setProperty(
          '--entry-from-x',
          `${origin.x + origin.width / 2 - art.offsetLeft - art.offsetWidth / 2}px`,
        );
        art.style.setProperty(
          '--entry-from-y',
          `${origin.y + origin.height / 2 - art.offsetTop - art.offsetHeight / 2}px`,
        );
        art.style.setProperty('--entry-from-sx', String(origin.width / art.offsetWidth));
        art.style.setProperty('--entry-from-sy', String(origin.height / art.offsetHeight));
        panel.classList.add('entry-intro-from-auth');
        if (origin.kind === 'register') {
          const image = art.querySelector('img');
          image.src = '/assets/auth/register-576.webp';
          image.alt = '又來了一個新人';
        }
      }
    }
  } catch {
    /* Missing, stale or unavailable origin metadata uses the centered animation. */
  }
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
        panel.getAnimations?.().find((a) => a.animationName === 'entry-intro-curtain')?.currentTime,
      ) || 0;
    // Do not block for another three seconds if the script arrived after the CSS animation.
    timer = setTimeout(finish, Math.max(0, 3000 - elapsed));
    document.documentElement.classList.add('entry-intro-active');
    promote();
    if (window.MutationObserver) {
      observer = new MutationObserver((entries) => {
        if (
          entries.some((e) => e.target !== panel && e.target.tagName === 'DIALOG' && e.target.open)
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
  play();
})();
