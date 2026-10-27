'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const ts = require('typescript'),
  vue = require('vue'),
  pinia = require('pinia');

async function fixture() {
  const redirects = [],
    calls = [],
    cache = new Map(),
    storage = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const mod = { exports: {} };
    vm.runInNewContext(
      ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        module: mod,
        exports: mod.exports,
        URLSearchParams,
        AbortController,
        DOMException,
        setTimeout,
        clearTimeout,
        location: { replace: (url) => redirects.push(url) },
        localStorage: {
          getItem: (key) => storage.get(key),
          setItem: (key, value) => storage.set(key, value),
          removeItem: (key) => storage.delete(key),
        },
        require(id) {
          if (id === 'vue') return vue;
          if (id === 'pinia') return pinia;
          if (id.endsWith('/http'))
            return {
              ApiError: class extends Error {},
              requestJson: async (url, options) => {
                calls.push({ url, options });
                return { code: 'ABCDEF', type: 'majority', reconnected: true };
              },
            };
          if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'));
          return require(id);
        },
      },
    );
    cache.set(file, mod.exports);
    return mod.exports;
  }
  const { useRoomStore } = load(path.resolve(__dirname, '../src/stores/room.ts'));
  const { readRoomSnapshot } = load(path.resolve(__dirname, '../src/contracts/room.ts'));
  const owner = pinia.createPinia();
  const scope = vue.effectScope();
  const store = scope.run(() => useRoomStore(owner));
  let reads = 0;
  await store.open('ABCDEF', 'majority', (value) => {
    reads++;
    assert.equal(value.type, 'majority');
    return readRoomSnapshot(value);
  });
  const snapshot = (extra = {}) => ({
    code: 'ABCDEF',
    type: 'majority',
    phase: 'waiting',
    me: 'p1',
    host: true,
    serverNow: 1000,
    version: 1,
    gameRevision: 0,
    players: [{ id: 'p1', name: 'host' }],
    media: { roomInstanceId: 'same-instance' },
    ...extra,
  });
  store.accept(snapshot());
  return {
    store,
    redirects,
    calls,
    storage,
    snapshot,
    reads: () => reads,
    close: () => {
      scope.stop();
      pinia.disposePinia(owner);
    },
  };
}
test('a pushed game change navigates with the same seat before the old domain reader runs', async () => {
  const f = await fixture();
  try {
    assert.equal(f.store.accept(f.snapshot({ type: 'draw', gameRevision: 1 })), true);
    assert.deepEqual(f.redirects, ['/draw/ABCDEF']);
    assert.equal(f.reads(), 1);
    assert.equal(JSON.parse(f.storage.get('ah-draw:ABCDEF')).type, 'draw');
    assert.equal(f.store.accept(f.snapshot()), false, 'late old responses cannot undo navigation');
  } finally {
    f.close();
  }
});
test('a switch away and back still reloads game-local drafts and rejects an older generation', async () => {
  const f = await fixture();
  try {
    assert.equal(f.store.accept(f.snapshot({ type: 'gift', gameRevision: 0 })), false);
    assert.equal(f.store.accept(f.snapshot({ gameRevision: 2 })), true);
    assert.deepEqual(f.redirects, ['/majority/ABCDEF']);
    assert.equal(f.reads(), 1);
  } finally {
    f.close();
  }
});
test('a different seat or room instance cannot masquerade as a game change', async () => {
  for (const extra of [{ me: 'someone-else' }, { media: { roomInstanceId: 'replacement' } }]) {
    const f = await fixture();
    try {
      assert.equal(f.store.accept(f.snapshot({ type: 'draw', gameRevision: 1, ...extra })), false);
      assert.equal(f.store.terminal, 'replaced');
      assert.equal(f.redirects.length, 0);
    } finally {
      f.close();
    }
  }
});
test('game commands carry their source game and generation', async () => {
  const f = await fixture();
  try {
    await f.store.request('settings', { rounds: 3 });
    const body = f.calls.at(-1).options.body;
    assert.equal(body.code, 'ABCDEF');
    assert.equal(body.gameType, 'majority');
    assert.equal(body.gameRevision, 0);
  } finally {
    f.close();
  }
});
test('scene requests from the real store satisfy server movement and action validation', async () => {
  const f = await fixture();
  let time = 10000;
  const space = require('../../src/rooms/space').createRoomSpace(
    () => time,
    () => 0.5,
  );
  const room = { code: 'ABCDEF', players: [{ id: 'p1', name: 'host' }] };
  try {
    for (const input of [
      { x: 50, y: 60 },
      { action: 'step', dx: 1, dy: -1 },
      { action: 'teleport' },
      { action: 'attack', slot: 'q', requestId: 'mobile-scene-regression', aspectRatio: 1 },
    ]) {
      time += 3000;
      await f.store.request('room-space', input);
      const body = f.calls.at(-1).options.body;
      assert.equal(body.code, room.code);
      assert.doesNotThrow(() => space.move(room, 'p1', body, 'shield', 'classic'));
    }
    const view = space.view(room, 'p1');
    assert.equal(view.visitors[0].teleportId, 1);
    assert.equal(view.attacks[0].slot, 'q');
    assert.equal(view.attacks[0].toId, 'p1');
  } finally {
    f.close();
  }
});
test('tutorial transport never persists a teaching seat or falls through to formal APIs after detach', async () => {
  const f = await fixture();
  try {
    const calls = f.calls.length,
      saved = new Map(f.storage),
      requests = [];
    f.store.busy = true;
    const detach = f.store.installTutorial(
      'poker',
      (v) => v,
      async (route, data) => {
        requests.push({ route, data });
        return { teaching: true };
      },
    );
    assert.equal(f.store.busy, false);
    assert.equal(f.store.code, 'FEED00');
    assert.deepEqual(new Map(f.storage), saved);
    assert.deepEqual(await f.store.request('action', { action: 'call' }), { teaching: true });
    assert.equal(requests.length, 1);
    assert.equal(f.calls.length, calls);
    detach();
    await assert.rejects(
      f.store.request('action', { action: 'call' }),
      (e) => e.name === 'AbortError',
    );
    assert.equal(f.calls.length, calls);
    assert.deepEqual(new Map(f.storage), saved);
    const next = f.store.installTutorial(
      'minimal',
      (v) => v,
      async () => ({ second: true }),
    );
    detach();
    assert.deepEqual(await f.store.request('state'), { second: true });
    next();
    assert.equal(f.calls.length, calls);
  } finally {
    f.close();
  }
});
