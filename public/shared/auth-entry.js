/* Animate the already rendered auth image; do not recreate it on the destination page. */
(() => {
  'use strict';
  let playing;
  window.EntryIntro = {
    playFrom(image, destination) {
      if (window.EntryPreferences?.get().enabled === false) return Promise.resolve();
      if (playing) return playing;
      if (!image || !image.complete || !image.naturalWidth) return Promise.resolve();
      const rect = image.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return Promise.resolve();
      const target = new URL(destination, window.location.href);
      if (target.origin !== window.location.origin) return Promise.resolve();
      const root = document.documentElement;
      const ancestors = [];
      for (
        let node = image.parentElement;
        node && node !== document.body;
        node = node.parentElement
      )
        ancestors.push(node);
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'entry-auth-skip';
      skip.textContent = '略過開場 →';
      skip.setAttribute('aria-label', '略過開場動畫');
      const soundButton = document.createElement('button');
      soundButton.type = 'button';
      soundButton.className = 'entry-auth-sound';
      soundButton.textContent = '播放開場音效 ♪';
      soundButton.hidden = true;
      const prefetch = document.createElement('link');
      prefetch.rel = 'prefetch';
      prefetch.href = target.href;
      prefetch.as = 'document';
      document.head.append(prefetch);
      document.body.append(skip);
      document.body.append(soundButton);
      let animation,
        sound,
        timer,
        recovery,
        finished = false;
      function stopSound() {
        if (!sound) return;
        if (!window.AudioSettings?.stopEffect?.(sound)) sound.pause?.();
        sound = null;
      }
      function playSound() {
        stopSound();
        sound = window.AudioSettings?.playEffect?.('entry-intro', {
          onError: () => {
            if (!finished) soundButton.hidden = false;
          },
        });
      }
      const cleanup = () => {
        clearTimeout(timer);
        clearTimeout(recovery);
        animation?.cancel();
        stopSound();
        image.style.removeProperty('opacity');
        root.classList.remove('entry-auth-playing');
        image.classList.remove('entry-auth-image');
        for (const node of ancestors) node.classList.remove('entry-auth-ancestor');
        skip.remove();
        soundButton.remove();
        prefetch.remove();
        document.removeEventListener('keydown', escape);
        window.removeEventListener('pagehide', cleanup);
        playing = null;
      };
      const escape = (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        finish();
      };
      let resolve;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        stopSound();
        const record = JSON.stringify({ at: Date.now(), path: target.pathname + target.search });
        try {
          window.sessionStorage.setItem('bga-entry-intro-completed', record);
        } catch {
          try {
            document.cookie = `bga_entry_intro=${encodeURIComponent(record)}; Max-Age=10; Path=/; SameSite=Lax`;
          } catch {
            /* Entry still works even if all optional persistence is blocked. */
          }
        }
        // Keep the outgoing frame hidden until navigation, including a slow document response.
        animation?.cancel();
        animation = undefined;
        image.style.opacity = '0';
        skip.hidden = true;
        soundButton.hidden = true;
        recovery = setTimeout(() => {
          image.style.removeProperty('opacity');
          cleanup();
        }, 10000);
        resolve();
      };
      playing = new Promise((done) => {
        resolve = done;
      });
      window.addEventListener('pagehide', cleanup);
      document.addEventListener('keydown', escape);
      skip.addEventListener('click', finish);
      soundButton.addEventListener('click', () => {
        if (finished) return;
        soundButton.hidden = true;
        animation?.cancel();
        animation = undefined;
        image.style.opacity = '1';
        clearTimeout(timer);
        timer = setTimeout(finish, 2300);
        playSound();
      });
      root.classList.add('entry-auth-playing');
      image.classList.add('entry-auth-image');
      for (const node of ancestors) node.classList.add('entry-auth-ancestor');
      let reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      try {
        reduced ||=
          JSON.parse(localStorage.getItem('ah-motion-settings') || 'null')?.enabled === false;
      } catch {
        /* Optional preference. */
      }
      const scale = Math.max(
        1,
        Math.min(
          1080,
          window.innerWidth * 0.9,
          (window.innerHeight * 0.78 * rect.width) / rect.height,
        ) / rect.width,
      );
      const transform = `translate(${window.innerWidth / 2 - rect.x - rect.width / 2}px, ${window.innerHeight / 2 - rect.y - rect.height / 2}px) scale(${scale})`;
      try {
        animation = image.animate(
          [
            { transform: 'none', opacity: 1 },
            { offset: 0.78, transform: reduced ? 'none' : transform, opacity: 1 },
            { transform: reduced ? 'none' : transform, opacity: 0 },
          ],
          { duration: 3000, easing: 'cubic-bezier(.2,.65,.3,1)', fill: 'forwards' },
        );
      } catch {
        /* The timeout still completes when Web Animations is unavailable. */
      }
      timer = setTimeout(finish, 3000);
      playSound();
      skip.focus({ preventScroll: true });
      return playing;
    },
  };
})();
