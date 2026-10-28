const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('./helpers/browser-modules.cjs'),
  path = require('node:path'),
  { createHash } = require('node:crypto'),
  vm = require('node:vm');
const source = (file) => fs.readFileSync(path.join(__dirname, '../public/shared', file), 'utf8');
test('invitation notifications share effect preferences and the global cap while leaving the two game slots unchanged', () => {
  const ui = harness();
  assert.ok(ui.api.playEffect('turn'));
  assert.ok(ui.api.playEffect('dice-roll'));
  assert.equal(ui.api.playEffect('turn'), undefined, 'game cap remains two');
  const invitation = ui.api.playEffect('invitation');
  assert.ok(invitation);
  assert.equal(invitation.src, '/assets/game-sounds/turn.wav');
  assert.equal(invitation.volume, 0.25);
  assert.ok(ui.api.playEffect('invitation'));
  assert.equal(ui.api.playEffect('invitation'), undefined, 'global cap remains four');
  ui.api.set('effects', { enabled: false });
  assert.ok(invitation.paused);
  const created = ui.clips.length;
  assert.equal(ui.api.playEffect('invitation'), undefined);
  assert.equal(ui.clips.length, created, 'muted notifications never load audio');
});
function harness(saved = {}, blocked = false, storageBlocked = false, musicNetwork = {}) {
  const storage = new Map(Object.entries(saved)),
    listeners = new Map(),
    clips = [],
    nodes = new Map(),
    requests = [];
  const node = (id) => {
    if (!nodes.has(id))
      nodes.set(id, {
        hidden: false,
        value: '',
        children: [],
        dataset: {},
        textContent: '',
        innerHTML: '',
        attributes: {},
        classList: { toggle() {} },
        querySelector: node,
        append(...children) {
          this.children.push(...children);
        },
        replaceChildren(...children) {
          this.children = children;
        },
        setAttribute(k, v) {
          this.attributes[k] = v;
        },
        getAttribute(k) {
          return this.attributes[k];
        },
      });
    return nodes.get(id);
  };
  const document = {
    hidden: false,
    createElement: () => node('panel'),
    body: { dataset: {}, append() {} },
    querySelector: () => null,
    addEventListener(type, fn) {
      const key = 'document:' + type;
      listeners.set(key, [...(listeners.get(key) || []), fn]);
    },
  };
  const window = {
    addEventListener(type, fn) {
      listeners.set('window:' + type, [...(listeners.get('window:' + type) || []), fn]);
    },
  };
  class Audio {
    constructor(src) {
      this.src = src;
      this.volume = 1;
      this.paused = true;
      this.currentTime = 0;
      this.readyState = 1;
      this.plays = 0;
      this.pauses = 0;
      clips.push(this);
    }
    play() {
      this.plays++;
      if (blocked) return Promise.reject(Error('autoplay'));
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.pauses++;
      this.paused = true;
    }
    load() {}
    addEventListener() {}
    removeAttribute(key) {
      delete this[key];
    }
  }
  const timers = new Map();
  const deadlines = new Map();
  let elapsed = 0;
  let timerId = 0;
  const context = {
    window,
    document,
    Audio,
    localStorage: {
      getItem(k) {
        if (storageBlocked) throw Error('storage blocked');
        return storage.get(k) ?? null;
      },
      setItem(k, v) {
        if (storageBlocked) throw Error('storage blocked');
        storage.set(k, String(v));
      },
    },
    Date,
    setTimeout(fn, ms) {
      const id = ++timerId;
      timers.set(id, fn);
      deadlines.set(id, elapsed + (ms || 0));
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
      deadlines.delete(id);
    },
    setInterval() {},
    MutationObserver: class {
      observe() {}
    },
    Option: class {
      constructor(text, value) {
        this.text = text;
        this.value = value;
      }
    },
    fetch: async (url, options = {}) => {
      requests.push(url);
      if (musicNetwork.fetch) return musicNetwork.fetch(url, options);
      return {
        ok: true,
        json: async () =>
          url.includes('room-music')
            ? {
                version: 1,
                serverNow: Date.now(),
                playing: true,
                position: 0,
                loop: false,
                track: { id: 'sample', title: '測試', duration: 60 },
              }
            : { tracks: [] },
      };
    },
  };
  vm.runInNewContext(source('audio-settings.js'), context);
  return {
    api: window.AudioSettings,
    storage,
    clips,
    nodes,
    requests,
    document,
    window,
    advance(ms) {
      const until = elapsed + ms;
      for (;;) {
        const next = [...deadlines].filter(([, at]) => at <= until).sort((a, b) => a[1] - b[1])[0];
        if (!next) break;
        elapsed = next[1];
        const fn = timers.get(next[0]);
        timers.delete(next[0]);
        deadlines.delete(next[0]);
        fn?.();
      }
      elapsed = until;
    },
    loadMusic(room = { code: 'ABC123', host: false }) {
      vm.runInNewContext(source('table-music.js'), context);
      window.TableMusic.update(room);
    },
    fire(key, event = {}) {
      for (const fn of listeners.get(key) || []) fn(event);
    },
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
test('draw and decline recordings tolerate slow startup and keep their full playback window', () => {
  for (const [cue, duration] of [
    ['ingredient-draw', 1580],
    ['quacks-stop', 1811],
  ]) {
    const ui = harness(),
      clip = ui.api.playEffect(cue);
    assert.ok(clip);
    ui.advance(1500);
    assert.ok(clip.src, cue + ' must not be discarded before delayed decoding starts');
    clip.onplaying();
    ui.advance(duration - 50);
    assert.ok(clip.src, cue + ' keeps its duration after actual start');
    ui.advance(100);
    assert.equal(clip.src, undefined);
  }
});
const musicSnapshot = (trackId = 'sample', version = 1) => ({
  version,
  serverNow: Date.now(),
  playing: true,
  position: 0,
  loop: false,
  mode: 'none',
  track: { id: trackId, title: '朋友上傳的歌', duration: 60 },
});
const musicReply = (value) => ({ ok: true, json: async () => value });

test('preferences keep independent music/effect levels across navigation; one migration for old levels', () => {
  const first = harness({
    'ah-music-listen': 'on',
    'ah-music-volume': '0.61',
    'ah-gift-volume': '0.42',
  });
  assert.equal(first.api.get().music.enabled, true);
  assert.equal(first.api.get().music.volume, 0.61);
  assert.equal(first.api.get().effects.volume, 0.42);
  first.api.set('effects', { enabled: true, volume: 0.18 });
  first.api.set('music', { volume: 0.77 });
  const next = harness(Object.fromEntries(first.storage));
  assert.equal(next.api.get().music.volume, 0.77);
  assert.equal(next.api.get().effects.volume, 0.18);
  assert.equal(next.api.get().effects.enabled, true);
  next.api.get().effects.volume = 1;
  assert.equal(next.api.get().effects.volume, 0.18);
});
test('invalid settings never create an invalid audio volume; unavailable storage still works', () => {
  for (const raw of ['broken', '{"music":{"volume":-4},"effects":{"volume":"1","enabled":"on"}}']) {
    const ui = harness({ 'ah-audio-settings': raw });
    assert.equal(ui.api.get().music.volume, 0.3);
    assert.equal(ui.api.get().effects.volume, 0.25);
    assert.equal(ui.api.get().effects.enabled, true);
  }
  const ui = harness();
  for (const volume of [NaN, Infinity, -1, 2, '0.3']) ui.api.set('effects', { volume });
  assert.equal(ui.api.get().effects.volume, 0.25);
  const denied = harness({}, false, true);
  denied.api.set('effects', { enabled: true, volume: 0.8 });
  assert.equal(denied.api.playEffect('confirm').volume, 0.8);
});
test('all effect clips use the common volume, update live, and stop immediately when muted or at zero', () => {
  const ui = harness();
  ui.api.set('effects', { enabled: false });
  assert.equal(ui.api.playEffect('confirm'), undefined);
  ui.api.set('effects', { enabled: true, volume: 0.2 });
  const a = ui.api.playEffect('confirm'),
    b = ui.api.playEffect('reveal');
  assert.equal(a.volume, 0.2);
  assert.equal(b.volume, 0.2);
  ui.api.set('effects', { volume: 0.8 });
  assert.equal(a.volume, 0.8);
  assert.equal(b.volume, 0.8);
  ui.api.set('effects', { enabled: false });
  assert.equal(a.paused, true);
  assert.equal(b.paused, true);
  assert.equal(a.currentTime, 0);
  ui.api.set('effects', { enabled: true });
  assert.equal(a.plays, 1);
  const c = ui.api.playEffect('confirm');
  ui.api.set('effects', { volume: 0 });
  assert.equal(c.paused, true);
  assert.equal(ui.api.playEffect('confirm'), undefined);
});
test('hidden pages never play new effects and navigation clears in-flight effects', () => {
  const ui = harness();
  ui.api.set('effects', { enabled: true });
  const clip = ui.api.playEffect('confirm');
  ui.document.hidden = true;
  ui.fire('document:visibilitychange');
  assert.equal(clip.paused, true);
  assert.equal(ui.api.playEffect('reveal'), undefined);
  ui.document.hidden = false;
  const next = ui.api.playEffect('confirm');
  ui.fire('window:pagehide');
  assert.equal(next.paused, true);
});
test('storage changes propagate across open games without inventing a playback gesture', () => {
  const ui = harness();
  const events = [];
  const unsubscribe = ui.api.subscribe((settings, meta) => events.push({ settings, meta }));
  ui.storage.set(
    'ah-audio-settings',
    JSON.stringify({
      music: { enabled: true, volume: 0.4 },
      effects: { enabled: true, volume: 0.6 },
    }),
  );
  ui.fire('window:storage', { key: 'ah-audio-settings' });
  assert.equal(events.at(-1).settings.effects.volume, 0.6);
  assert.equal(events.at(-1).meta.gesture, false);
  unsubscribe();
  const count = events.length;
  ui.api.set('music', { volume: 0.7 });
  assert.equal(events.length, count);
});
test('music library previews share preferences and release their listeners when removed', () => {
  const ui = harness(),
    handlers = new Map(),
    audio = {
      volume: 1,
      muted: false,
      addEventListener(type, fn) {
        handlers.set(type, fn);
      },
      removeEventListener(type) {
        handlers.delete(type);
      },
    };
  const unbind = ui.api.bindPreview(audio);
  assert.equal(audio.volume, 0.3);
  assert.equal(audio.muted, true);
  handlers.get('play')();
  assert.equal(audio.muted, false);
  ui.api.set('music', { volume: 0.7 });
  assert.equal(audio.volume, 0.7);
  audio.volume = 0.4;
  handlers.get('volumechange')();
  assert.equal(ui.api.get().music.volume, 0.4);
  audio.muted = true;
  handlers.get('volumechange')();
  assert.equal(ui.api.get().music.enabled, false);
  unbind();
  ui.api.set('music', { volume: 0.8 });
  assert.equal(audio.volume, 0.4);
  assert.equal(handlers.size, 0);
});

test('effects default on, migrate legacy off once, and retain a subsequent explicit mute across navigation', () => {
  const first = harness();
  assert.equal(first.api.get().effects.enabled, true);
  assert.equal(first.api.get().music.enabled, false);
  const migrated = harness({
    'ah-audio-settings': JSON.stringify({
      version: 1,
      music: { enabled: false, volume: 0.61 },
      effects: { enabled: false, volume: 0.18 },
    }),
  });
  assert.equal(migrated.api.get().effects.enabled, true);
  assert.equal(migrated.api.get().effects.volume, 0.18);
  migrated.api.set('effects', { enabled: false });
  const next = harness(Object.fromEntries(migrated.storage));
  assert.equal(next.api.get().effects.enabled, false);
  assert.equal(next.api.get().effects.volume, 0.18);
  assert.equal(next.api.get().music.volume, 0.61);
});

test('majority settlement uses the uploaded settlement clip without changing generic reveal cues', () => {
  const ui = harness();
  const clip = ui.api.playEffect('majority-settlement');
  assert.equal(clip.src, '/assets/game-sounds/quacks-settlement-user.wav');
});

test('Quacks draw and stop use the newly supplied voice clips and keep mute preferences', () => {
  const ui = harness();
  assert.equal(
    ui.api.playEffect('ingredient-draw').src,
    '/assets/game-sounds/quacks-push-user.wav',
  );
  assert.equal(ui.api.playEffect('quacks-stop').src, '/assets/game-sounds/quacks-decline-user.wav');
  ui.api.set('effects', { enabled: false });
  assert.ok(!ui.api.playEffect('ingredient-draw'));
});

test('all five ping cues use playable WAV paths, shared volume and mute', async () => {
  const ui = harness();
  for (const type of ['ping', 'attention', 'question', 'help', 'look']) {
    const clip = ui.api.playEffect('ping-' + type);
    await tick();
    assert.equal(clip.src, '/assets/game-sounds/ping-' + type + '.wav');
    assert.equal(clip.volume, 0.25);
    assert.equal(clip.paused, false);
    assert.equal(clip.plays, 1);
    clip.onended();
  }
  assert.equal(ui.clips.length, 5);
  ui.api.set('effects', { enabled: false });
  assert.equal(ui.api.playEffect('ping-attention'), undefined);
  assert.equal(ui.clips.length, 5);
});

test('selectable voice pings play their MP3 files', async () => {
  const names = [
    'amazing',
    'bad',
    'card-check',
    'sleep',
    'look',
    'legacy',
    'no-bluff',
    'cry',
    'coward',
    'goodnight',
    'senior',
    'practice',
    'huh',
    'what',
  ];
  for (const name of names) {
    const ui = harness();
    const clip = ui.api.playEffect('ping-voice-' + name);
    await tick();
    assert.equal(clip.src, '/assets/game-sounds/ping-voice-' + name + '.mp3');
    assert.equal(clip.volume, 0.25);
    clip.onended();
  }
});
test('every published voice ping matches its user-provided source manifest', () => {
  const directory = path.join(__dirname, '../public/assets/game-sounds');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'ping-voice-manifest.json')));
  assert.equal(manifest.cues.length, 14);
  for (const cue of manifest.cues) {
    const bytes = fs.readFileSync(path.join(directory, cue.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), cue.sha256, cue.id);
    assert.ok(bytes.length > 1000, cue.id);
  }
});

