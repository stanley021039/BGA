'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  ts = require('typescript');
const vue = require('vue');
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await vue.nextTick();
  await Promise.resolve();
};
function fixture({ storage = new Map(), blockedStorage = false } = {}) {
  const documentEvents = new Map(),
    windowEvents = new Map(),
    timers = new Map(),
    clips = [],
    requests = [];
  let timerId = 0,
    listener,
    playingAllowed = true;
  const listen = (map) => ({
    addEventListener(k, fn) {
      if (!map.has(k)) map.set(k, new Set());
      map.get(k).add(fn);
    },
    removeEventListener(k, fn) {
      map.get(k)?.delete(fn);
    },
  });
  const document = { hidden: false, documentElement: { dataset: {} }, ...listen(documentEvents) },
    window = listen(windowEvents);
  const settings = { effects: { enabled: true, volume: 0.25 } };
  const audio = {
    get: () => settings,
    subscribe(fn) {
      listener = fn;
      fn(settings);
      return () => (listener = undefined);
    },
    stopEffect(clip) {
      if (clip) clip.stopped = true;
      return !!clip;
    },
    playEffect(cue, options) {
      const clip = { cue, options, volume: settings.effects.volume, stopped: false };
      clips.push(clip);
      if (!playingAllowed) queueMicrotask(options.onError);
      return clip;
    },
  };
  class ApiError extends Error {
    constructor(status) {
      super('API');
      this.status = status;
    }
  }
  const session = vue.reactive({ user: { id: 'user-a' }, refresh() {} }),
    cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const mod = { exports: {} };
    cache.set(file, mod.exports);
    vm.runInNewContext(
      ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        module: mod,
        exports: mod.exports,
        document,
        window,
        DOMException,
        AbortController,
        AbortSignal,
        queueMicrotask,
        sessionStorage: {
          getItem(k) {
            if (blockedStorage) throw Error('blocked');
            return storage.get(k) || null;
          },
          setItem(k, v) {
            if (blockedStorage) throw Error('blocked');
            storage.set(k, v);
          },
        },
        setTimeout(fn, ms) {
          const id = ++timerId;
          timers.set(id, { fn, ms });
          return id;
        },
        clearTimeout(id) {
          timers.delete(id);
        },
        require(name) {
          if (name === 'vue') return vue;
          if (name === 'pinia') return { defineStore: (_name, setup) => setup };
          if (name.endsWith('/session')) return { useSessionStore: () => session };
          if (name.endsWith('audio-settings.js')) return { default: audio };
          if (name.endsWith('/http'))
            return {
              ApiError,
              requestJson(url, options) {
                return new Promise((resolve, reject) =>
                  requests.push({ url, options, resolve, reject }),
                );
              },
            };
          return name.startsWith('.')
            ? load(path.resolve(path.dirname(file), name + '.ts'))
            : require(name);
        },
      },
    );
    return mod.exports;
  }
  const notifications = load(path.resolve(__dirname, '../src/services/invitation-sound.ts'));
  const emit = (map, key) => [...(map.get(key) || [])].forEach((fn) => fn());
  return {
    create: notifications.createInvitationSound,
    clips,
    settings,
    storage,
    requests,
    session,
    timers,
    block(value) {
      playingAllowed = !value;
    },
    mute(value) {
      settings.effects.enabled = !value;
      listener?.(settings);
    },
    volume(value) {
      settings.effects.volume = value;
      listener?.(settings);
    },
    visible(hidden) {
      document.hidden = hidden;
      emit(documentEvents, 'visibilitychange');
    },
    leave() {
      emit(windowEvents, 'pagehide');
    },
    listeners: () =>
      [...documentEvents.values(), ...windowEvents.values()].reduce((n, set) => n + set.size, 0),
    store() {
      const scope = vue.effectScope();
      const store = scope.run(() =>
        load(path.resolve(__dirname, '../src/stores/invitations.ts')).useInvitationsStore(),
      );
      return { store, close: () => scope.stop() };
    },
  };
}
const invite = (id = 'invite-1') => ({
  id,
  code: 'ABCDEF',
  type: 'poker',
  roomName: 'test',
  fromName: 'friend',
  expiresAt: Date.now() + 300000,
  canJoin: true,
});

test('new invitation batches sound once across polls, removals, reload and account scopes with bounded ID history', () => {
  const f = fixture(),
    blocked = [],
    a = f.create('user-a', (value) => blocked.push(value));
  a.observe([]);
  assert.equal(f.clips.length, 0);
  a.observe([invite('a'), invite('b')]);
  assert.equal(f.clips.length, 1);
  a.observe([invite('b'), invite('a')]);
  a.observe([]);
  a.observe([invite('a')]);
  assert.equal(f.clips.length, 1);
  a.destroy();
  assert.equal(f.listeners(), 0);
  const reload = f.create('user-a', () => {});
  reload.observe([invite('a')]);
  assert.equal(f.clips.length, 1);
  for (let i = 0; i < 300; i++) reload.observe([invite('a'), invite('extra-' + i)]);
  const saved = JSON.parse(f.storage.get('bga-invitation-sounds-v1:user-a'));
  assert.equal(saved.length, 256);
  assert.ok(saved.includes('a'));
  const count = f.clips.length;
  reload.observe([invite('a')]);
  assert.equal(f.clips.length, count);
  reload.destroy();
  const other = f.create('user-b', () => {});
  other.observe([invite('a')]);
  assert.equal(f.clips.length, count + 1);
  other.destroy();
});

