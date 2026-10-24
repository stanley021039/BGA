const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('./helpers/browser-modules.cjs');
const vm = require('node:vm');
const { dom } = require('./helpers/widget-dom.cjs');

function fixture({
  reduced = false,
  blocked = false,
  animationError = false,
  entryEnabled = true,
  withAudio = false,
  audioBlocked = false,
  effectsEnabled = true,
} = {}) {
  const { document } = dom(
    '<main><figure id="authArtwork"><img src="/assets/auth/login-576.webp"></figure><form><button>登入</button></form></main>',
  );
  document.documentElement = document.createElement('html');
  document.head = document.createElement('head');
  const image = document.querySelector('img');
  image.complete = true;
  image.naturalWidth = 576;
  image.getBoundingClientRect = () => ({ x: 350, y: 280, width: 576, height: 324 });
  image.style.removeProperty = (name) => {
    delete image.style[name];
  };
  let frames,
    options,
    cancelled = 0,
    id = 0;
  image.animate = (keys, config) => {
    if (animationError) throw Error('animation unavailable');
    frames = keys;
    options = config;
    return {
      cancel() {
        cancelled++;
      },
    };
  };
  const timers = new Map(),
    storage = new Map(),
    events = new Map(),
    sounds = [];
  const window = {
    EntryOpening: undefined,
    AudioSettings: withAudio
      ? {
          playEffect(kind, options) {
            if (!effectsEnabled) return;
            const sound = { kind, stopped: false };
            sounds.push(sound);
            if (audioBlocked && sounds.length === 1) options.onError();
            return sound;
          },
          stopEffect(sound) {
            sound.stopped = true;
            return true;
          },
        }
      : undefined,
    EntryPreferences: { get: () => ({ enabled: entryEnabled }) },
    innerWidth: 1920,
    innerHeight: 1080,
    location: new URL('http://localhost/login'),
    matchMedia: () => ({ matches: reduced }),
    sessionStorage: {
      setItem(k, v) {
        if (blocked) throw Error('blocked');
        storage.set(k, v);
      },
    },
    addEventListener: (k, fn) => events.set(k, fn),
    removeEventListener: (k) => events.delete(k),
  };
  vm.runInNewContext(fs.readFileSync('public/shared/auth-entry.js', 'utf8'), {
    window,
    document,
    URL,
    AbortController,
    localStorage: { getItem: () => null },
    setTimeout(fn, delay) {
      timers.set(++id, { fn, delay });
      return id;
    },
    clearTimeout(key) {
      timers.delete(key);
    },
  });
  return {
    sounds,
    document,
    image,
    storage,
    events,
    timers,
    window,
    get frames() {
      return frames;
    },
    get options() {
      return options;
    },
    get cancelled() {
      return cancelled;
    },
    start: () =>
      window.EntryIntro.playFrom(image, '/quacks/ABC123', { id: 'default', duration: 3000 }),
    finish: () => [...timers.values()].find((t) => t.delay === 3000).fn(),
  };
}

test('auth animates the same image without reparenting or rebuilding; navigation waits three seconds', async () => {
  const f = fixture(),
    parent = f.image.parentElement;
  let navigated = false;
  const result = f.start();
  result.then(() => {
    navigated = true;
  });
  assert.equal(f.document.documentElement.classList.contains('entry-auth-playing'), true);
  assert.equal(f.image.parentElement, parent);
  assert.equal(f.document.querySelectorAll('img').length, 1);
  assert.equal(f.frames[0].transform, 'none');
  assert.match(f.frames[1].transform, /translate\(322px, 98px\)/);
  assert.equal(f.options.duration, 3000);
  assert.equal(navigated, false);
  assert.equal(f.start(), result);
  f.finish();
  await result;
  assert.equal(navigated, true);
  assert.equal(JSON.parse(f.storage.get('bga-entry-intro-completed')).path, '/quacks/ABC123');
  assert.equal(f.image.style.opacity, '0');
  f.events.get('pagehide')();
  assert.equal(f.document.documentElement.classList.contains('entry-auth-playing'), false);
  assert.equal(f.image.style.opacity, undefined);
  assert.equal(f.cancelled, 1);
  assert.equal(f.timers.size, 0);
});

test('skip resolves immediately and reduced-motion avoids scaling', async () => {
  const f = fixture({ reduced: true });
  const result = f.start();
  assert.equal(f.frames[1].transform, 'none');
  f.document.querySelector('.entry-auth-skip').dispatch('click');
  await result;
  assert.equal(f.document.querySelector('.entry-auth-skip').hidden, true);
});

test('Escape finishes the auth animation without waiting for its timer', async () => {
  const f = fixture();
  const result = f.start();
  const event = f.document.body.dispatch('keydown', { key: 'Escape' });
  assert.equal(event.defaultPrevented, true);
  await result;
  assert.equal(f.cancelled, 1);
  assert.equal(
    [...f.timers.values()].some((timer) => timer.delay === 3000),
    false,
  );
});

