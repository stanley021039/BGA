'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { window } = parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue'),
  ts = require('typescript'),
  { parse, compileScript } = require('vue/compiler-sfc');

test('finished replay bypasses start validation and remounts the normal start control in the new waiting target', async () => {
  const snapshot = vue.reactive({ phase: 'finished', players: [], code: 'ABCDEF', me: 'host' }),
    calls = [];
  const room = vue.reactive({
    snapshot,
    seat: {},
    host: true,
    busy: false,
    connected: true,
    command(route) {
      calls.push(route);
      snapshot.phase = 'waiting';
    },
  });
  const real = new Set(['GameRoomPage.vue', 'GameSettingsPanel.vue', 'UiButton.vue']);
  const cache = new Map();
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
      {
        module: mod,
        exports: mod.exports,
        document,
        window,
        URLSearchParams,
        location: { search: '' },
        require(id) {
          if (id === 'vue') return vue;
          if (id.endsWith('room-page'))
            return { useRoomPage: () => ({ room, session: {}, connected: vue.ref(true) }) };
          if (id.endsWith('game-assets')) return { warmGame() {} };
          if (/\.(css|scss)$/.test(id)) return {};
          if (id.endsWith('RoomSceneLayout.vue'))
            return {
              default: {
                setup(_, { slots }) {
                  return () =>
                    vue.h('div', [slots.default?.(), slots.side?.({ chatVisible: false })]);
                },
              },
            };
          if (id.endsWith('.vue'))
            return real.has(path.basename(id))
              ? load(path.resolve(path.dirname(file), id))
              : { default: { render: () => null } };
          return require(id);
        },
      },
    );
    cache.set(file, mod.exports);
    return mod.exports;
  }
  const component = load(path.resolve(__dirname, '../src/components/GameRoomPage.vue')).default;
  const root = document.createElement('div');
  document.body.append(root);
  const app = vue.createApp({
    render: () =>
      vue.h(
        component,
        {
          type: 'majority',
          title: '同頻',
          description: '',
          reader: (x) => x,
          phase: snapshot.phase,
          maxPlayers: 12,
          status: () => '',
          setup: true,
          canStart: false,
          setupTarget: snapshot.phase === 'finished' ? '#test-replay' : undefined,
          onStart() {
            calls.push('start');
          },
        },
        {
          default: () =>
            vue.h('div', {
              id: snapshot.phase === 'finished' ? 'test-replay' : 'room-waiting-settings-majority',
            }),
        },
      ),
  });
  app.mount(root);
  await vue.nextTick();
  const replay = root.querySelector('#test-replay button');
  assert.ok(replay);
  assert.equal(replay.disabled, false);
  replay.click();
  await vue.nextTick();
  await vue.nextTick();
  assert.deepEqual(calls, ['rematch']);
  const start = root.querySelector('#room-waiting-settings-majority button');
  assert.ok(start, 'newly mounted waiting target receives the controls');
  assert.match(start.textContent, /開始遊戲/);
  assert.equal(start.disabled, true, 'normal start validation is active again');
  app.unmount();
  root.remove();
});
