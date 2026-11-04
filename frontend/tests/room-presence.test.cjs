const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function harness() {
  const callbacks = [],
    timers = new Map(),
    listeners = new Map();
  let unmount;
  let next = 0;
  const calls = [];
  const room = {
    seat: { code: 'ABCDEF' },
    scope: 1,
    terminal: false,
    request: async (route) => {
      calls.push(route);
      return {};
    },
    connected: true,
  };
  const document = {
    hidden: true,
    documentElement: { dataset: {} },
    addEventListener: (k, v) => listeners.set(k, v),
    removeEventListener: (k) => listeners.delete(k),
  };
  const vue = {
    ref: (value) => ({ value }),
    computed: (f) => ({
      get value() {
        return f();
      },
    }),
    watch: (f, cb) => callbacks.push(cb),
    onMounted: () => {},
    onBeforeUnmount: (cb) => (unmount = cb),
  };
  const module = { exports: {} };
  const code = ts.transpileModule(
    fs.readFileSync(
      require('node:path').join(__dirname, '../src/composables/room-page.ts'),
      'utf8',
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  vm.runInNewContext(code, {
    exports: module.exports,
    module,
    require: (n) =>
      n === 'vue'
        ? vue
        : n.includes('stores/room')
          ? { useRoomStore: () => room }
          : n.includes('stores/session')
            ? { useSessionStore: () => ({}) }
            : n.includes('requests')
              ? { useRequests: () => ({}) }
              : n.includes('contracts/room')
                ? { gamePath: () => 'poker' }
                : {},
    document,
    window: { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} },
    location: { pathname: '/poker' },
    setTimeout: (cb, ms) => {
      timers.set(++next, { cb, ms });
      return next;
    },
    clearTimeout: (id) => timers.delete(id),
    AbortController,
    DOMException,
    CustomEvent: class {},
    Date,
    console,
  });
  module.exports.useRoomPage('poker', (x) => x);
  return { room, callbacks, timers, calls, unmount: () => unmount() };
}
test('hidden room sends only lightweight presence and cancels timer on teardown', async () => {
  const h = harness();
  h.callbacks[0]();
  assert.equal(h.timers.size, 1);
  const [id, t] = [...h.timers][0];
  assert.equal(t.ms, 30000);
  h.timers.delete(id);
  await t.cb();
  assert.deepEqual(h.calls, ['room-presence']);
  assert.equal(h.timers.size, 1);
  h.unmount();
  assert.equal(h.timers.size, 0);
});
test('leaving a seat cancels background presence', () => {
  const h = harness();
  h.callbacks[0]();
  h.room.seat = null;
  h.callbacks[0]();
  assert.equal(h.timers.size, 0);
  h.unmount();
});
