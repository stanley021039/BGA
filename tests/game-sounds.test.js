const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('./helpers/browser-modules.cjs'),
  path = require('node:path'),
  vm = require('node:vm');
function fixture({ pending = false, blocked = false } = {}) {
  let time = 100000,
    id = 0;
  const timers = new Map(),
    clips = [],
    handlers = new Map(),
    store = new Map();
  const target = (name) => ({
    addEventListener(type, fn) {
      const key = name + type;
      if (!handlers.has(key)) handlers.set(key, new Set());
      handlers.get(key).add(fn);
    },
    removeEventListener(type, fn) {
      handlers.get(name + type)?.delete(fn);
    },
  });
  const document = { ...target('document:'), hidden: false, body: { dataset: {} } },
    window = { ...target('window:'), document };
  class Audio {
    constructor(src) {
      this.src = this.originalSrc = src;
      this.paused = true;
      this.currentTime = 0;
      clips.push(this);
    }
    play() {
      if (blocked) return Promise.reject(Error('blocked'));
      if (pending)
        return new Promise((resolve) => {
          this.finishLoad = () => {
            this.paused = false;
            resolve();
          };
        });
      this.paused = false;
      this.onplaying?.();
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    removeAttribute(name) {
      delete this[name];
    }
    load() {}
  }
  const context = {
    window,
    document,
    Audio,
    URL,
    location: { origin: 'https://example.test' },
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    },
    Date: { now: () => time },
    setTimeout(fn, ms) {
      const key = ++id;
      timers.set(key, { fn, at: time + ms });
      return key;
    },
    clearTimeout: (key) => timers.delete(key),
  };
  for (const file of ['audio-settings.js', 'game-sounds.js'])
    vm.runInNewContext(
      fs.readFileSync(path.join(__dirname, '../public/shared', file), 'utf8'),
      context,
    );
  window.AudioSettings.set('effects', { enabled: false }); // Controlled muted baseline; global default-on is tested separately.
  const fire = (name) => {
    for (const fn of [...(handlers.get(name) || [])]) fn();
  };
  const state = (code = 'ABC123', version = 1) => ({ code, version });
  return {
    window,
    document,
    clips,
    timers,
    handlers,
    state,
    api: window.AudioSettings,
    controller: window.GameSounds.create(),
    fire,
    tick(ms) {
      time += ms;
      for (const [key, timer] of [...timers])
        if (timer.at <= time && timers.delete(key)) timer.fn();
    },
    hide(hidden) {
      document.hidden = hidden;
      fire('document:visibilitychange');
    },
  };
}
test('game cues have fixed source/length and ignore unknown URLs or prototype keys', () => {
  const f = fixture();
  f.api.set('effects', { enabled: true, volume: 0.4 });
  for (const [cue, ms] of Object.entries({
    turn: 720,
    correct: 3500,
    incorrect: 1700,
    'dice-roll': 650,
    shot: 1450,
    slam: 680,
    nitro: 1400,
    skid: 740,
  })) {
    const clip = f.api.playEffect(cue);
    assert.equal(
      clip.originalSrc,
      '/assets/game-sounds/' +
        (['correct', 'incorrect'].includes(cue) ? cue + '-user.mp3' : cue + '.wav'),
    );
    assert.equal(clip.volume, 0.4);
    f.tick(ms - 1);
    assert.equal(clip.paused, false);
    f.tick(1);
    assert.equal(clip.paused, true);
  }
  for (const cue of ['toString', '__proto__', 'https://evil.test/a.wav', 'missing'])
    assert.equal(f.api.playEffect(cue), undefined);
  assert.equal(f.clips.length, 8);
});
test('first snapshot, presence, late version and duplicate ACK/event only sound once', () => {
  const f = fixture(),
    c = f.controller;
  f.api.set('effects', { enabled: true });
  assert.equal(c.update(f.state()), false);
  c.play('turn', 'old');
  assert.equal(f.clips.length, 0);
  assert.equal(c.update(f.state('ABC123', 2)), true);
  c.play('correct', 'new');
  c.play('correct', 'new');
  c.update(f.state('ABC123', 2));
  c.play('correct', 'new');
  assert.equal(f.clips.length, 1);
  assert.equal(c.update(f.state('ABC123', 1)), false);
  c.play('turn', 'stale', { live: false });
  assert.equal(f.clips.length, 1);
});
test('muted/zero volume events are consumed without loading and never catch up after opt-in', () => {
  const f = fixture(),
    c = f.controller;
  c.update(f.state());
  c.update(f.state());
  c.play('turn', 'mute');
  f.api.set('effects', { enabled: true });
  c.play('turn', 'mute');
  assert.equal(f.clips.length, 0);
  c.play('turn', 'new');
  f.api.set('effects', { volume: 0 });
  assert.equal(f.clips[0].paused, true);
  c.play('correct', 'zero');
  f.api.set('effects', { volume: 0.4 });
  c.play('correct', 'zero');
  assert.equal(f.clips.length, 1);
});
test('room, visibility, disconnect and long gaps invalidate queued presentation tokens', () => {
  const f = fixture(),
    c = f.controller;
  f.api.set('effects', { enabled: true });
  c.update(f.state());
  c.update(f.state());
  const token = c.epoch();
  c.play('turn', 'first');
  f.hide(true);
  assert.equal(f.clips[0].paused, true);
  f.hide(false);
  assert.equal(c.update(f.state()), false);
  c.play('shot', 'hidden-queue', { live: true, epoch: token });
  assert.equal(f.clips.length, 1);
  c.update(f.state());
  const reconnectToken = c.epoch();
  c.disconnect();
  c.update(f.state());
  c.update(f.state());
  c.play('shot', 'disconnect-queue', { live: true, epoch: reconnectToken });
  assert.equal(f.clips.length, 1);
  const gapToken = c.epoch();
  f.tick(5001);
  assert.equal(c.update(f.state()), false);
  c.update(f.state());
  c.play('shot', 'gap-queue', { live: true, epoch: gapToken });
  assert.equal(f.clips.length, 1);
  assert.equal(c.update(f.state('DEF456')), false);
  c.play('turn', 'room-baseline');
  c.update(f.state('DEF456'));
  c.play('turn', 'room-new');
  assert.equal(f.clips.length, 2);
});
test('sound gates are independent of reduced-motion or disabled game animations', () => {
  const f = fixture(),
    c = f.controller;
  f.window.MotionPolicy = { allowsMotion: () => false };
  f.api.set('effects', { enabled: true });
  c.update(f.state());
  c.update(f.state());
  c.play('turn', 'reduced');
  assert.equal(f.clips.length, 1);
});
test('quiet action cues have a 250ms spacing, dropped keys never replay, feedback is not delayed', () => {
  const f = fixture(),
    c = f.controller;
  f.api.set('effects', { enabled: true });
  c.update(f.state());
  c.update(f.state());
  c.play('shot', 'shot');
  c.play('slam', 'dropped');
  assert.equal(f.clips.length, 1);
  c.play('correct', 'feedback');
  assert.equal(f.clips.length, 2);
  f.tick(300);
  c.play('slam', 'dropped');
  assert.equal(f.clips.length, 2);
  f.tick(1200);
  c.play('slam', 'next');
  assert.equal(f.clips.length, 3);
});
test('all games share a two-game/four-total cap, with no interruption to custom expression clips', () => {
  const f = fixture();
  f.api.set('effects', { enabled: true });
  const sound = {
    url: '/assets/characters/sounds/12345678-1234-4234-8234-123456789abc/happy',
    durationMs: 10000,
  };
  const expression = f.api.playExpression(sound),
    a = f.api.playEffect('turn'),
    b = f.api.playEffect('correct');
  assert.equal(f.api.playEffect('dice-roll'), undefined);
  assert.equal(expression.paused, false);
  assert.ok(f.api.playExpression(sound));
  assert.equal(f.api.playEffect('slam'), undefined);
  a.onended();
  assert.ok(f.api.playEffect('dice-roll'));
  assert.equal(expression.paused, false);
  f.api.stopEffects();
  assert.equal(f.timers.size, 0);
  assert.equal(b.paused, true);
});
test('pending new cue loads expire in one second and late successful play cannot restart', async () => {
  const f = fixture({ pending: true });
  f.api.set('effects', { enabled: true });
  const clip = f.api.playEffect('turn');
  f.tick(1000);
  assert.equal(clip.src, undefined);
  assert.equal(f.timers.size, 0);
  clip.finishLoad();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(clip.paused, true);
  assert.equal(f.timers.size, 0);
});
test('cue reset/destroy stops only its clips, preserves expressions, bounds keys and releases listeners', () => {
  const f = fixture(),
    c = f.controller;
  f.api.set('effects', { enabled: true });
  c.update(f.state());
  c.update(f.state());
  const expression = f.api.playExpression({
    url: '/assets/characters/sounds/12345678-1234-4234-8234-123456789abc/happy',
    durationMs: 10000,
  });
  c.play('turn', 'owned');
  const clip = f.clips.at(-1);
  for (let i = 0; i < 300; i++) c.play('shot', 'key:' + i, { live: false });
  assert.equal(c.size(), 256);
  const before = f.handlers.get('document:visibilitychange').size;
  c.destroy();
  assert.equal(clip.paused, true);
  assert.equal(expression.paused, false);
  assert.equal(f.handlers.get('document:visibilitychange').size, before - 1);
  c.update(f.state());
  c.play('turn', 'destroyed');
  assert.equal(f.clips.length, 2);
});
test('failed new cue playback frees both caps and reports once without unhandled rejection', async () => {
  const f = fixture({ blocked: true });
  f.api.set('effects', { enabled: true });
  let errors = 0;
  const clip = f.api.playEffect('turn', { onError: () => errors++ });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(clip.paused, true);
  assert.equal(errors, 1);
  assert.equal(f.timers.size, 0);
  assert.ok(f.api.playEffect('turn'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.timers.size, 0);
});

test('explosion cue respects live gates, mute, duplicate keys and original fixed source', () => {
  const f = fixture(),
    c = f.controller;
  c.update(f.state());
  c.play('explosion', 'old');
  assert.equal(f.clips.length, 0);
  c.update(f.state());
  c.play('explosion', 'muted');
  assert.equal(f.clips.length, 0);
  f.api.set('effects', { enabled: true });
  c.play('explosion', 'muted');
  assert.equal(f.clips.length, 0);
  c.play('explosion', 'new');
  c.play('explosion', 'new');
  assert.equal(f.clips.length, 1);
  assert.equal(f.clips[0].originalSrc, '/assets/game-sounds/quacks-explosion.wav');
  f.tick(1600);
  assert.equal(f.clips[0].paused, true);
});

test('Quacks explosion reaction is a fixed live cue with a resampled blast before fish, while other explosions retain their source', () => {
  const f = fixture();
  f.api.set('effects', { enabled: true });
  const c = f.controller;
  c.update(f.state());
  c.update(f.state());
  c.play('quacks-explosion', 'fish');
  assert.equal(f.clips.at(-1).src, '/assets/game-sounds/quacks-explosion-fish.wav');
  const fs = require('./helpers/browser-modules.cjs'),
    crypto = require('node:crypto'),
    m = JSON.parse(
      fs.readFileSync('public/assets/game-sounds/quacks-manifest.json'),
    ).explosionReaction,
    b = fs.readFileSync('public/assets/game-sounds/' + m.file);
  assert.equal(b.readUInt32LE(24), 24000);
  assert.equal(m.prefixMs, 840);
  assert.equal(m.gapMs, 20);
  assert.equal(m.durationMs, 1428);
  assert.equal(m.sha256, crypto.createHash('sha256').update(b).digest('hex'));
  assert.equal(b.readInt16LE(b.length - 2), 0);
  assert.ok(b.readUInt32LE(40) / 48 > 1427);
  c.destroy();
});
