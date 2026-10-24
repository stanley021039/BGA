const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('../../tests/helpers/browser-modules.cjs'),
  path = require('node:path'),
  vm = require('node:vm');
const vue = require('../node_modules/vue'),
  pinia = require('pinia'),
  ts = require('../node_modules/typescript');
function fixture(request) {
  const instance = pinia.createPinia();
  pinia.setActivePinia(instance);
  const session = vue.reactive({ user: { id: 'a' } }),
    module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, '../src/stores/attack-loadout.ts'), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    withEngineImports({
      module,
      exports: module.exports,
      require: (id) =>
        id === 'vue'
          ? vue
          : id === 'pinia'
            ? pinia
            : id.endsWith('attack-effects.json')
              ? { default: require('../../public/shared/attack-effects.json') }
              : id.includes('/session')
                ? { useSessionStore: () => session }
                : { requestJson: request },
      AbortController,
      Error,
    }),
  );
  return {
    store: module.exports.useAttackLoadoutStore(),
    session,
    close: () => pinia.disposePinia(instance),
  };
}
test('Q/E loadout saves only after server acceptance and preserves the other slot', async () => {
  const calls = [],
    f = fixture(async (route, options) => {
      calls.push({ route, ...options });
      return options?.body || { q: 'barrage', e: 'beam' };
    });
  try {
    await f.store.load();
    await f.store.choose('q', 'blade_aura');
    assert.equal(f.store.loadout.q, 'blade_aura');
    assert.equal(f.store.loadout.e, 'beam');
    assert.equal(calls[1].body.e, 'beam');
    await f.store.choose('e', 'frost_spikes');
    assert.equal(f.store.loadout.q, 'blade_aura');
    assert.equal(f.store.loadout.e, 'frost_spikes');
  } finally {
    f.close();
  }
});
test('late responses cannot carry another account selections into the current loadout', async () => {
  const resolvers = [];
  const f = fixture(() => new Promise((done) => resolvers.push(done)));
  try {
    const pending = f.store.load();
    f.session.user = { id: 'b' };
    resolvers[0]({ q: 'explosion', e: 'chains' });
    await pending;
    assert.equal(f.store.ready, false);
    assert.equal(f.store.loadout.q, 'barrage');
    assert.equal(f.store.loadout.e, 'beam');
    resolvers[1]({ q: 'shield', e: 'sphere' });
    await f.store.load();
    assert.equal(f.store.ready, true);
    assert.equal(f.store.loadout.q, 'shield');
  } finally {
    f.close();
  }
});
test('save failures keep the accepted choices and expose the server message', async () => {
  let fail = false;
  const f = fixture(async () => {
    if (fail) throw Error('儲存暫停');
    return { q: 'shield', e: 'sphere' };
  });
  try {
    await f.store.load();
    fail = true;
    await f.store.choose('q', 'explosion');
    assert.equal(f.store.loadout.q, 'shield');
    assert.equal(f.store.message, '儲存暫停');
    assert.equal(f.store.pending, false);
  } finally {
    f.close();
  }
});
