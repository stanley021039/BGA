const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const ts = require('typescript'),
  vue = require('vue'),
  pinia = require('pinia');
const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
const { createLobby } = require('../../src/rooms/lobby');
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function fixture(t) {
  const session = vue.reactive({ user: null }),
    pending = [],
    streams = [],
    timers = new Map();
  const document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  let timerId = 0,
    now = 0;
  class Source {
    static CLOSED = 2;
    callbacks = {};
    readyState = 1;
    constructor() {
      streams.push(this);
    }
    addEventListener(name, fn) {
      this.callbacks[name] = fn;
    }
    emit(name, value) {
      this.callbacks[name]?.({ data: JSON.stringify(value) });
    }
    close() {
      this.readyState = Source.CLOSED;
    }
  }
  const mocks = {
    vue,
    pinia,
    './session': { useSessionStore: () => session },
    './lobby-background': { useLobbyBackgroundStore: () => ({ receive() {} }) },
    '../services/action-sounds': { playActionFeedback() {}, rememberRoomEntryFeedback() {} },
    '../services/preload': { preloadAllowed: () => false, warm() {}, whenIdle() {} },
    '../services/entrance-effects': {
      entranceEffect: { value: 'classic' },
      isEntranceEffect: (id) => id === 'classic',
    },
    '../services/scene-scope': { sceneApiPath: (value) => value },
    '../services/http': {
      ApiError: class extends Error {},
      requestJson(url, options) {
        return new Promise((resolve, reject) => {
          const request = { url, ...options, resolve, reject };
          pending.push(request);
          options.signal.addEventListener('abort', () => reject(options.signal.reason), {
            once: true,
          });
        });
      },
    },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(
      code,
      withEngineImports({
        module,
        exports: module.exports,
        require: (id) =>
          Object.hasOwn(mocks, id)
            ? mocks[id]
            : id.endsWith('.json')
              ? { default: require(path.resolve(path.dirname(file), id)) }
              : load(path.resolve(path.dirname(file), /\.(ts|js)$/.test(id) ? id : id + '.ts')),
        document,
        window: { addEventListener() {}, removeEventListener() {} },
        location: { replace() {} },
        EventSource: Source,
        AbortController,
        DOMException,
        Error,
        performance: { now: () => now },
        Date,
        console,
        crypto: require('node:crypto').webcrypto,
        setTimeout: (fn, delay) => {
          const id = ++timerId;
          timers.set(id, { fn, delay });
          return id;
        },
        clearTimeout: (id) => timers.delete(id),
      }),
      { filename: file },
    );
    return module.exports;
  }
  const instance = pinia.createPinia();
  pinia.setActivePinia(instance);
  const store = load(path.resolve(__dirname, '../src/stores/lobby.ts')).useLobbyStore();
  const lobby = createLobby(() => 1000),
    raw = { ...lobby.view({ id: 'self', display_name: 'Self' }), serverNow: 1000 };
  t.after(() => instance._e.stop());
  const frame = (serverNow, name = 'Self') => ({
    ...raw,
    serverNow,
    visitors: raw.visitors.map((v) => ({ ...v, name })),
  });
  async function start() {
    load(path.resolve(__dirname, '../src/contracts/lobby.ts')).readLobbySnapshot(frame(1000));
    session.user = { id: 'self' };
    pending.find((r) => r.url.startsWith('/api/lobby?')).resolve(frame(1000));
    pending.find((r) => r.url === '/api/rooms').resolve({ rooms: [] });
    await flush();
    assert.equal(store.connected, true, store.presenceStatus);
    assert.ok(streams[0], store.presenceStatus);
    streams[0].emit('open');
  }
  return {
    store,
    pending,
    streams,
    frame,
    start,
    document,
    timers,
    session,
    advance: (ms) => (now += ms),
  };
}
test('live player and boss snapshots continue during a delayed move; old HTTP cannot rewind them', async (t) => {
  const f = fixture(t);
  await f.start();
  f.store.move({ x: 70, y: 70 });
  await flush();
  f.streams[0].emit('state', f.frame(1600, 'Latest'));
  assert.equal(f.store.snapshot.serverNow, 1600);
  assert.equal(f.store.snapshot.visitors[0].name, 'Latest');
  f.pending.find((r) => r.url === '/api/lobby/move').resolve(f.frame(1100, 'Old'));
  await flush();
  assert.equal(f.store.snapshot.serverNow, 1600);
});
test('movement cancels only a pending safety read and dispatches without waiting for its timeout', async (t) => {
  const f = fixture(t);
  await f.start();
  const read = f.store.sync();
  await flush();
  const polling = f.pending.filter((r) => r.url.startsWith('/api/lobby?')).at(-1);
  f.store.move({ x: 70, y: 70 });
  await flush();
  assert.equal(polling.signal.aborted, true);
  const move = f.pending.find((r) => r.url === '/api/lobby/move');
  assert.ok(move, 'move must reach transport before the read replies');
  assert.equal(f.store.connected, true);
  move.resolve(f.frame(1200));
  await read;
  await flush();
});

