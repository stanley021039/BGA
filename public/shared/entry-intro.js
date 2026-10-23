/* Three-second entry animation; authentication credentials remain untouched. */
(() => {
  'use strict';
  // One browser-wide preference owner, shared by Vue, legacy and auth entry.
  // This script is blocking in <head>, before the overlay can be painted.
  const preferenceKey = 'bga-entry-intro-settings';
  const listeners = new Set();
  function readPreference() {
    let saved;
    try {
      saved = localStorage.getItem(preferenceKey);
    } catch {
      return { enabled: true, persisted: false };
    }
    try {
      const value = JSON.parse(saved || 'null');
      return { enabled: !(value?.version === 1 && value.enabled === false), persisted: true };
    } catch {
      return { enabled: true, persisted: true };
    }
  }
  function clearCompletion() {
    try {
      window.sessionStorage.removeItem('bga-entry-intro-completed');
    } catch {
      /* Optional UI state. */
    }
    try {
      document.cookie = 'bga_entry_intro=; Max-Age=0; Path=/; SameSite=Lax';
    } catch {
      /* Optional UI state. */
    }
  }
  function notifyPreference() {
    const value = readPreference();
    document.documentElement.classList.toggle('entry-intro-disabled', !value.enabled);
    if (!value.enabled) clearCompletion();
    for (const listener of listeners) listener({ ...value });
    return value;
  }
  window.EntryPreferences = {
    get: readPreference,
    set(enabled) {
      if (typeof enabled !== 'boolean') return readPreference();
      try {
        localStorage.setItem(preferenceKey, JSON.stringify({ version: 1, enabled }));
      } catch {
        // Do not pretend the browser saved an opt-out it cannot restore.
        const value = { ...readPreference(), persisted: false };
        document.documentElement.classList.toggle('entry-intro-disabled', !value.enabled);
        for (const listener of listeners) listener({ ...value });
        return value;
      }
      clearCompletion();
      return notifyPreference();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(readPreference());
      return () => listeners.delete(listener);
    },
  };
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === preferenceKey) notifyPreference();
  });
  window.addEventListener('pageshow', notifyPreference);
  notifyPreference();
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
  {
    try {
      const match = (document.cookie || '').match(/(?:^|;\s*)bga_entry_intro=([^;]+)/);
      const record = match && JSON.parse(decodeURIComponent(match[1]));
      if (match) document.cookie = 'bga_entry_intro=; Max-Age=0; Path=/; SameSite=Lax';
      skipInitial ||=
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
  // A full document load can still be an internal room/link navigation. Reloads
  // retain the introduction even when their referrer is another page here.
  try {
    const kind = window.performance?.getEntriesByType?.('navigation')?.[0]?.type;
    skipInitial ||=
      kind === 'back_forward' ||
      (kind === 'navigate' &&
        !!document.referrer &&
        new URL(document.referrer).origin === window.location.origin);
  } catch {
    // Missing navigation/referrer information keeps the normal entry fallback.
  }
  if (skipInitial) document.documentElement.classList.add('entry-intro-skipped');
  function boot() {
    const panel = document.getElementById('entry-intro');
    if (!panel) return;
    let timer,
      observer,
      previous,
      sound,
      active = false;
    const soundButton = panel.querySelector('.entry-intro-sound');
    let opening,
      resolving = false,
      resolved = false;
    function stopSound() {
      if (!sound) return;
      if (!window.AudioSettings?.stopEffect?.(sound)) {
        try {
          sound.pause();
        } catch {
          /* The overlay can still close. */
        }
      }
      sound = null;
    }
    function playSound() {
      if (typeof Audio !== 'function') return;
      let effects = window.AudioSettings?.get?.().effects;
      if (!effects) {
        try {
          effects = JSON.parse(localStorage.getItem('ah-audio-settings') || 'null')?.effects;
        } catch {
          /* Use normal effect defaults. */
        }
      }
      if (effects?.enabled === false || effects?.volume === 0) return;
      stopSound();
      const blocked = () => {
        if (!active) return;
        soundButton.hidden = false;
        panel.classList.add('entry-intro-audio-pending');
      };
      if (window.AudioSettings?.playEffect) {
        sound = window.AudioSettings.playEffect(opening?.sound || 'entry-intro', {
          onError: blocked,
        });
        return;
      }
      try {
        sound = new Audio(
          opening?.id === 'home-family'
            ? '/assets/game-sounds/entry-home-family.mp3'
            : opening?.id === 'soul-world'
              ? '/assets/game-sounds/entrance-soul-world.mp3'
              : '/assets/game-sounds/entry-intro-user.mp3',
        );
        sound.volume = effects?.volume ?? 0.25;
        Promise.resolve(sound.play()).catch(blocked);
      } catch {
        blocked();
      }
    }
    function finish() {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      stopSound();
      observer?.disconnect();
      if (panel.open) panel.close();
      panel.hidden = true;
      document.documentElement.classList.remove('entry-intro-active');
      if (previous?.isConnected && previous !== document.body)
        previous.focus({ preventScroll: true });
    }
    function hide() {
      finish();
      stopSound();
      if (panel.open) panel.close();
      panel.hidden = true;
      document.documentElement.classList.remove('entry-intro-active');
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
      if (!window.EntryPreferences.get().enabled) {
        hide();
        return;
      }
      if (active) return;
      if (!resolved && window.EntryOpening) {
        if (resolving) return;
        resolving = true;
        window.EntryOpening.resolve().then((theme) => {
          opening = theme;
          resolved = true;
          resolving = false;
          play();
        });
        return;
      }
      active = true;
      if (opening) {
        const image = panel.querySelector('img');
        image.src = opening.image;
        image.alt = opening.label;
        panel.style.setProperty('--entry-intro-duration', opening.duration + 'ms');
      }
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
      timer = setTimeout(finish, Math.max(0, (opening?.duration || 3000) - elapsed));
      document.documentElement.classList.add('entry-intro-active');
      promote();
      playSound();
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
    soundButton?.addEventListener('click', () => {
      soundButton.hidden = true;
      playSound();
      clearTimeout(timer);
      timer = setTimeout(finish, opening?.id !== 'default' && opening ? opening.duration : 2300);
    });
    panel.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish();
    });
    window.addEventListener('pagehide', finish);
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) hide();
    });
    window.EntryPreferences.subscribe((value) => {
      if (!value.enabled) hide();
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