test('muted, zero-volume and hidden invitations are remembered without deferred sounds; hidden and pagehide stop active audio', () => {
  const f = fixture(),
    a = f.create('a', () => {});
  f.mute(true);
  a.observe([invite('mute')]);
  assert.equal(f.clips.length, 0);
  f.mute(false);
  a.observe([invite('mute')]);
  assert.equal(f.clips.length, 0);
  f.volume(0);
  a.observe([invite('zero')]);
  f.volume(0.6);
  a.observe([invite('zero')]);
  assert.equal(f.clips.length, 0);
  f.visible(true);
  a.observe([invite('hidden')]);
  f.visible(false);
  a.observe([invite('hidden')]);
  assert.equal(f.clips.length, 0);
  a.observe([invite('live')]);
  assert.equal(f.clips.length, 1);
  assert.equal(f.clips[0].volume, 0.6);
  f.visible(true);
  assert.ok(f.clips[0].stopped);
  f.visible(false);
  a.observe([invite('live')]);
  assert.equal(f.clips.length, 1);
  a.observe([invite('other')]);
  f.leave();
  assert.ok(f.clips[1].stopped);
  a.destroy();
  assert.equal(f.listeners(), 0);
});

test('autoplay failure exposes a manual sample, never loops or replays on polling, and stale failures cannot change disposed or muted state', async () => {
  const f = fixture(),
    changes = [],
    a = f.create('a', (value) => changes.push(value));
  f.block(true);
  a.observe([invite()]);
  await flush();
  assert.equal(changes.at(-1), true);
  a.observe([invite()]);
  assert.equal(f.clips.length, 1);
  f.block(false);
  a.enable();
  assert.equal(changes.at(-1), false);
  assert.equal(f.clips.length, 2);
  const fail = f.clips[1].options.onError;
  f.mute(true);
  fail();
  assert.equal(changes.at(-1), false);
  f.mute(false);
  a.enable();
  const late = f.clips.at(-1).options.onError;
  a.destroy();
  late();
  assert.equal(changes.at(-1), false);
  assert.ok(f.clips.at(-1).stopped);
});

test('restricted or invalid session storage keeps normal in-document playback and cleanup', () => {
  for (const options of [
    { blockedStorage: true },
    { storage: new Map([['bga-invitation-sounds-v1:a', '{']]) },
  ]) {
    const f = fixture(options),
      a = f.create('a', () => {});
    a.observe([invite()]);
    a.observe([invite()]);
    assert.equal(f.clips.length, 1);
    a.destroy();
    assert.equal(f.listeners(), 0);
  }
});

test('actual invitation store forwards accepted snapshots once, keeps decline usable, and ignores account-stale responses and playback failures', async () => {
  const f = fixture(),
    { store, close } = f.store();
  try {
    assert.equal(f.requests.length, 1);
    f.requests[0].resolve({ invitations: [] });
    await flush();
    const first = store.poll();
    f.requests.at(-1).resolve({ invitations: [invite()] });
    await first;
    assert.equal(f.clips.length, 1);
    assert.equal(store.items.value.length, 1);
    const repeated = store.poll();
    f.requests.at(-1).resolve({ invitations: [invite()] });
    await repeated;
    assert.equal(f.clips.length, 1);
    const decline = store.respond(invite(), 'decline');
    assert.equal(f.requests.at(-1).options.body.action, 'decline');
    f.requests.at(-1).resolve({ ok: true });
    await flush();
    f.requests.at(-1).resolve({ invitations: [] });
    await decline;
    assert.equal(store.items.value.length, 0);
    assert.equal(f.clips.length, 1);
    const old = store.poll(),
      oldRequest = f.requests.at(-1);
    f.session.user = { id: 'user-b' };
    await flush();
    assert.equal(oldRequest.options.signal.aborted, true);
    oldRequest.resolve({ invitations: [invite('stale')] });
    await old;
    assert.equal(f.clips.length, 1);
    f.block(true);
    f.requests.at(-1).resolve({ invitations: [invite('b')] });
    await flush();
    assert.equal(store.soundBlocked.value, true);
    f.session.user = null;
    await flush();
    assert.equal(store.soundBlocked.value, false);
    assert.ok(f.clips.at(-1).stopped);
  } finally {
    close();
  }
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners(), 0);
});
