const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  ts = require('typescript');
function load(file, imports, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) => {
        if (!(id in imports)) throw Error(id);
        return imports[id];
      },
      ...globals,
    },
  );
  return module.exports;
}
const validation = {
  record(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('object');
    return v;
  },
  array(v) {
    if (!Array.isArray(v)) throw Error('array');
    return v;
  },
  text(v) {
    return typeof v === 'string' ? v : '';
  },
};
const contract = load('contracts/gacha.ts', { '../services/validation': validation });
const item = {
  key: 'attacks:railgun',
  kind: 'attacks',
  id: 'railgun',
  label: '電磁軌道砲',
  rarity: 'rare',
  rarityLabel: '稀有',
  weight: 20,
  duplicateFragments: 5,
  exchangeCost: 100,
  owned: false,
};
const requestId = 'a0000000-0000-4000-8000-000000000001';
const receipt = () => ({
  requestId,
  pool: 'attacks',
  cost: 100,
  results: [{ ...item, duplicate: false, fragments: 0 }],
  fragmentsGained: 0,
  wallet: { coins: 900, fragments: 100 },
  at: '2026-10-29T00:00:00.000Z',
});
const state = () => ({
  wallet: { coins: 1000, fragments: 100 },
  items: [item],
  pools: ['all', ...contract.gachaKinds].map((id) => ({
    id,
    label: id,
    count: 1,
    totalWeight: 20,
  })),
});
test('gacha receipts reject inconsistent pool, costs, duplicates and unsafe wallet values', () => {
  assert.equal(contract.readGachaReceipt(receipt(), 'draw').results[0].label, '電磁軌道砲');
  for (const change of [
    (r) => (r.wallet.coins = -1),
    (r) => (r.wallet.coins = Number.MAX_SAFE_INTEGER + 1),
    (r) => r.results.push(r.results[0]),
    (r) => (r.pool = 'entrances'),
    (r) => (r.fragmentsGained = 5),
    (r) => {
      r.results[0].fragments = 5;
      r.fragmentsGained = 5;
    },
    (r) => (r.requestId = '-'.repeat(36)),
    (r) => (r.operation = 'exchange'),
  ]) {
    const r = receipt();
    change(r);
    assert.throws(() => contract.readGachaReceipt(r, 'draw'));
  }
  assert.throws(() => contract.readGachaReceipt({ ...receipt(), item, cost: 20 }, 'exchange'));
  const ten = receipt();
  ten.results = Array.from({ length: 10 }, (_, i) => ({
    ...item,
    duplicate: i > 0,
    fragments: i > 0 ? 5 : 0,
  }));
  ten.cost = 1000;
  ten.fragmentsGained = 45;
  assert.equal(contract.readGachaReceipt(ten, 'draw').fragmentsGained, 45);
});
test('uncertain draw keeps one request across retry and blocks a second purchase; identity changes discard stale responses', async () => {
  const vue = require('vue'),
    pinia = require('pinia');
  pinia.setActivePinia(pinia.createPinia());
  const session = vue.reactive({ user: { id: 'user-a' } }),
    storage = new Map(),
    calls = [],
    queue = [];
  class ApiError extends Error {
    constructor(status) {
      super('rejected');
      this.status = status;
    }
  }
  const mod = load(
    'stores/gacha.ts',
    {
      vue,
      pinia,
      './session': { useSessionStore: () => session },
      '../services/validation': validation,
      '../contracts/gacha': contract,
      '../services/http': {
        ApiError,
        async requestJson(url, opts) {
          calls.push({ url, ...opts });
          if (url === '/api/gacha') return state();
          return queue.shift()(opts);
        },
      },
    },
    {
      AbortController,
      setTimeout,
      clearTimeout,
      crypto: { randomUUID: () => requestId },
      window: { dispatchEvent() {} },
      CustomEvent: class {},
      sessionStorage: {
        getItem: (k) => storage.get(k),
        setItem: (k, v) => storage.set(k, v),
        removeItem: (k) => storage.delete(k),
      },
    },
  );
  const store = mod.useGachaStore();
  await vue.nextTick();
  await Promise.resolve();
  queue.push(async () => {
    throw Error('connection lost after commit');
  });
  assert.equal(await store.draw('attacks', 1), null);
  assert.equal(store.unsettled.requestId, requestId);
  assert.ok(storage.has('bga:gacha:pending:user-a'));
  const before = calls.length;
  assert.equal(await store.draw('attacks', 10), null);
  assert.equal(calls.length, before);
  queue.push(async () => receipt());
  assert.equal((await store.recover()).requestId, requestId);
  assert.equal(calls.at(-1).body.requestId, calls.at(-2).body.requestId);
  assert.equal(store.unsettled, null);
  assert.equal(store.state.wallet.coins, 900);
  assert.equal(store.state.items[0].owned, true);
  assert.equal(storage.size, 0);
  queue.push(async () => {
    throw new ApiError(409);
  });
  await store.exchange(item.key);
  assert.equal(store.unsettled, null);
  let resolve;
  queue.push(() => new Promise((r) => (resolve = r)));
  const pending = store.draw('attacks', 1);
  session.user = { id: 'user-b' };
  await vue.nextTick();
  await Promise.resolve();
  resolve(receipt());
  await pending;
  assert.equal(store.last, null);
  assert.equal(store.state.wallet.coins, 1000);
  assert.equal(store.state.items[0].owned, false);
  store.$dispose();
});