test('teleport preempts a safety read while preserving its authoritative result', async (t) => {
  const f = fixture(t);
  await f.start();
  const read = f.store.sync();
  await flush();
  const polling = f.pending.filter((r) => r.url.startsWith('/api/lobby?')).at(-1);
  const teleport = f.store.teleport();
  await flush();
  assert.equal(polling.signal.aborted, true);
  const command = f.pending.find((r) => r.url === '/api/lobby/teleport');
  assert.ok(command);
  command.resolve(f.frame(1200));
  assert.equal(await teleport, true);
  await read;
  assert.equal(f.store.snapshot.serverNow, 1200);
});
test('a late failed HTTP read cannot disconnect a scene refreshed by a valid live snapshot', async (t) => {
  const f = fixture(t);
  await f.start();
  const read = f.store.sync();
  await flush();
  f.streams[0].emit('state', f.frame(1600));
  f.pending
    .filter((r) => r.url.startsWith('/api/lobby?'))
    .at(-1)
    .reject(Error('slow response failed'));
  await read;
  await flush();
  assert.equal(f.store.connected, true);
  assert.equal(f.store.snapshot.serverNow, 1600);
});
test('rapid movement keeps one mutation in flight and coalesces queued targets to the latest', async (t) => {
  const f = fixture(t);
  await f.start();
  f.store.move({ x: 30, y: 30 });
  f.store.move({ x: 40, y: 40 });
  f.store.move({ x: 80, y: 80 });
  await flush();
  assert.equal(f.pending.filter((r) => r.url === '/api/lobby/move').length, 1);
  f.pending.find((r) => r.url === '/api/lobby/move').resolve(f.frame(1200));
  await flush();
  const moves = f.pending.filter((r) => r.url === '/api/lobby/move');
  assert.equal(moves.length, 2);
  assert.equal(moves[1].body.x, 80);
  moves[1].resolve(f.frame(1400));
  await flush();
});
test('without a newer live snapshot a failed read still reports disconnection', async (t) => {
  const f = fixture(t);
  await f.start();
  const read = f.store.sync();
  await flush();
  f.pending
    .filter((r) => r.url.startsWith('/api/lobby?'))
    .at(-1)
    .reject(Error('offline'));
  await read;
  assert.equal(f.store.connected, false);
});
test('an old or malformed frame cannot conceal an actual connection failure', async (t) => {
  for (const bad of ['old', 'malformed', 'expired']) {
    const f = fixture(t);
    await f.start();
    const read = f.store.sync();
    await flush();
    f.streams[0].emit('state', bad === 'malformed' ? {} : f.frame(bad === 'old' ? 999 : 1600));
    if (bad === 'expired') f.advance(2000);
    f.pending
      .filter((r) => r.url.startsWith('/api/lobby?'))
      .at(-1)
      .reject(Error('offline'));
    await read;
    assert.equal(f.store.connected, false, bad);
  }
});
test('logout closes the old stream and prevents pending replies or queued movement from restoring it', async (t) => {
  const f = fixture(t);
  await f.start();
  f.store.move({ x: 30, y: 30 });
  f.store.move({ x: 80, y: 80 });
  await flush();
  f.session.user = null;
  f.streams[0].emit('state', f.frame(1600));
  f.pending.find((r) => r.url === '/api/lobby/move').resolve(f.frame(1700));
  await flush();
  assert.equal(f.store.snapshot, null);
  assert.equal(f.store.connected, false);
  assert.equal(f.pending.filter((r) => r.url === '/api/lobby/move').length, 1);
  assert.equal(f.streams[0].readyState, 2);
});