test('blocked storage and unavailable animation still complete, and failed navigation recovers the auth UI', async () => {
  const f = fixture({ blocked: true, animationError: true });
  const result = f.start();
  f.finish();
  await result;
  assert.match(f.document.cookie, /bga_entry_intro=/);
  [...f.timers.values()].find((t) => t.delay === 10000).fn();
  assert.equal(f.document.documentElement.classList.contains('entry-auth-playing'), false);
  assert.equal(f.document.querySelector('.entry-auth-skip'), null);
});

test('successful auth entrance plays its cue once and stops it when skipped', async () => {
  const f = fixture({ withAudio: true });
  const playing = f.start();
  assert.equal(f.sounds.length, 1);
  assert.equal(f.sounds[0].kind, 'entry-intro');
  assert.equal(f.start(), playing);
  assert.equal(f.sounds.length, 1);
  f.document.querySelector('.entry-auth-skip').dispatch('click');
  await playing;
  assert.equal(f.sounds[0].stopped, true);
});

test('auth entrance preserves mute and stops audio on pagehide', () => {
  const muted = fixture({ withAudio: true, effectsEnabled: false });
  muted.start();
  assert.equal(muted.sounds.length, 0);
  const playing = fixture({ withAudio: true });
  playing.start();
  playing.events.get('pagehide')();
  assert.equal(playing.sounds[0].stopped, true);
  assert.equal(playing.document.querySelector('.entry-auth-sound'), null);
});

test('blocked auth entrance audio offers a gesture retry without stalling navigation', async () => {
  const f = fixture({ withAudio: true, audioBlocked: true });
  const playing = f.start();
  const retry = f.document.querySelector('.entry-auth-sound');
  assert.equal(retry.hidden, false);
  retry.dispatch('click');
  assert.equal(retry.hidden, true);
  assert.equal(f.sounds.length, 2);
  assert.equal(f.sounds[0].stopped, true);
  [...f.timers.values()].find((timer) => timer.delay === 2300).fn();
  await playing;
  assert.equal(f.sounds[1].stopped, true);
});

test('disabled entry returns immediately without hiding auth UI, creating timers or completion records', async () => {
  const f = fixture({ entryEnabled: false });
  await f.start();
  assert.equal(f.frames, undefined);
  assert.equal(f.timers.size, 0);
  assert.equal(f.storage.size, 0);
  assert.equal(f.document.documentElement.classList.contains('entry-auth-playing'), false);
  assert.equal(f.document.querySelector('.entry-auth-skip'), null);
  assert.equal(f.image.style.opacity, undefined);
});

test('submit unlocks audio before async authentication and the opening reuses that context', async () => {
  const f = fixture({ withAudio: true });
  let resumed = 0,
    started = 0,
    stopped = 0;
  const context = {
    state: 'suspended',
    destination: {},
    resume() {
      resumed++;
      this.state = 'running';
      return Promise.resolve();
    },
    decodeAudioData: async () => ({}),
    createBufferSource: () => ({
      connect: () => ({ connect() {} }),
      start() {
        started++;
      },
      stop() {
        stopped++;
      },
    }),
    createGain: () => ({ gain: {} }),
  };
  f.window.AudioContext = function () {
    return context;
  };
  f.window.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  f.window.EntryIntro.prepareSound();
  assert.equal(resumed, 1, 'resume runs in the submit call, before awaiting login');
  await Promise.resolve();
  const playing = f.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started, 1);
  assert.equal(f.sounds.length, 0, 'no second HTML audio playback');
  f.finish();
  await playing;
  assert.equal(stopped, 1);
});

test('skipping an opening while audio downloads prevents late playback', async () => {
  const f = fixture({ withAudio: true });
  let release,
    started = 0;
  f.window.AudioContext = function () {
    return {
      state: 'running',
      resume: async () => {},
      decodeAudioData: async () => ({}),
      createBufferSource() {
        started++;
        throw Error('late playback');
      },
    };
  };
  f.window.fetch = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  f.window.EntryIntro.prepareSound();
  const playing = f.start();
  f.finish();
  await playing;
  release({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started, 0);
});

test('unlocked opening audio follows live volume and mute preferences and unsubscribes on exit', async () => {
  const f = fixture({ withAudio: true });
  const gain = { gain: {} };
  let listener,
    stopped = 0,
    unsubscribed = 0;
  f.window.AudioSettings.get = () => ({ effects: { enabled: true, volume: 0.25 } });
  f.window.AudioSettings.subscribe = (callback) => {
    listener = callback;
    return () => unsubscribed++;
  };
  f.window.AudioContext = function () {
    return {
      state: 'running',
      destination: {},
      resume: async () => {},
      decodeAudioData: async () => ({}),
      createGain: () => gain,
      createBufferSource: () => ({
        connect: () => ({ connect() {} }),
        start() {},
        stop() {
          stopped++;
        },
      }),
    };
  };
  f.window.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  f.window.EntryIntro.prepareSound();
  const playing = f.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(gain.gain.value, 0.25);
  listener({ effects: { enabled: true, volume: 0.1 } });
  assert.equal(gain.gain.value, 0.1, 'a running opening must follow nonzero volume changes');
  listener({ effects: { enabled: false, volume: 0.1 } });
  assert.equal(stopped, 1);
  f.finish();
  await playing;
  f.events.get('pagehide')();
  assert.equal(unsubscribed, 1);
});
