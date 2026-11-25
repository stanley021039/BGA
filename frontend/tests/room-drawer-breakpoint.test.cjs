'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
// Linkedom lacks the browser's boolean inert DOM property.
Object.defineProperty(HTMLElement.prototype, 'inert', {
  configurable: true,
  get() {
    return this.hasAttribute('inert');
  },
  set(value) {
    if (value) this.setAttribute('inert', '');
    else this.removeAttribute('inert');
  },
});
const vue = require('vue');
const ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');

test('resizing a wide room closes both drawers without blocking play, while explicit mobile toggles still work', async () => {
  let change;
  const media = {
    matches: false,
    addEventListener(_type, listener) {
      change = listener;
    },
    removeEventListener(_type, listener) {
      if (change === listener) change = null;
    },
  };
  window.matchMedia = () => media;
  const file = path.resolve(__dirname, '../src/components/RoomSceneLayout.vue');
  const source = compileScript(
    parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor,
    { id: 'room-layout', inlineTemplate: true },
  ).content;
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
      HTMLElement,
      require(id) {
        if (id === 'vue') return vue;
        if (id.endsWith('stores/room'))
          return { useRoomStore: () => ({ scope: 1, code: 'ABCDEF' }) };
        if (id.endsWith('stores/chat')) return { useChatStore: () => ({ unread: 0 }) };
        if (id.endsWith('RoomSidePanel.vue'))
          return {
            default: {
              props: ['side', 'open'],
              emits: ['toggle', 'close'],
              setup(props, { emit }) {
                return () =>
                  vue.h('button', {
                    'data-side': props.side,
                    'data-open': String(props.open),
                    onClick: () => emit('toggle'),
                  });
              },
            },
          };
        if (id.endsWith('.vue')) return { default: { render: () => null } };
        if (id.endsWith('.scss')) return {};
        throw Error('Unexpected import ' + id);
      },
    },
  );
  const root = document.createElement('div');
  document.body.append(root);
  const app = vue.createApp(mod.exports.default, { connected: true, focused: false });
  app.mount(root);
  const open = () => [...root.querySelectorAll('[data-side]')].map((n) => n.dataset.open);
  try {
    assert.deepEqual(open(), ['true', 'true']);
    media.matches = true;
    change();
    await vue.nextTick();
    assert.deepEqual(open(), ['false', 'false']);
    assert.equal(document.querySelector('.vue-room-drawer-backdrop'), null);
    assert.equal(root.querySelector('main').hasAttribute('inert'), false);
    root.querySelector('[data-side="right"]').click();
    await vue.nextTick();
    assert.deepEqual(open(), ['false', 'true']);
    assert.ok(root.querySelector('main').hasAttribute('inert'));
    document.querySelector('.vue-room-drawer-backdrop').click();
    await vue.nextTick();
    assert.deepEqual(open(), ['false', 'false']);
    assert.equal(root.querySelector('main').hasAttribute('inert'), false);
  } finally {
    app.unmount();
    root.remove();
  }
  assert.equal(change, null, 'breakpoint listener removed on unmount');
});
