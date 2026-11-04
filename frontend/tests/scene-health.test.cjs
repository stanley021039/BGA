const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue'),
  ts = require('typescript'),
  { parse, compileScript } = require('vue/compiler-sfc');
test('thin living HP bars track health without visible numbers; death and respawn update the tombstone', async () => {
  const file = path.resolve(__dirname, '../src/components/SceneHealth.vue');
  const source = compileScript(
    parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor,
    { id: 'scene-health', inlineTemplate: true },
  ).content;
  const mod = { exports: {} },
    timers = new Map();
  let clock = 0;
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    withEngineImports({
      module: mod,
      exports: mod.exports,
      require: (id) =>
        id === 'vue'
          ? vue
          : id === './SceneEnergy.vue'
            ? {
                default: vue.defineComponent({
                  props: ['visitor'],
                  setup: (props) => () =>
                    vue.h('div', {
                      class: 'scene-energy',
                      role: 'progressbar',
                      'aria-label': '多人招式能量',
                      'aria-valuenow': props.visitor.energy,
                    }),
                }),
              }
            : { default: '/tombstone.svg' },
      performance: { now: () => clock },
      setInterval: (fn) => {
        timers.set(1, fn);
        return 1;
      },
      clearInterval: (id) => timers.delete(id),
    }),
  );
  const visitor = vue.reactive({
    name: '測試玩家',
    health: 12000,
    maxHealth: 12000,
    respawnAt: 0,
    respawnRemainingMs: 0,
  });
  const host = document.createElement('div');
  document.body.append(host);
  const state = vue.reactive({ visitor, self: false, connected: true });
  const app = vue.createApp({ render: () => vue.h(mod.exports.default, state) });
  app.mount(host);
  try {
    assert.equal(host.querySelector('[role=progressbar]').getAttribute('aria-valuenow'), '12000');
    visitor.health = 6000;
    await vue.nextTick();
    assert.equal(host.querySelector('[role=progressbar]').getAttribute('aria-valuenow'), '6000');
    assert.equal(host.querySelector('.scene-health-bar > div').style.width, '50%');
    assert.equal(host.textContent, '');
    assert.equal(timers.size, 0);
    Object.assign(visitor, { health: 0, respawnAt: 3000, respawnRemainingMs: 3000 });
    await vue.nextTick();
    assert.equal(host.querySelector('[role=progressbar]'), null);
    assert.match(host.textContent, /測試玩家/);
    assert.match(host.textContent, /3 秒後重生/);
    assert.equal(host.textContent.match(/測試玩家/g).length, 1);
    assert.equal(host.textContent.match(/3 秒後重生/g).length, 1);
    assert.equal(
      host.querySelector('.scene-tombstone').firstElementChild.className,
      'scene-tombstone-caption',
    );
    assert.equal(host.querySelector('.scene-respawn-seconds'), null);
    clock = 2000;
    timers.get(1)();
    await vue.nextTick();
    assert.match(host.textContent, /1 秒後重生/);
    Object.assign(visitor, { health: 11000, maxHealth: 11000, respawnAt: 0 });
    await vue.nextTick();
    assert.equal(host.textContent, '');
    assert.equal(timers.size, 0);
    assert.equal(host.querySelector('.scene-energy'), null, 'peers do not show energy');
    state.self = true;
    visitor.energy = 40;
    await vue.nextTick();
    const energy = host.querySelector('.scene-energy');
    assert.equal(energy.getAttribute('aria-valuenow'), '40');
    assert.equal(energy.previousElementSibling.className, 'scene-health-bar');
    assert.equal(host.textContent, '');
    state.self = false;
    await vue.nextTick();
    assert.equal(host.querySelector('.scene-energy'), null);
    state.self = true;
    visitor.health = 0;
    await vue.nextTick();
    assert.equal(host.querySelector('.scene-energy'), null, 'no energy under a tombstone');
  } finally {
    app.unmount();
    host.remove();
  }
  assert.equal(timers.size, 0);
});
