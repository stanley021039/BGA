const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
('use strict');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { window } = parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue');
const ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');
function harness() {
  const timers = new Map(),
    cache = new Map();
  let nextTimer = 0,
    toggles = 0;
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const source = compileScript(
      parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor,
      { id: path.basename(file), inlineTemplate: true },
    ).content;
    const mod = { exports: {} };
    vm.runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      withEngineImports({
        module: mod,
        exports: mod.exports,
        document,
        window,
        ResizeObserver: class {
          observe() {}
          disconnect() {}
        },
        setTimeout(fn, delay) {
          const id = ++nextTimer;
          timers.set(id, { fn, delay });
          return id;
        },
        clearTimeout(id) {
          timers.delete(id);
        },
        require(id) {
          if (id === 'vue') return vue;
          if (id.includes('stores/preferences'))
            return { usePreferencesStore: () => ({ motion: { enabled: true } }) };
          if (id.endsWith('.vue')) return load(path.resolve(path.dirname(file), id));
          if (/\.(css|scss)$/.test(id)) return {};
          return require(id);
        },
      }),
    );
    cache.set(file, mod.exports);
    return mod.exports;
  }
  const props = vue.reactive({
    enabled: true,
    open: false,
    mobile: false,
    focused: false,
    side: 'left',
    title: '玩家列表',
  });
  const host = document.createElement('div');
  document.body.append(host);
  const component = load(path.resolve(__dirname, '../src/components/RoomSidePanel.vue')).default;
  const app = vue.createApp({
    render: () =>
      vue.h(component, {
        ...props,
        onToggle() {
          toggles++;
        },
      }),
  });
  app.mount(host);
  const button = host.querySelector('button.vue-room-panel-handle'),
    slot = host.querySelector('.vue-room-panel-handle-slot');
  function event(target, type, pointerType) {
    const e = new window.Event(type, { bubbles: true });
    if (pointerType) Object.defineProperty(e, 'pointerType', { value: pointerType });
    target.dispatchEvent(e);
  }
  const visible = () => slot.getAttribute('data-tooltip-visible') === 'true';
  return {
    props,
    host,
    button,
    slot,
    timers,
    event,
    visible,
    get toggles() {
      return toggles;
    },
    dispose() {
      app.unmount();
      host.remove();
    },
  };
}
test('actual panel tooltip expires while focus remains and click never leaves stale help', async () => {
  const h = harness();
  try {
    assert.equal(h.visible(), false);
    h.event(h.slot, 'pointerenter', 'mouse');
    await vue.nextTick();
    assert.equal(h.visible(), true);
    assert.equal(
      h.button.getAttribute('title'),
      '',
      'native tooltip cannot linger beside the managed tooltip',
    );
    assert.equal(
      h.button.getAttribute('aria-describedby'),
      h.host.querySelector('[role=tooltip]').id,
    );
    assert.equal(h.timers.size, 1);
    const timer = [...h.timers.values()][0];
    assert.equal(timer.delay, 4000);
    timer.fn();
    await vue.nextTick();
    assert.equal(h.visible(), false);
    assert.equal(h.timers.size, 0);
    h.event(h.slot, 'pointerenter', 'mouse');
    await vue.nextTick();
    h.event(h.button, 'click');
    await vue.nextTick();
    assert.equal(h.toggles, 1);
    assert.equal(h.visible(), false);
    assert.equal(h.timers.size, 0);
    assert.equal(h.button.getAttribute('aria-describedby'), null);
  } finally {
    h.dispose();
  }
});
test('pointer focus and touch do not pin help; keyboard focus shows it and blur hides it', async () => {
  const h = harness();
  try {
    let keyboard = false;
    const matches = h.button.matches.bind(h.button);
    h.button.matches = (selector) => (selector === ':focus-visible' ? keyboard : matches(selector));
    h.event(h.button, 'focusin');
    await vue.nextTick();
    assert.equal(h.visible(), false);
    h.event(h.slot, 'pointerenter', 'touch');
    await vue.nextTick();
    assert.equal(h.visible(), false);
    keyboard = true;
    h.event(h.button, 'focusin');
    await vue.nextTick();
    assert.equal(h.visible(), true);
    h.event(h.button, 'focusout');
    await vue.nextTick();
    assert.equal(h.visible(), false);
    h.event(h.slot, 'pointerenter', 'mouse');
    await vue.nextTick();
    assert.equal(h.visible(), true);
    h.event(h.slot, 'pointerleave', 'mouse');
    await vue.nextTick();
    assert.equal(h.visible(), false);
  } finally {
    h.dispose();
  }
});
test('external panel changes and unmount clear the pending tooltip timer', async () => {
  const h = harness();
  h.event(h.slot, 'pointerenter', 'mouse');
  await vue.nextTick();
  h.props.open = true;
  await vue.nextTick();
  assert.equal(h.visible(), false);
  assert.equal(h.timers.size, 0);
  h.event(h.slot, 'pointerenter', 'mouse');
  await vue.nextTick();
  assert.equal(h.timers.size, 1);
  h.dispose();
  assert.equal(h.timers.size, 0);
});
