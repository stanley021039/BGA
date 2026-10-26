let AudioSettings;
/* Personal sound preferences shared by every game; room transport stays on the server. */
(() => {
  if (typeof document === 'undefined') return;
  const key = 'ah-audio-settings',
    listeners = new Set(),
    effects = new Map(),
    gameEffects = new Set();
  const defaults = () => ({
    version: 2,
    music: { enabled: false, volume: 0.3 },
    effects: { enabled: true, volume: 0.25 },
  });
  const validVolume = (value) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  function normalize(value) {
    const result = defaults();
    for (const kind of ['music', 'effects']) {
      if (typeof value?.[kind]?.enabled === 'boolean') result[kind].enabled = value[kind].enabled;
      if (validVolume(value?.[kind]?.volume)) result[kind].volume = value[kind].volume;
    }
    return result;
  }
  function read() {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        const savedValue = JSON.parse(saved),
          result = normalize(savedValue);
        if (savedValue?.version !== 2) result.effects.enabled = true;
        return result;
      }
      const result = defaults();
      result.music.enabled = localStorage.getItem('ah-music-listen') === 'on';
      for (const [kind, keys] of [
        ['music', ['ah-music-volume']],
        ['effects', ['ah-gift-volume', 'ah-majority-volume', 'ah-race-volume', 'ah-poker-volume']],
      ])
        for (const old of keys) {
          const raw = localStorage.getItem(old);
          if (raw !== null && raw.trim() !== '' && validVolume(Number(raw))) {
            result[kind].volume = Number(raw);
            break;
          }
        }
      return result;
    } catch {
      return defaults();
    }
  }
  let preferences = read();
  const get = () => normalize(preferences);
  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify(preferences));
    } catch {}
  }
  function stopEffect(clip) {
    const cleanup = effects.get(clip);
    if (!cleanup) return false;
    effects.delete(clip);
    gameEffects.delete(clip);
    cleanup();
    return true;
  }
  function stopEffects() {
    for (const clip of [...effects.keys()]) stopEffect(clip);
  }
  function notify(gesture = false) {
    const settings = get();
    if (!settings.effects.enabled || !settings.effects.volume) stopEffects();
    else for (const clip of effects.keys()) clip.volume = settings.effects.volume;
    for (const listener of listeners) listener(settings, { gesture });
  }
  function set(kind, patch, { gesture = false } = {}) {
    if (!['music', 'effects'].includes(kind)) return;
    if (typeof patch.enabled === 'boolean') preferences[kind].enabled = patch.enabled;
    if (validVolume(patch.volume)) preferences[kind].volume = patch.volume;
    persist();
    notify(gesture);
  }
  function subscribe(listener) {
    listeners.add(listener);
    listener(get(), { gesture: false });
    return () => listeners.delete(listener);
  }
  const musicPlayers = new Set(),
    musicInterruptions = new Set();
  function registerMusic(controller) {
    const entry = { controller, resume: false };
    musicPlayers.add(entry);
    if (musicInterruptions.size) {
      entry.resume = controller.isPlaying();
      controller.pause();
    }
    const unregister = () => musicPlayers.delete(entry);
    unregister.requestResume = () => {
      entry.resume = true;
    };
    return unregister;
  }
  function suspendMusic() {
    const token = {};
    musicInterruptions.add(token);
    if (musicInterruptions.size === 1)
      for (const e of musicPlayers) {
        e.resume = !!e.controller.isPlaying();
        e.controller.pause();
      }
    const releaseTable = window.TableMusic?.suspendLocal?.();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseTable?.();
      musicInterruptions.delete(token);
      if (!musicInterruptions.size)
        for (const e of musicPlayers) {
          const resume = e.resume;
          e.resume = false;
          if (resume && !document.hidden && preferences.music.enabled) e.controller.resume();
        }
    };
  }
  function bindPreview(audio) {
    const unregister = registerMusic({
      isPlaying: () => !audio.paused && !audio.ended,
      pause: () => audio.pause(),
      resume: () => {
        if (audio.isConnected !== false) Promise.resolve(audio.play()).catch(() => {});
      },
    });
    const unbind = subscribe((settings) => {
      audio.volume = settings.music.volume;
      audio.muted = !settings.music.enabled;
    });
    const play = () => {
      set('music', { enabled: true }, { gesture: true });
      if (musicInterruptions.size) {
        unregister.requestResume();
        audio.pause();
      }
    };
    const change = () => {
      const current = preferences.music;
      if (audio.volume !== current.volume || audio.muted === current.enabled)
        set('music', { volume: audio.volume, enabled: !audio.muted }, { gesture: true });
    };
    audio.addEventListener('play', play);
    audio.addEventListener('volumechange', change);
    return () => {
      unregister();
      unbind();
      audio.removeEventListener('play', play);
      audio.removeEventListener('volumechange', change);
    };
  }
  function playClip(
    url,
    durationMs,
    { onError, onStop, game = false, maxStartDelayMs = 10000 } = {},
  ) {
    const settings = preferences.effects;
    if (
      !settings.enabled ||
      !settings.volume ||
      document.hidden ||
      effects.size >= 4 ||
      (game && gameEffects.size >= 2)
    )
      return;
    let clip;
    try {
      clip = new Audio(url);
      clip.volume = settings.volume;
      let playing = false,
        deadline = setTimeout(() => stopEffect(clip), maxStartDelayMs);
      effects.set(clip, () => {
        clearTimeout(deadline);
        clip.onplaying = null;
        clip.onended = null;
        clip.onerror = null;
        try {
          clip.pause();
          clip.currentTime = 0;
          clip.removeAttribute('src');
          clip.load();
        } catch {}
        try {
          onStop?.(clip);
        } catch {}
      });
      if (game) gameEffects.add(clip);
      if (
        game &&
        document.body.dataset.gameKind === 'quacks' &&
        new URLSearchParams(location.search).has('ui-verify')
      )
        clip.addEventListener('playing', () =>
          console.debug('[quacks-audio] playing ' + new URL(clip.src, location.origin).pathname),
        );
      if (game && url.startsWith('/assets/game-sounds/ping-'))
        clip.addEventListener('playing', () => console.debug('[ping-audio] playing ' + url));
      const started = () => {
        if (!effects.has(clip)) {
          try {
            clip.pause();
          } catch {}
          return;
        }
        if (playing) return;
        playing = true;
        clearTimeout(deadline);
        deadline = setTimeout(() => stopEffect(clip), Math.min(20000, durationMs));
      };
      const failed = () => {
        if (stopEffect(clip)) onError?.();
      };
      clip.onplaying = started;
      clip.onended = () => stopEffect(clip);
      clip.onerror = failed;
      Promise.resolve(clip.play()).then(started, failed);
      return clip;
    } catch {
      if (clip) stopEffect(clip);
      onError?.();
    }
  }
  function playEffect(kind, options = {}) {
    // The 580ms draw recording uses onended; a 1s safety margin tolerates delayed media clocks.
    // Reuse the existing short double tone; warning is a distinct once-per-round cue.
    if (kind === 'countdown-warning') kind = 'turn';
    const cues = {
      'ping-ping': ['/assets/game-sounds/ping-ping.wav', 1126],
      'ping-attention': ['/assets/game-sounds/ping-attention.wav', 2613],
      'ping-question': ['/assets/game-sounds/ping-question.wav', 1131],
      'ping-help': ['/assets/game-sounds/ping-help.wav', 2802],
      'ping-look': ['/assets/game-sounds/ping-look.wav', 1706],
      'ping-voice-amazing': ['/assets/game-sounds/ping-voice-amazing.mp3', 3360],
      'ping-voice-bad': ['/assets/game-sounds/ping-voice-bad.mp3', 4880],
      'ping-voice-card-check': ['/assets/game-sounds/ping-voice-card-check.mp3', 1180],
      'ping-voice-sleep': ['/assets/game-sounds/ping-voice-sleep.mp3', 1120],
      'ping-voice-look': ['/assets/game-sounds/ping-voice-look.mp3', 910],
      'ping-voice-legacy': ['/assets/game-sounds/ping-voice-legacy.mp3', 4250],
      'ping-voice-no-bluff': ['/assets/game-sounds/ping-voice-no-bluff.mp3', 2510],
      'ping-voice-cry': ['/assets/game-sounds/ping-voice-cry.mp3', 700],
      'ping-voice-coward': ['/assets/game-sounds/ping-voice-coward.mp3', 2420],
      'ping-voice-goodnight': ['/assets/game-sounds/ping-voice-goodnight.mp3', 3550],
      'ping-voice-senior': ['/assets/game-sounds/ping-voice-senior.mp3', 8500],
      'ping-voice-practice': ['/assets/game-sounds/ping-voice-practice.mp3', 1570],
      'ping-voice-huh': ['/assets/game-sounds/ping-voice-huh.mp3', 910],
      'ping-voice-what': ['/assets/game-sounds/ping-voice-what.mp3', 2040],
      'entry-home-family': ['/assets/game-sounds/entry-home-family.mp3', 8500],
      'entry-intro': ['/assets/game-sounds/entry-intro-user.mp3', 2040],
      'entrance-soul-world': ['/assets/game-sounds/entrance-soul-world.mp3', 3610],
      'majority-settlement': ['/assets/game-sounds/quacks-settlement-user.wav', 660],
      'quacks-stop': ['/assets/game-sounds/quacks-decline-user.wav', 1811],
      'quacks-settlement': ['/assets/game-sounds/quacks-settlement-user.wav', 660],
      'quacks-explosion': ['/assets/game-sounds/quacks-explosion-fish.wav', 1428],
      'quacks-draw': ['/assets/game-sounds/quacks-push-user.wav', 1580],
      'quacks-danger': ['/assets/game-sounds/quacks-danger.wav', 420],
      'quacks-potion': ['/assets/game-sounds/quacks-drink-real.mp3', 2700],
      'quacks-buy': ['/assets/game-sounds/quacks-buy.wav', 380],
      'quacks-ruby': ['/assets/game-sounds/quacks-ruby.wav', 460],
      'quacks-witch': ['/assets/game-sounds/quacks-witch.wav', 750],
      settlement: ['/assets/game-sounds/quacks-settlement.wav', 420],
      'potion-drink': ['/assets/game-sounds/quacks-drink-real.mp3', 2700],
      'ingredient-draw': ['/assets/game-sounds/quacks-push-user.wav', 1580],
      'card-draw': ['/assets/game-sounds/quacks-card.wav', 1500],
      'bluff-reaction': ['/assets/game-sounds/bluff-reaction.mp3', 1700],
      confirm: ['/assets/gift-sounds/confirmation_001.wav', 10000],
      reveal: ['/assets/gift-sounds/open_001.wav', 10000],
      turn: ['/assets/game-sounds/turn.wav', 720],
      invitation: ['/assets/game-sounds/turn.wav', 720],
      correct: ['/assets/game-sounds/correct-user.mp3', 3500],
      incorrect: ['/assets/game-sounds/incorrect-user.mp3', 1700],
      'dice-roll': ['/assets/game-sounds/dice-roll.wav', 650],
      shot: ['/assets/game-sounds/shot.wav', 1450],
      slam: ['/assets/game-sounds/slam.wav', 680],
      explosion: ['/assets/game-sounds/quacks-explosion.wav', 1600],
      nitro: ['/assets/game-sounds/nitro.wav', 1400],
      skid: ['/assets/game-sounds/skid.wav', 740],
    };
    const cue = Object.hasOwn(cues, kind) ? cues[kind] : null;
    if (cue) {
      const release =
        ['correct', 'incorrect'].includes(kind) &&
        preferences.effects.enabled &&
        preferences.effects.volume &&
        !document.hidden &&
        effects.size < 4 &&
        gameEffects.size < 2
          ? suspendMusic()
          : null;
      const clip = playClip(cue[0], cue[1], {
        onError: options.onError,
        onStop: () => {
          release?.();
          options.onStop?.();
        },
        game: kind !== 'invitation',
        maxStartDelayMs:
          kind === 'confirm' || kind === 'reveal'
            ? 10000
            : kind.startsWith('ping-voice-')
              ? 5000
              : ['ingredient-draw', 'quacks-draw', 'quacks-stop'].includes(kind)
                ? 3000
                : 1000,
      });
      if (!clip) release?.();
      return clip;
    }
  }
  // Only server-issued character sound resources may use the controlled effect player.
  function playExpression(sound, options = {}) {
    if (
      !sound ||
      typeof sound.url !== 'string' ||
      !Number.isInteger(sound.durationMs) ||
      sound.durationMs < 1 ||
      sound.durationMs > 10000
    )
      return;
    try {
      const url = new URL(sound.url, location.origin),
        uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
      if (
        url.origin !== location.origin ||
        url.username ||
        url.password ||
        url.hash ||
        !new RegExp(
          '^/assets/characters/sounds/' +
            uuid +
            '/(?:happy|sad|surprised|thinking|angry|emote-' +
            uuid +
            ')$',
          'i',
        ).test(url.pathname)
      )
        return;
      const queries = [...url.searchParams];
      if (
        queries.length > 1 ||
        (queries.length === 1 && (queries[0][0] !== 'v' || !/^[a-f0-9]{64}$/i.test(queries[0][1])))
      )
        return;
      return playClip(url.pathname + url.search, sound.durationMs, options);
    } catch {}
  }
  // Browsers may require a fresh gesture after navigation, including default-enabled effects.
  const unlock = (event) => {
    if (event.isTrusted) notify(true);
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopEffects();
  });
  window.addEventListener('pagehide', stopEffects);
  window.addEventListener('storage', (event) => {
    if (event.key === key || event.key === null) {
      preferences = read();
      notify();
    }
  });
  persist();
  AudioSettings = {
    canPlayGameEffect: () => effects.size < 4 && gameEffects.size < 2,
    get,
    set,
    subscribe,
    bindPreview,
    registerMusic,
    suspendMusic,
    isMusicSuspended: () => musicInterruptions.size > 0,
    playEffect,
    playExpression,
    stopEffect,
    stopEffects,
  };
})();

export default AudioSettings;
