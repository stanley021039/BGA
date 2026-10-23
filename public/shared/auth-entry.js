/* Animate the already rendered auth image; do not recreate it on the destination page. */
(() => {
  'use strict';
  let playing;
  let entryAudio;
  window.EntryIntro = {
    prepareSound() {
      if (window.EntryPreferences?.get().enabled === false) return;
      const settings = window.AudioSettings?.get?.().effects;
      if (settings?.enabled === false || settings?.volume === 0) return;
      try {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        if (!entryAudio || entryAudio.state === 'closed') entryAudio = new Context();
        // Resume synchronously in the submit gesture, before authentication awaits.
        Promise.resolve(entryAudio.resume()).catch(() => {});
      } catch {}
    },
    playFrom(image, destination, opening) {
      if (window.EntryPreferences?.get().enabled === false) return Promise.resolve();
      if (playing) return playing;
      if (!opening && window.EntryOpening)
        return window.EntryOpening.resolve().then((theme) =>
          window.EntryIntro.playFrom(image, destination, theme),
        );
      const duration = opening?.duration || 3000;
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
      let source,
        audioRequest,
        unsubscribe,
        soundRevision = 0;
      function stopSound() {
        soundRevision++;
        audioRequest?.abort();
        audioRequest = null;
        try {
          source?.stop();
        } catch {}
        source = null;
        if (!sound) return;
        if (!window.AudioSettings?.stopEffect?.(sound)) sound.pause?.();
        sound = null;
      }
      function playSound() {
        stopSound();
        const settings = window.AudioSettings?.get?.().effects;
        if (settings?.enabled === false || settings?.volume === 0) return;
        if (entryAudio?.state === 'running') {
          const revision = soundRevision;
          const url =
            opening?.id === 'home-family'
              ? '/assets/game-sounds/entry-home-family.mp3'
              : opening?.id === 'soul-world'
                ? '/assets/game-sounds/entrance-soul-world.mp3'
                : '/assets/game-sounds/entry-intro-user.mp3';
          audioRequest = new AbortController();
          window
            .fetch(url, { signal: audioRequest.signal })
            .then((response) => {
              if (!response.ok) throw Error('audio unavailable');
              return response.arrayBuffer();
            })
            .then((bytes) => entryAudio.decodeAudioData(bytes))
            .then((buffer) => {
              if (finished || revision !== soundRevision) return;
              const current = window.AudioSettings?.get?.().effects;
              if (current?.enabled === false || current?.volume === 0) return;
              source = entryAudio.createBufferSource();
              source.buffer = buffer;
              const gain = entryAudio.createGain();
              gain.gain.value = current?.volume ?? 0.25;
              source.connect(gain).connect(entryAudio.destination);
              source.start();
            })
            .catch(() => {
              if (!finished && revision === soundRevision) soundButton.hidden = false;
            });
          return;
        }
        sound = window.AudioSettings?.playEffect?.(opening?.sound || 'entry-intro', {
          onError: () => {
            if (!finished) soundButton.hidden = false;
          },
        });
      }
      const cleanup = () => {
        unsubscribe?.();
        clearTimeout(timer);
        clearTimeout(recovery);
        animation?.cancel();
        stopSound();
        image.style.removeProperty('opacity');
        root.classList.remove('entry-auth-playing');
        image.classList.remove('entry-auth-image');
        image.classList.remove('entry-auth-soul-world');
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
      unsubscribe = window.AudioSettings?.subscribe?.((settings) => {
        if (settings.effects.enabled === false || settings.effects.volume === 0) stopSound();
      });
      document.addEventListener('keydown', escape);
      skip.addEventListener('click', finish);
      soundButton.addEventListener('click', () => {
        if (finished) return;
        soundButton.hidden = true;
        animation?.cancel();
        animation = undefined;
        image.style.opacity = '1';
        clearTimeout(timer);
        timer = setTimeout(finish, opening?.id === 'soul-world' ? duration : 2300);
        playSound();
      });
      root.classList.add('entry-auth-playing');
      image.classList.add('entry-auth-image');
      if (opening?.id === 'soul-world') image.classList.add('entry-auth-soul-world');
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
          { duration, easing: 'cubic-bezier(.2,.65,.3,1)', fill: 'forwards' },
        );
      } catch {
        /* The timeout still completes when Web Animations is unavailable. */
      }
      timer = setTimeout(finish, duration);
      playSound();
      skip.focus({ preventScroll: true });
      return playing;
    },
  };
})();
