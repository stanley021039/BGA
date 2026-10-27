const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
test('own HUD reacts to health, regeneration and buff changes, without moving status into character labels', async () => {
  const { window } = require('linkedom').parseHTML('<html><body></body></html>');
  for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
    global[key] = key === 'window' ? window : window[key];
  const vue = require('vue'),
    ts = require('typescript'),
    { parse, compileScript } = require('vue/compiler-sfc'),
    file = path.join(__dirname, '../src/components/SceneKda.vue');
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      compileScript(parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor, {
        id: 'self-hud',
        inlineTemplate: true,
      }).content,
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    {
      module,
      exports: module.exports,
      require: (id) =>
        id === 'vue'
          ? vue
          : {
              default: vue.defineComponent({
                setup:
                  (_p, { slots }) =>
                  () =>
                    vue.h('span', slots.default?.()),
              }),
            },
    },
  );
  const state = vue.reactive({
    connected: true,
    self: {
      health: 1000000,
      maxHealth: 1200000,
      combatStatus: {
        authorBonus: false,
        guanyin: false,
        excalibur: false,
        shield: 'none',
        regenerating: false,
        regenWaitMs: 1000,
        regenPerSecond: 40000,
      },
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp({
    render: () =>
      vue.h(module.exports.default, { ...state, value: { kills: 2, deaths: 1, assists: 3 } }),
  });
  app.mount(host);
  try {
    assert.match(host.textContent, /HP 1,000,000／1,200,000/);
    assert.match(
      host.querySelector('[data-status="timer"]').getAttribute('aria-label'),
      /等待回復 1.0 秒/,
    );
    assert.doesNotMatch(host.textContent, /生命已滿|無暫時增益/);
    Object.assign(state.self.combatStatus, {
      guanyin: true,
      shield: 'residual',
      regenerating: true,
      regenWaitMs: 0,
    });
    state.self.health = 1040000;
    await vue.nextTick();
    assert.match(
      host.querySelector('[data-status="healing"]').getAttribute('aria-label'),
      /回復中，每秒 \+40,000 HP/,
    );
    assert.match(
      host.querySelector('[data-status="health-up"]').getAttribute('aria-label'),
      /生命上限 \+10%/,
    );
    assert.match(
      host.querySelector('[data-status="attack-up"]').getAttribute('aria-label'),
      /攻擊 \+10%/,
    );
    assert.match(
      host.querySelector('[data-status="shield"]').getAttribute('aria-label'),
      /護盾半幅/,
    );
    assert.doesNotMatch(host.textContent, /回復中|觀音增益|生命已滿|無暫時增益/);
    Object.assign(state.self.combatStatus, {
      regenBlockedMs: 5000,
      regenWaitMs: 5000,
      regenerating: false,
    });
    await vue.nextTick();
    assert.match(
      host.querySelector('[data-status="healing"]').getAttribute('aria-label'),
      /燃燒：5.0 秒內無法回復/,
    );
    assert.equal(host.querySelector('[data-status="timer"]'), null);
    Object.assign(state.self.combatStatus, {
      regenBlockedMs: 0,
      regenWaitMs: 0,
      regenerating: true,
    });
    await vue.nextTick();
    assert.match(
      host.querySelector('[data-status="healing"]').getAttribute('aria-label'),
      /回復中/,
    );
    state.connected = false;
    await vue.nextTick();
    assert.match(
      host.querySelector('[data-status="refresh"]').getAttribute('aria-label'),
      /等待更新/,
    );
  } finally {
    app.unmount();
    host.remove();
  }
});
