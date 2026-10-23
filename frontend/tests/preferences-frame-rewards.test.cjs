'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const vue = require('vue');
const pinia = require('pinia');
const ts = require('typescript');

test('player frame availability reacts to late reward updates without changing the selected player frame', () => {
  const instance = pinia.createPinia();
  pinia.setActivePinia(instance);
  const listeners = new Set();
  let owned = false;
  const frame = { version: 1, enabled: true, selected: 'default' };
  const browser = {
    BarrageFrames: {
      options: [{ id: 'reward', label: '成就外觀' }],
      canUse: () => owned,
      subscribe(fn) {
        listeners.add(fn);
        fn({ ...frame });
        return () => listeners.delete(fn);
      },
    },
    MediaAppearance: {
      subscribe(fn) {
        fn('default');
        return () => {};
      },
    },
  };
  const mod = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, '../src/stores/preferences.ts'), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    { module: mod, exports: mod.exports, window: browser, require },
  );
  try {
    const store = mod.exports.usePreferencesStore();
    const available = vue.computed(() => store.canUse('reward'));
    assert.equal(available.value, false);
    owned = true;
    for (const fn of listeners) fn({ ...frame });
    assert.equal(store.media, 'default');
    assert.equal(available.value, true);
    owned = false;
    for (const fn of listeners) fn({ ...frame });
    assert.equal(available.value, false);
  } finally {
    pinia.disposePinia(instance);
  }
  assert.equal(listeners.size, 0);
});
