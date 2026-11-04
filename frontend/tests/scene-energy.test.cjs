const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('energy meter tracks accessible progress without visible text or numbers', async () => {
  const { window } = require('linkedom').parseHTML('<html><body></body></html>');
  for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
    global[key] = key === 'window' ? window : window[key];
  const vue = require('vue'),
    ts = require('typescript');
  const { parse, compileScript } = require('vue/compiler-sfc');
  const file = path.join(__dirname, '../src/components/SceneEnergy.vue');
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      compileScript(parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor, {
        id: 'energy-meter',
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
  const state = vue.reactive({ visitor: { energy: 0 }, connected: true });
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp({ render: () => vue.h(module.exports.default, state) });
  app.mount(host);
  try {
    const meter = host.querySelector('[role="progressbar"]');
    assert.equal(meter.getAttribute('aria-valuenow'), '0');
    assert.equal(host.textContent, '');
    state.visitor.energy = 99;
    await vue.nextTick();
    assert.equal(meter.getAttribute('aria-valuenow'), '99');
    assert.equal(host.textContent, '');
    state.visitor.energy = 100;
    await vue.nextTick();
    assert.equal(meter.getAttribute('aria-valuenow'), '100');
    assert.equal(host.textContent, '');
    assert.equal(meter.firstElementChild.style.width, '100%');
    state.connected = false;
    await vue.nextTick();
    assert.equal(meter.getAttribute('aria-busy'), 'true');
    assert.equal(host.textContent, '');
  } finally {
    app.unmount();
    host.remove();
  }
});
