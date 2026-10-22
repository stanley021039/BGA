'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const vue = require('../node_modules/vue'),
  pinia = require('pinia'),
  ts = require('../node_modules/typescript');
function fixture(storage) {
  const session = vue.reactive({ user: { id: 'alice' } }),
    instance = pinia.createPinia(),
    module = { exports: {} };
  pinia.setActivePinia(instance);
  const source = fs.readFileSync(path.join(__dirname, '../src/stores/lobby-background.ts'), 'utf8');
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    {
      module,
      exports: module.exports,
      localStorage: storage,
      require: (id) =>
        id === 'vue' ? vue : id === 'pinia' ? pinia : { useSessionStore: () => session },
    },
  );
  return {
    session,
    store: module.exports.useLobbyBackgroundStore(),
    close: () => pinia.disposePinia(instance),
  };
}
test('header background preferences share the lobby selection without leaking between accounts', async () => {
  const data = new Map([['lobby-background:alice', 'castle']]),
    f = fixture({ getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) });
  try {
    assert.equal(f.store.selected, 'castle');
    f.session.user = { id: 'bob' };
    await vue.nextTick();
    assert.equal(f.store.selected, 'default');
    f.store.select('castle');
    assert.equal(data.get('lobby-background:bob'), 'castle');
    f.session.user = null;
    await vue.nextTick();
    assert.equal(f.store.selected, 'default');
    f.session.user = { id: 'alice' };
    await vue.nextTick();
    assert.equal(f.store.selected, 'castle');
    f.store.select('black');
    assert.equal(f.store.selected, 'castle');
  } finally {
    f.close();
  }
});
test('blocked storage still permits a temporary background selection', () => {
  const f = fixture({
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
  });
  try {
    assert.equal(f.store.selected, 'default');
    f.store.select('castle');
    assert.equal(f.store.selected, 'castle');
  } finally {
    f.close();
  }
});
