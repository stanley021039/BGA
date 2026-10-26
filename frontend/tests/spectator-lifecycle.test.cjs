'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue'),
  ts = require('typescript'),
  { parse, compileScript } = require('vue/compiler-sfc');
const { spectatorView } = require('../../src/rooms/spectator');
const { DrawGuessRoom } = require('../../src/games/draw-guess');
const { Room } = require('../../src/games/poker');
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await vue.nextTick();
  await Promise.resolve();
};

function fixture() {
  let now = 100000,
    id = 0;
  const timers = new Map(),
    calls = [],
    urls = [],
    cache = new Map();
  const schedule = (fn, delay, repeat = false) => {
    const n = ++id;
    timers.set(n, { fn, at: now + delay, delay, repeat });
    return n;
  };
  const advance = async (ms) => {
    const end = now + ms;
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at;
      timers.delete(next[0]);
      if (next[1].repeat) timers.set(next[0], { ...next[1], at: now + next[1].delay });
      next[1].fn();
      await flush();
    }
    now = end;
    await flush();
  };
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }
  const http = {
    ApiError,
    requestJson(url, options) {
      return new Promise((resolve, reject) => calls.push({ url, options, resolve, reject }));
    },
  };
  const stub = (name) =>
    vue.defineComponent({
      name,
      inheritAttrs: false,
      setup(props, { attrs, slots }) {
        return () =>
          vue.h(name === 'UiLink' ? 'a' : 'section', { 'data-component': name, ...attrs }, [
            attrs.title || attrs.label || attrs.message || '',
            slots.default?.(),
          ]);
      },
    });
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    let source = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.vue'))
      source = compileScript(parse(source, { filename: file }).descriptor, {
        id: path.basename(file),
        inlineTemplate: true,
      }).content;
    const mod = { exports: {} };
    vm.runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        module: mod,
        exports: mod.exports,
        document,
        window,
        Error,
        DOMException,
        AbortController,
        Date: { now: () => now },
        location: { pathname: '/draw/ABCDEF' },
        history: {
          replaceState(a, b, url) {
            urls.push(url);
          },
        },
        setTimeout: (fn, ms) => schedule(fn, ms),
        clearTimeout: (n) => timers.delete(n),
        setInterval: (fn, ms) => schedule(fn, ms, true),
        clearInterval: (n) => timers.delete(n),
        require(request) {
          if (request === 'vue') return vue;
          if (request.endsWith('/http')) return http;
          if (request.endsWith('.scss')) return {};
          if (request.endsWith('.vue')) return { default: stub(path.basename(request, '.vue')) };
          return request.startsWith('.')
            ? load(path.resolve(path.dirname(file), request + '.ts'))
            : require(request);
        },
      },
    );
    cache.set(file, mod.exports);
    return mod.exports;
  }
  const component = load(path.resolve(__dirname, '../src/components/RoomSpectator.vue')).default;
  const root = document.createElement('div');
  document.body.append(root);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  const app = vue.createApp(component, { code: 'ABCDEF' });
  app.mount(root);
  const visible = (hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new window.Event('visibilitychange'));
  };
  return {
    calls,
    urls,
    timers,
    root,
    advance,
    visible,
    ApiError,
    close() {
      app.unmount();
      root.remove();
    },
  };
}

test('actual spectator component has one read, ignores aborted responses, follows game changes and stops after permission loss or unmount', async () => {
  const f = fixture();
  try {
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].url, '/api/watch?code=ABCDEF');
    await f.advance(2000);
    assert.equal(f.calls.length, 1, 'no overlapping read');
    const draw = new DrawGuessRoom('ABCDEF', 'draw');
    draw.add('a');
    draw.add('b');
    draw.start();
    const first = spectatorView(draw);
    first.serverNow = 100000;
    f.calls[0].resolve(first);
    await flush();
    assert.match(f.root.textContent, /你畫我猜觀戰/);
    await f.advance(1000);
    assert.equal(f.calls.length, 2);
    f.visible(true);
    assert.equal(f.calls[1].options.signal.aborted, true);
    f.calls[1].resolve({ ...first, title: '遲到的舊資料' });
    await flush();
    assert.doesNotMatch(f.root.textContent, /遲到的舊資料/);
    await f.advance(5000);
    assert.equal(f.calls.length, 2);
    f.visible(false);
    assert.equal(f.calls.length, 3);
    const poker = new Room('ABCDEF', 'poker');
    poker.add('a');
    poker.add('b');
    poker.start();
    const next = spectatorView(poker);
    next.gameRevision = 1;
    next.serverNow = 108000;
    f.calls[2].resolve(next);
    await flush();
    assert.match(f.root.textContent, /德州撲克觀戰/);
    assert.equal(f.urls.at(-1), '/poker/ABCDEF?watch=1');
    assert.equal(f.root.querySelector('[data-component="SpectatorCanvas"]'), null);
    await f.advance(2500);
    assert.equal(f.calls.length, 4);
    f.calls[3].reject(new f.ApiError('已被踢出', 403));
    await flush();
    assert.doesNotMatch(f.root.textContent, /德州撲克觀戰/);
    assert.equal(f.timers.size, 0);
    await f.advance(20000);
    assert.equal(f.calls.length, 4);
  } finally {
    f.close();
  }
  assert.equal(f.timers.size, 0);
});

test('spectator unmount aborts in-flight reads and ignores a later successful response', async () => {
  const f = fixture();
  f.close();
  assert.equal(f.calls[0].options.signal.aborted, true);
  const r = new Room('ABCDEF', 'poker');
  r.add('a');
  f.calls[0].resolve(spectatorView(r));
  await flush();
  await f.advance(20000);
  assert.equal(f.calls.length, 1);
  assert.equal(f.urls.length, 0);
  assert.equal(f.timers.size, 0);
});
test('spectator timeouts can retry and countdown offsets do not move between server responses', async () => {
  const f = fixture();
  try {
    await f.advance(10000);
    assert.equal(f.calls[0].options.signal.aborted, true);
    f.calls[0].reject(f.calls[0].options.signal.reason);
    await flush();
    await f.advance(2500);
    assert.equal(f.calls.length, 2);
    const r = new Room('ABCDEF', 'poker');
    r.add('a');
    r.add('b');
    r.start();
    const snapshot = spectatorView(r);
    snapshot.serverNow = 100000;
    snapshot.deadline = 145000;
    f.calls[1].resolve(snapshot);
    await flush();
    let countdown = f.root.querySelector('[data-component="RoomCountdown"]');
    const offset = countdown.getAttribute('offset'),
      before = countdown.getAttribute('now');
    await f.advance(1000);
    countdown = f.root.querySelector('[data-component="RoomCountdown"]');
    assert.equal(countdown.getAttribute('offset'), offset);
    assert.ok(Number(countdown.getAttribute('now')) > Number(before));
  } finally {
    f.close();
  }
});
