const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue'),
  ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');
const file = path.resolve(__dirname, '../src/components/SceneSelfPanel.vue');
const code = ts.transpileModule(
  compileScript(parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor, {
    id: 'self-panel',
    inlineTemplate: true,
  }).content,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
async function mount({ training = false, locked = false, loadFails = false } = {}) {
  const calls = [],
    entrance = vue.ref('classic');
  let failSave = false,
    failLoad = loadFails;
  const store = vue.reactive({
    loadout: { q: 'barrage', e: 'beam', r: '' },
    ready: false,
    pending: false,
    message: '',
    async load() {
      this.ready = true;
    },
    async chooseAll(next) {
      calls.push({ save: next });
      this.message = failSave ? '儲存失敗' : '';
      if (!failSave) this.loadout = { ...next };
    },
  });
  const lobby = vue.reactive({
    snapshot: { arena: { match: null } },
    async sync() {
      calls.push({ sync: true });
    },
  });
  const effects = [
    { id: 'barrage', label: '光子彈' },
    { id: 'beam', label: '光束' },
    { id: 'ultimate', label: '大招' },
    { id: 'locked', label: '未解鎖招式' },
  ];
  const entranceEffects = [
    { id: 'classic', label: '經典現影' },
    { id: 'portal', label: '魔法門' },
  ];
  const slotFit = (slot, id) => (slot === 'r') === (id === 'ultimate');
  const Field = vue.defineComponent({
    props: ['modelValue', 'label', 'disabled', 'control', 'selectedLabel'],
    emits: ['update:modelValue'],
    setup:
      (p, { emit, slots }) =>
      () =>
        vue.h('label', [
          p.label,
          vue.h(
            'select',
            {
              'aria-label': p.label,
              disabled: p.disabled,
              onChange: (e) => emit('update:modelValue', e.target.value),
            },
            slots.default?.(),
          ),
        ]),
  });
  const Button = vue.defineComponent({
    props: ['label', 'disabled', 'pending', 'variant'],
    emits: ['click'],
    setup:
      (p, { emit }) =>
      () =>
        vue.h(
          'button',
          { disabled: p.disabled || p.pending, onClick: () => emit('click') },
          p.label,
        ),
  });
  const Panel = vue.defineComponent({
    props: ['title', 'density'],
    setup:
      (p, { slots }) =>
      () =>
        vue.h('section', [vue.h('h3', p.title), slots.default?.()]),
  });
  const Status = vue.defineComponent({
    props: ['message', 'error', 'persistent'],
    setup: (p) => () => vue.h('p', p.message),
  });
  const mod = { exports: {} };
  vm.runInNewContext(code, {
    module: mod,
    exports: mod.exports,
    URLSearchParams,
    AbortController,
    location: { pathname: training ? '/arena' : '/', search: training ? '?training=1' : '' },
    require(id) {
      if (id === 'vue') return vue;
      if (id.endsWith('attack-loadout'))
        return {
          useAttackLoadoutStore: () => store,
          attackEffects: effects,
          fitsAttackSlot: slotFit,
        };
      if (id.endsWith('stores/lobby')) return { useLobbyStore: () => lobby };
      if (id.endsWith('entrance-effects'))
        return {
          entranceEffect: entrance,
          entranceEffects,
          isFreeEntrance: (id) => id === 'classic',
          setEntranceEffect: (id) => {
            entrance.value = id;
            calls.push({ entrance: id });
          },
        };
      if (id.endsWith('effect-variants'))
        return {
          entranceEffectGroups: entranceEffects.map((e) => ({ original: e, versions: [e] })),
        };
      if (id.endsWith('random-effects'))
        return {
          randomAttacks(current, allowed) {
            assert.equal(allowed('locked'), training);
            return { q: 'beam', e: 'barrage', r: 'ultimate' };
          },
          randomEntrance(current, allowed) {
            assert.equal(allowed('portal'), true);
            return 'portal';
          },
        };
      if (id.endsWith('scene-scope')) return { sceneApiPath: (p) => p + '?training=1' };
      if (id.endsWith('http'))
        return {
          requestJson: async (url, options) => {
            calls.push({ url, options });
            if (failLoad) throw Error('讀取失敗');
            if (options?.method === 'POST') {
              if (failSave) throw Error('儲存失敗');
              return {};
            }
            if (url.includes('/training'))
              return { settings: { q: 'beam', e: 'barrage', r: 'ultimate', entrance: 'portal' } };
            return {
              bonusRewards: { attacks: ['barrage', 'beam', 'ultimate'], entrances: ['portal'] },
            };
          },
        };
      const component = id.endsWith('UiField.vue')
        ? Field
        : id.endsWith('UiButton.vue')
          ? Button
          : id.endsWith('UiPanel.vue')
            ? Panel
            : Status;
      return { default: component };
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const trainingSettings = [];
  const app = vue.createApp({
    render: () =>
      vue.h(mod.exports.default, {
        locked,
        onTrainingSettings: (value) => trainingSettings.push(value),
      }),
  });
  app.mount(host);
  const flush = async () => {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
      await vue.nextTick();
    }
  };
  await flush();
  const click = async (label) => {
    const button = [...host.querySelectorAll('button')].find((b) => b.textContent === label);
    assert.ok(button, label);
    button.click();
    await flush();
  };
  return {
    host,
    store,
    lobby,
    calls,
    entrance,
    trainingSettings,
    click,
    flush,
    failSave: (v) => {
      failSave = v;
    },
    failLoad: (v) => {
      failLoad = v;
    },
    close() {
      app.unmount();
      host.remove();
    },
  };
}
test('personal choices only include owned items, and saving persists attacks then entrance', async () => {
  const c = await mount();
  try {
    assert.equal(
      [...c.host.querySelectorAll('option')].some((o) => o.value === 'locked'),
      false,
    );
    await c.click('隨機配招與進場');
    assert.equal(
      c.calls.some((e) => e.save),
      false,
      'randomize edits the form before explicit save',
    );
    await c.click('儲存自己的設定');
    assert.equal(c.store.loadout.q, 'beam');
    assert.equal(c.store.loadout.r, 'ultimate');
    assert.equal(c.entrance.value, 'portal');
    assert.match(c.host.textContent, /已儲存/);
  } finally {
    c.close();
  }
});
test('failed attack saves never apply entrance; retry preserves the chosen form', async () => {
  const c = await mount();
  try {
    await c.click('隨機配招與進場');
    c.failSave(true);
    await c.click('儲存自己的設定');
    assert.equal(c.entrance.value, 'classic');
    assert.match(c.host.textContent, /儲存失敗/);
    c.failSave(false);
    await c.click('重試');
    assert.equal(c.entrance.value, 'portal');
  } finally {
    c.close();
  }
});
test('failed initial reads can be retried without saving unverified ownership', async () => {
  const c = await mount({ loadFails: true });
  try {
    await c.click('儲存自己的設定');
    assert.equal(
      c.calls.some((e) => e.save),
      false,
    );
    c.failLoad(false);
    await c.click('重試');
    assert.doesNotMatch(c.host.textContent, /讀取失敗/);
    assert.equal(
      c.calls.some((e) => e.save),
      false,
    );
  } finally {
    c.close();
  }
});
test('explicit lock and an active arena match disable all personal mutations', async () => {
  for (const explicit of [false, true]) {
    const c = await mount({ locked: explicit });
    try {
      if (!explicit) {
        c.lobby.snapshot.arena.match = { phase: 'running' };
        await c.flush();
      }
      assert.ok([...c.host.querySelectorAll('select,button')].every((e) => e.disabled));
      await c.click('儲存自己的設定');
      assert.equal(
        c.calls.some((e) => e.save),
        false,
      );
    } finally {
      c.close();
    }
  }
});
test('training saves use the isolated endpoint, notify the parent and never alter the global loadout', async () => {
  const c = await mount({ training: true });
  try {
    await c.click('儲存自己的設定');
    const post = c.calls.find((e) => e.options?.method === 'POST');
    assert.equal(post.url, '/api/lobby/training?training=1');
    assert.equal(post.options.body.action, 'settings');
    assert.equal(c.trainingSettings.length, 1);
    assert.equal(c.trainingSettings[0].entrance, 'portal');
    assert.equal(c.entrance.value, 'classic');
    assert.equal(
      c.calls.some((e) => e.save),
      false,
    );
  } finally {
    c.close();
  }
});
