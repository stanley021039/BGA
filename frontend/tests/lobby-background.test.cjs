const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const vue = require('../node_modules/vue'),
  pinia = require('pinia'),
  ts = require('../node_modules/typescript');
function fixture(request) {
  const instance = pinia.createPinia(),
    module = { exports: {} };
  pinia.setActivePinia(instance);
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, '../src/stores/lobby-background.ts'), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    {
      Error,
      module,
      exports: module.exports,
      require: (id) =>
        id === 'vue'
          ? vue
          : id === 'pinia'
            ? pinia
            : id.endsWith('lobby-backgrounds.json')
              ? { default: require('../../public/shared/lobby-backgrounds.json') }
              : id.includes('/http')
                ? { requestJson: request }
                : { readLobbySnapshot: (value) => value },
    },
  );
  return {
    store: module.exports.useLobbyBackgroundStore(),
    close: () => pinia.disposePinia(instance),
  };
}
test('shared background only changes after server acceptance and ignores older snapshots', async () => {
  let resolve;
  const f = fixture(() => new Promise((done) => (resolve = done)));
  try {
    const job = f.store.select('castle');
    assert.equal(f.store.selected, 'default');
    assert.equal(f.store.pending, true);
    resolve({ background: { id: 'castle', changedAt: 10, nextChangeAt: 30010 } });
    await job;
    assert.equal(f.store.selected, 'castle');
    f.store.receive({ id: 'default', changedAt: 0, nextChangeAt: 0 });
    assert.equal(f.store.selected, 'castle');
    f.store.receive({ id: 'default', changedAt: 30010, nextChangeAt: 60010 });
    assert.equal(f.store.selected, 'default');
  } finally {
    f.close();
  }
});
test('server cooldown failure preserves current background and displays the reason', async () => {
  const f = fixture(async () => {
    throw Error('30 秒後才能更換');
  });
  try {
    await f.store.select('castle');
    assert.equal(f.store.selected, 'default');
    assert.match(f.store.message, /30/);
    assert.equal(f.store.pending, false);
  } finally {
    f.close();
  }
});
