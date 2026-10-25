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
  ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');

test('switch dialog survives ordinary snapshots, validates capacity and sends only an explicit confirmation', async () => {
  const calls = [],
    room = vue.reactive({
      scope: 1,
      host: true,
      type: 'majority',
      busy: false,
      connected: true,
      snapshot: {
        phase: 'waiting',
        players: Array.from({ length: 5 }, (_, i) => ({ id: String(i) })),
        roomGames: [
          { type: 'majority', name: '同頻', min: 3, max: 12 },
          { type: 'thunder', name: '雷霆', min: 2, max: 4 },
          { type: 'gift', name: '送禮', min: 3, max: 8 },
        ],
      },
      async command(route, data) {
        calls.push({ route, data });
        return true;
      },
    });
  const cache = new Map();
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
        require(id) {
          if (id === 'vue') return vue;
          if (id.endsWith('/stores/room')) return { useRoomStore: () => room };
          if (id.endsWith('UiDialog.vue'))
            return {
              default: {
                setup(_, { slots, expose }) {
                  const visible = vue.ref(false);
                  expose({
                    open() {
                      visible.value = true;
                    },
                    close() {
                      visible.value = false;
                    },
                  });
                  return () => vue.h('div', visible.value ? slots.default?.() : []);
                },
              },
            };
          if (/UiIcon.vue|StatusSlot.vue/.test(id)) return { default: { render: () => null } };
          if (id.startsWith('.'))
            return load(path.resolve(path.dirname(file), id + (path.extname(id) ? '' : '.ts')));
          return require(id);
        },
      },
    );
    cache.set(file, mod.exports);
    return mod.exports;
  }
  const root = document.createElement('div');
  document.body.append(root);
  const app = vue.createApp(
    load(path.resolve(__dirname, '../src/components/RoomGameSwitcher.vue')).default,
  );
  app.mount(root);
  try {
    root.querySelector('button').click();
    await vue.nextTick();
    assert.ok(root.querySelector('select'));
    room.snapshot = { ...room.snapshot, version: 7 };
    await vue.nextTick();
    assert.ok(root.querySelector('select'), 'presence/clock updates must not close the dialog');
    const select = root.querySelector('select');
    const choose = (value) => {
      for (const option of select.options) option.selected = false;
      [...select.options].find((option) => option.value === value).selected = true;
      select.dispatchEvent(new Event('change'));
    };
    choose('thunder');
    await vue.nextTick();
    const confirm = () =>
      [...root.querySelectorAll('button')].find((button) =>
        button.textContent.includes('確認切換'),
      );
    assert.equal(confirm().disabled, true);
    assert.match(root.textContent, /最多 4 人/);
    assert.equal(calls.length, 0);
    choose('gift');
    await vue.nextTick();
    assert.equal(confirm().disabled, false);
    confirm().click();
    await vue.nextTick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].route, 'change-game');
    assert.equal(calls[0].data.targetType, 'gift');
    room.host = false;
    await vue.nextTick();
    assert.equal(root.querySelector('select'), null);
    assert.equal(root.querySelector('button'), null);
  } finally {
    app.unmount();
    root.remove();
  }
});
