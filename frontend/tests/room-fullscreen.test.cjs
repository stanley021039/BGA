const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { window } = parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue'),
  ts = require('typescript');
const query = document.querySelector.bind(document);
document.querySelector = (s) => (s === 'dialog:modal, :popover-open' ? null : query(s));
const settle = () => new Promise((resolve) => setImmediate(resolve));
function harness() {
  let api,
    native = null,
    exits = 0,
    scrolls = 0;
  const target = document.createElement('button');
  document.body.append(target);
  let focused = false;
  target.focus = () => {
    focused = true;
  };
  Object.defineProperty(document, 'activeElement', { configurable: true, get: () => target });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => native });
  document.documentElement.requestFullscreen = async () => {
    native = document.documentElement;
  };
  document.exitFullscreen = async () => {
    exits++;
    native = null;
  };
  const mod = { exports: {} };
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/composables/game-focus.ts'),
    'utf8',
  );
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module: mod,
      exports: mod.exports,
      require: (id) => (id === 'vue' ? vue : require(id)),
      document,
      window: {
        scrollTo() {
          scrolls++;
        },
      },
      HTMLElement,
      scrollX: 15,
      scrollY: 25,
    },
  );
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp({
    setup() {
      api = mod.exports.useGameFocus();
      return () => null;
    },
  });
  app.mount(host);
  return {
    get api() {
      return api;
    },
    get exits() {
      return exits;
    },
    get restored() {
      return focused;
    },
    get scrolls() {
      return scrolls;
    },
    nativeExit() {
      native = null;
      document.dispatchEvent(new window.Event('fullscreenchange'));
    },
    async dispose() {
      app.unmount();
      host.remove();
      target.remove();
      await vue.nextTick();
    },
  };
}
test('game fullscreen enters natively, browser exit restores layout and focus', async () => {
  const h = harness();
  try {
    await h.api.toggle();
    assert(h.api.focused.value);
    assert(document.body.classList.contains('vue-game-focus'));
    assert.equal(document.fullscreenElement, document.documentElement);
    h.nativeExit();
    await settle();
    assert.equal(h.api.focused.value, false);
    assert(!document.body.classList.contains('vue-game-focus'));
    assert(h.restored);
    assert.equal(h.exits, 0);
  } finally {
    await h.dispose();
  }
});
test('denied native fullscreen retains a usable game-only layout and Escape exits', async () => {
  const h = harness();
  try {
    document.documentElement.requestFullscreen = async () => {
      throw Error('not supported');
    };
    await h.api.toggle();
    assert(h.api.focused.value);
    assert.equal(document.fullscreenElement, null);
    const modal = document.createElement('dialog');
    document.body.append(modal);
    const original = document.querySelector.bind(document);
    document.querySelector = (s) => (s === 'dialog:modal, :popover-open' ? modal : original(s));
    const escape = () => {
      const e = new window.Event('keydown', { cancelable: true });
      e.key = 'Escape';
      document.dispatchEvent(e);
      return e;
    };
    escape();
    assert(h.api.focused.value, 'modal gets Escape first');
    document.querySelector = original;
    modal.remove();
    assert(escape().defaultPrevented);
    await settle();
    assert.equal(h.api.focused.value, false);
    assert(h.restored);
  } finally {
    await h.dispose();
  }
});
test('late fullscreen completion after exit is released; inactive cleanup does not scroll', async () => {
  const h = harness();
  try {
    let resolve;
    document.documentElement.requestFullscreen = () =>
      new Promise((r) => {
        resolve = r;
      });
    const entering = h.api.toggle();
    await h.api.exit();
    assert.equal(h.api.focused.value, false);
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => document.documentElement,
    });
    resolve();
    await entering;
    assert.equal(h.exits, 1);
    const before = h.scrolls;
    await h.api.exit();
    assert.equal(h.scrolls, before);
  } finally {
    await h.dispose();
  }
});