test('result samples pause registered song playback, preserve position and resume only after the final interruption', async () => {
  const ui = harness({
      'ah-audio-settings': JSON.stringify({
        version: 2,
        music: { enabled: true, volume: 0.4 },
        effects: { enabled: true, volume: 0.5 },
      }),
    }),
    song = { paused: false, time: 12.75, plays: 0 };
  const unbind = ui.api.registerMusic({
    isPlaying: () => !song.paused,
    pause: () => {
      song.paused = true;
    },
    resume: () => {
      song.paused = false;
      song.plays++;
    },
  });
  const batch = ui.api.suspendMusic();
  const clip = ui.api.playEffect('correct');
  assert.equal(song.paused, true);
  assert.ok(clip.src.endsWith('/correct-user.mp3'));
  clip.onended();
  assert.equal(song.paused, true);
  const failure = ui.api.playEffect('incorrect');
  assert.ok(failure.src.endsWith('/incorrect-user.mp3'));
  failure.onended();
  assert.equal(song.paused, true);
  batch();
  assert.equal(song.paused, false);
  assert.equal(song.plays, 1);
  assert.equal(song.time, 12.75);
  unbind();
});
test('removed previews and disabled personal music are never restarted by a result cue', () => {
  const ui = harness({
    'ah-audio-settings': JSON.stringify({
      version: 2,
      music: { enabled: true, volume: 0.4 },
      effects: { enabled: true, volume: 0.5 },
    }),
  });
  let resumed = 0;
  const off = ui.api.registerMusic({
    isPlaying: () => true,
    pause() {},
    resume() {
      resumed++;
    },
  });
  const clip = ui.api.playEffect('incorrect');
  off();
  clip.onended();
  assert.equal(resumed, 0);
  ui.api.registerMusic({
    isPlaying: () => true,
    pause() {},
    resume() {
      resumed++;
    },
  });
  const next = ui.api.playEffect('correct');
  ui.api.set('music', { enabled: false });
  next.onended();
  assert.equal(resumed, 0);
});

test('a disabled result cue never interrupts music', () => {
  const ui = harness({
    'ah-audio-settings': JSON.stringify({
      version: 2,
      music: { enabled: true, volume: 0.4 },
      effects: { enabled: false, volume: 0.5 },
    }),
  });
  let pauses = 0,
    resumes = 0;
  ui.api.registerMusic({
    isPlaying: () => true,
    pause() {
      pauses++;
    },
    resume() {
      resumes++;
    },
  });
  assert.equal(ui.api.playEffect('incorrect'), undefined);
  assert.equal(pauses, 0);
  assert.equal(resumes, 0);
});
