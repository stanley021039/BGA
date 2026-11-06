const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('../../tests/helpers/browser-modules.cjs'),
  path = require('node:path'),
  vm = require('node:vm');
const vue = require('../node_modules/vue'),
  pinia = require('pinia'),
  ts = require('../node_modules/typescript');
function fixture(request, { saved = new Map(), blocked = false } = {}) {
  const instance = pinia.createPinia(),
    module = { exports: {} },
    listeners = new Set();
  pinia.setActivePinia(instance);
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, '../src/stores/lobby-background.ts'), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    withEngineImports({
      Error,
      localStorage: {
        getItem(key) {
          if (blocked) throw Error('storage blocked');
          return saved.get(key) ?? null;
        },
        setItem(key, value) {
          if (blocked) throw Error('storage blocked');
          saved.set(key, value);
        },
      },
      window: {
        addEventListener(name, callback) {
          if (name === 'storage') listeners.add(callback);
        },
        removeEventListener(name, callback) {
          if (name === 'storage') listeners.delete(callback);
        },
      },
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
    }),
  );
  return {
    store: module.exports.useLobbyBackgroundStore(),
    saved,
    listeners,
    storage: (key) => {
      for (const callback of listeners) callback({ key });
    },
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

test('personal visibility survives a new store without changing shared background, cooldown or making requests', () => {
  let calls = 0;
  const request = () => {
      calls++;
      throw Error('display must not call the server');
    },
    saved = new Map(),
    first = fixture(request, { saved }),
    otherPlayer = fixture(request);
  try {
    first.store.receive({ id: 'castle', changedAt: 10, nextChangeAt: 30010 });
    otherPlayer.store.receive({ id: 'castle', changedAt: 10, nextChangeAt: 30010 });
    first.store.setVisible(false);
    assert.equal(first.store.visible, false);
    assert.equal(first.store.selected, 'castle');
    assert.equal(first.store.nextChangeAt, 30010);
    assert.equal(otherPlayer.store.visible, true);
    assert.equal(otherPlayer.store.selected, 'castle');
    first.store.receive({ id: 'garden', changedAt: 30010, nextChangeAt: 60010 });
    assert.equal(first.store.selected, 'garden');
    assert.equal(
      first.store.visible,
      false,
      'new shared snapshots cannot override the local choice',
    );
    first.close();
    assert.equal(first.listeners.size, 0);
    const reloaded = fixture(request, { saved });
    try {
      assert.equal(reloaded.store.visible, false);
      reloaded.store.setVisible(true);
      assert.equal(saved.get('bga-lobby-background-display-v1'), 'on');
      assert.equal(reloaded.store.visibilityPersisted, true);
      assert.equal(calls, 0);
    } finally {
      reloaded.close();
    }
  } finally {
    first.close();
    otherPlayer.close();
  }
});

test('storage updates/reset are local and disposed stores remove their listener', () => {
  const saved = new Map([['bga-lobby-background-display-v1', 'off']]),
    f = fixture(() => {}, { saved });
  assert.equal(f.store.visible, false);
  saved.set('bga-lobby-background-display-v1', 'on');
  f.storage('unrelated');
  assert.equal(f.store.visible, false);
  f.storage('bga-lobby-background-display-v1');
  assert.equal(f.store.visible, true);
  f.store.setVisible(false);
  saved.clear();
  f.storage(null);
  assert.equal(f.store.visible, true);
  f.close();
  assert.equal(f.listeners.size, 0);
});

test('blocked storage still allows local toggling and reports that it cannot persist', () => {
  const f = fixture(
    () => {
      throw Error('must not request');
    },
    { blocked: true },
  );
  try {
    assert.equal(f.store.visible, true);
    assert.equal(f.store.visibilityPersisted, false);
    f.store.setVisible(false);
    assert.equal(f.store.visible, false);
    assert.equal(f.store.visibilityPersisted, false);
    f.store.setVisible(true);
    assert.equal(f.store.visible, true);
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
