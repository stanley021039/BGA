const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
('use strict');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('../../tests/helpers/browser-modules.cjs'),
  path = require('node:path'),
  vm = require('node:vm');
const ts = require('../node_modules/typescript'),
  vue = require('../node_modules/vue'),
  { parse, compileScript } = require('../node_modules/vue/compiler-sfc');
function loader(mocks = {}) {
  const cache = new Map();
  return function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const requireLocal = (id) =>
      Object.hasOwn(mocks, id)
        ? mocks[id]
        : id.endsWith('.json')
          ? { default: require(path.resolve(path.dirname(file), id)) }
          : id.startsWith('.')
            ? load(path.resolve(path.dirname(file), /\.(js|ts)$/.test(id) ? id : id + '.ts'))
            : require(id);
    const source = fs.readFileSync(file, 'utf8'),
      code = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText;
    vm.runInNewContext(
      code,
      withEngineImports({
        module,
        exports: module.exports,
        require: requireLocal,
        setTimeout,
        clearTimeout,
        console,
        AbortController,
        DOMException,
        structuredClone,
        crypto: require('node:crypto').webcrypto,
        document: { hidden: false, addEventListener() {}, removeEventListener() {} },
        window: { addEventListener() {}, removeEventListener() {} },
      }),
      { filename: file },
    );
    return module.exports;
  };
}
test('actual lobby messages survive the Vue contract, including older servers without kind', () => {
  const { createLobby } = require('../../src/rooms/lobby'),
    lobby = createLobby(() => 1000),
    user = { id: 'viewer', display_name: '玩家' };
  lobby.view(user);
  const raw = {
    ...lobby.barrage(user, {
      message: '看得到的彈幕',
      builtinFrameId: 'default',
      requestId: require('node:crypto').randomUUID(),
    }),
    serverNow: 1000,
  };
  const { readLobbySnapshot } = loader()(path.join(__dirname, '../src/contracts/lobby.ts'));
  for (const legacy of [false, true]) {
    const payload = structuredClone(raw);
    if (legacy) delete payload.barrages[0].kind;
    const parsed = readLobbySnapshot(payload);
    assert.equal(parsed.barrages.length, 1);
    assert.equal(parsed.barrages[0].message, '看得到的彈幕');
    assert.equal(parsed.barrages[0].kind, 'barrage');
  }
});

test('server KDA and measured central passage survive the real Vue contract; old snapshots default to zero', () => {
  const { createLobby } = require('../../src/rooms/lobby');
  const raw = createLobby(() => 1000).view({ id: 'a', display_name: 'A' });
  raw.serverNow = 1000;
  raw.visitors[0].kda = { kills: 12, deaths: 3, assists: 5 };
  raw.visitors[0].passage = { left: 15.25, right: 84.75, top: 2, bottom: 98 };
  const read = loader()(path.join(__dirname, '../src/contracts/lobby.ts')).readLobbySnapshot;
  assert.deepEqual(JSON.parse(JSON.stringify(read(raw).visitors[0].kda)), raw.visitors[0].kda);
  assert.equal(read(raw).visitors[0].passage.right, 84.75);
  delete raw.visitors[0].kda;
  delete raw.visitors[0].passage;
  assert.equal(read(raw).visitors[0].kda.kills, 0);
  assert.equal(read(raw).visitors[0].passage, null);
});
test('new waiting rooms save through the real party action store with a null round token', async () => {
  const pinia = require('pinia'),
    { MusicQuizRoom } = require('../../src/games/musicquiz');
  const engine = new MusicQuizRoom(
      'ABCDEF',
      'test',
      () => 0,
      () => 1000,
    ),
    host = engine.add('host');
  const readSnapshot = loader()(
    path.join(__dirname, '../src/contracts/musicquiz.ts'),
  ).readMusicQuizSnapshot;
  const requests = [],
    room = vue.reactive({
      type: 'musicquiz',
      settingsManager: true,
      scope: 1,
      seat: {},
      terminal: null,
      connected: true,
      busy: false,
      snapshot: readSnapshot({ ...engine.view(host.id), serverNow: 1000 }),
    });
  room.request = async (_route, payload) => {
    requests.push(payload);
    engine.act(host.id, payload.action, payload);
    return engine.view(host.id);
  };
  room.accept = (value) => {
    room.snapshot = readSnapshot({ ...value, serverNow: 1000 });
    return true;
  };
  const instance = pinia.createPinia();
  pinia.setActivePinia(instance);
  const load = loader({ vue, pinia, './room': { useRoomStore: () => room } });
  const actions = load(
    path.join(__dirname, '../src/stores/party-actions.ts'),
  ).usePartyActionsStore();
  try {
    assert.equal(room.snapshot.roundId, null);
    assert.equal(
      await actions.command('configure', { banks: ['jp'], genres: [], target: 3, customSongs: [] }),
      true,
    );
    assert.equal(requests[0].roundId, null);
    assert.deepEqual(engine.settings.banks, ['jp']);
    assert.equal(await actions.command('guess', { pass: true }), false);
    assert.equal(requests.length, 1);
    engine.start();
    assert.equal(engine.current.bank, 'jp');
  } finally {
    pinia.disposePinia(instance);
  }
});
test('changing music banks saves the latest selection and re-enables starting; failed saves remain dirty', async () => {
  const room = vue.reactive({
      host: true,
      settingsManager: true,
      terminal: false,
      connected: true,
      busy: false,
      snapshot: {
        phase: 'waiting',
        roundId: 'r',
        settings: { banks: ['zh'], genres: [], target: 10, obscure: false },
        customSongs: [],
        players: [],
      },
    }),
    calls = [],
    events = [];
  let succeed = true;
  const actions = vue.reactive({
    pending: false,
    notice: '',
    command: async (action, payload) => {
      calls.push({ action, payload });
      if (!succeed) {
        actions.notice = '儲存失敗';
        return false;
      }
      room.snapshot.settings = { ...room.snapshot.settings, ...payload };
      return true;
    },
  });
  const load = loader({ vue: vue }),
    queued = load(path.join(__dirname, '../src/composables/queued-save.ts'));
  const filename = path.join(__dirname, '../src/pages/musicquiz/MusicQuizScene.vue'),
    script = compileScript(parse(fs.readFileSync(filename, 'utf8')).descriptor, {
      id: 'bank-regression',
    }).content;
  const module = { exports: {} },
    mocks = {
      vue: { ...vue, onBeforeUnmount() {} },
      '../../stores/room': { useRoomStore: () => room },
      '../../stores/party-actions': { usePartyActionsStore: () => actions },
      '../../stores/preferences': { usePreferencesStore: () => ({}) },
      '../../composables/queued-save': queued,
    };
  vm.runInNewContext(
    ts.transpileModule(script, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    withEngineImports({
      module,
      exports: module.exports,
      require: (id) => mocks[id] || {},
      setInterval: () => 1,
      clearInterval() {},
      console,
    }),
  );
  const scope = vue.effectScope();
  let state;
  scope.run(() => {
    state = module.exports.default.setup({}, { expose() {}, emit: (...e) => events.push(e) });
  });
  try {
    // Model the browser's input -> microtask/render -> change ordering using
    // Vue's real checkbox directive, rather than assigning the array directly.
    const handlers = {},
      checkbox = {
        type: 'checkbox',
        checked: true,
        _value: 'zh',
        addEventListener(name, callback) {
          handlers[name] = callback;
        },
      },
      vnode = {
        props: {
          value: 'zh',
          'onUpdate:modelValue': (value) => {
            state.banks.value = value;
          },
        },
      };
    vue.vModelCheckbox.created(checkbox, {}, vnode);
    vue.vModelCheckbox.mounted(checkbox, { value: state.banks.value }, vnode);
    const stopRender = vue.watchEffect(() => {
      state.dirty.value;
      vue.vModelCheckbox.beforeUpdate(checkbox, { value: state.banks.value }, vnode);
    });
    checkbox.checked = false;
    state.markSettingsInput({ target: checkbox });
    await vue.nextTick();
    assert.equal(checkbox.checked, false, 'input must not restore a checkbox before change');
    handlers.change();
    assert.deepEqual(Array.from(state.banks.value), [], 'the last bank can be unchecked locally');
    stopRender();
    state.markSettingsInput({ target: { type: 'text' } });
    assert.equal(state.dirty.value, true, 'typing still protects the draft from polling');
    state.banks.value = ['jp'];
    state.queueSettings();
    state.banks.value = ['tw'];
    state.queueSettings();
    await state.settingsSave.flush();
    await vue.nextTick();
    assert.equal(calls.length, 1);
    assert.deepEqual(Array.from(calls[0].payload.banks), ['tw']);
    assert.equal(state.dirty.value, false);
    assert.equal(events.at(-1)[1], false);
    succeed = false;
    state.banks.value = ['yue'];
    state.queueSettings();
    await state.settingsSave.flush();
    assert.equal(state.dirty.value, true);
    assert.equal(state.settingsSave.error.value, '儲存失敗');
    succeed = true;
    await state.saveNow();
    assert.equal(state.dirty.value, false);
  } finally {
    scope.stop();
  }
});
test('song translations export the canonical API for browser and Node consumers', () => {
  const titlesApi = require('../src/engines/song-title-zh.js').default;
  assert.equal(titlesApi.titles['ブルーバード'], '青鳥');
  const { CATALOG } = require('../../src/games/musicquiz-library');
  assert.deepEqual(
    CATALOG.filter((s) => s.bank === 'foreign' && !titlesApi.titles[s.title]).map((s) => s.title),
    [],
  );
});
test('each builtin bank can be selected alone and start with six song choices', () => {
  const { MusicQuizRoom } = require('../../src/games/musicquiz'),
    { BANKS } = require('../../src/games/musicquiz-library');
  for (const bank of BANKS.filter((b) => b.id !== 'custom')) {
    const room = new MusicQuizRoom(
        'BANKQA',
        'test',
        () => 0,
        () => 1000,
      ),
      host = room.add('host');
    room.add('peer');
    room.configure(host.id, { banks: [bank.id], genres: [], target: 3 });
    room.start();
    assert.equal(room.current.bank, bank.id);
    assert.equal(room.introChoices.length, 6, bank.id);
  }
});

test('song hints omit Chinese and English songs while retaining distinct foreign translations', () => {
  const { hint } = require('../src/engines/song-title-zh.js').default;
  assert.equal(hint('天黑黑', 'zh'), undefined);
  assert.equal(hint('Shape of You', 'en'), undefined);
  assert.equal(hint('群青', 'jp'), undefined);
  assert.equal(hint('ブルーバード', 'jp'), '中文參考譯名：青鳥');
  assert.equal(hint('Despacito', 'es'), '中文參考譯名：慢慢來');
});

test('lobby speech follows author identity and expiring an older message keeps the latest bubble', () => {
  const pinia = require('pinia'),
    instance = pinia.createPinia();
  pinia.setActivePinia(instance);
  const session = vue.reactive({ user: null });
  const load = loader({ vue, pinia, './session': { useSessionStore: () => session } });
  const lobby = load(path.join(__dirname, '../src/stores/lobby.ts')).useLobbyStore();
  lobby.snapshot = {
    selfId: 'a',
    serverNow: 1000,
    visitors: [{ id: 'a' }, { id: 'b' }],
    barrages: [],
    pingContext: null,
  };
  lobby.connected = true;
  const event = (id, playerId, message) => ({
    id,
    playerId,
    message,
    kind: 'barrage',
    name: 'same name',
    at: 1000,
    emoji: '',
    frame: { kind: 'builtin', id: 'default', version: 1 },
  });
  try {
    const old = lobby.showSpeech(event('one', 'a', 'first'));
    const peer = lobby.showSpeech(event('peer', 'b', 'another speaker'));
    const latest = lobby.showSpeech(event('two', 'a', 'latest'));
    assert.equal(typeof old, 'function');
    assert.equal(typeof peer, 'function');
    assert.equal(typeof latest, 'function');
    assert.equal(lobby.speeches.a.message, 'latest');
    assert.equal(lobby.speeches.b.message, 'another speaker');
    old();
    assert.equal(lobby.speeches.a.message, 'latest');
    assert.equal(
      lobby.showSpeech(event('two', 'a', 'latest')),
      false,
      'same event is not replayed',
    );
    assert.equal(lobby.showSpeech(event('missing', 'absent', 'unknown sender')), false);
    assert.equal(lobby.showSpeech(event('no-id', undefined, 'unknown sender')), false);
    latest();
    assert.equal(lobby.speeches.a, undefined);
    assert.equal(lobby.speeches.b.message, 'another speaker');
    lobby.connected = false;
    assert.equal(lobby.showSpeech(event('offline', 'a', 'offline')), false);
    peer();
    assert.deepEqual(Object.keys(lobby.speeches), []);
  } finally {
    pinia.disposePinia(instance);
  }
});

test('wrap destinations and cosmetic attacks survive the actual lobby contract without accepting corrupt coordinates', () => {
  const { createLobby } = require('../../src/rooms/lobby');
  let now = 1000;
  const lobby = createLobby(() => now),
    a = { id: 'a', display_name: 'A' },
    b = { id: 'b', display_name: 'B' };
  lobby.move(a, { x: 94, y: 50 });
  lobby.move(b, { x: 94, y: 50 });
  now += 10000;
  lobby.view(a);
  lobby.view(b);
  lobby.move(a, { dx: 1, dy: 0 });
  now += 500;
  lobby.view(a);
  const raw = { ...lobby.move(a, { dx: 1, dy: 0 }), serverNow: now };
  assert.ok(raw.visitors.find((v) => v.id === 'a').targetX > 100);
  const read = loader()(path.join(__dirname, '../src/contracts/lobby.ts')).readLobbySnapshot;
  assert.ok(read(raw).visitors.find((v) => v.id === 'a').targetX > 100);
  const attacked = {
    ...lobby.attack(a, { requestId: 'request-contract', aspectRatio: 1 }),
    serverNow: now,
  };
  assert.equal(read(attacked).attacks[0].toId, 'b');
  for (const key of ['fromX', 'fromY', 'toX', 'toY']) {
    const broken = structuredClone(attacked);
    broken.attacks[0][key] = 101;
    assert.throws(() => read(broken));
  }
  const broken = structuredClone(raw);
  broken.visitors[0].targetX = 106;
  assert.throws(() => read(broken));
  delete attacked.attacks;
  delete attacked.visitors[0].wrapId;
  assert.equal(read(attacked).attacks.length, 0);
  assert.equal(read(attacked).visitors[0].wrapId, 0);
});

test('authoritative area hits survive the Vue contract and reject malformed victim payloads', () => {
  const { createLobby } = require('../../src/rooms/lobby');
  let now = 1000;
  const lobby = createLobby(
    () => now,
    undefined,
    () => 0.5,
  );
  const users = ['a', 'b', 'c'].map((id) => ({ id, display_name: id }));
  users.forEach((user, index) => lobby.move(user, { x: 20 + index * 10, y: 50 }));
  now += 10000;
  users.forEach((user) => lobby.view(user));
  const payload = {
    ...lobby.attack(users[0], {
      slot: 'q',
      effect: 'dimension_cleave',
      aspectRatio: 1,
      requestId: 'contract-area-001',
    }),
    serverNow: now,
  };
  const read = loader()(path.join(__dirname, '../src/contracts/lobby.ts')).readLobbySnapshot;
  assert.equal(read(payload).attacks[0].hits.length, 6);
  assert.deepEqual(
    JSON.parse(JSON.stringify(read(payload).attacks[0].hits)),
    payload.attacks[0].hits,
  );
  for (const corrupt of [
    (event) => event.hits.push({ ...event.hits[0] }),
    (event) => (event.hits[0].damage = -1),
    (event) => (event.hits[0].damage = 1.5),
    (event) => (event.hits[0].toX = 101),
    (event) => (event.hits[0].toId = event.fromId),
    (event) => (event.aspectRatio = Infinity),
    (event) => (event.hits[0].critical = 'yes'),
    (event) => (event.hits[0].phase = 'forged-phase'),
  ]) {
    const broken = structuredClone(payload);
    corrupt(broken.attacks[0]);
    assert.throws(() => read(broken));
  }
  const crowd = structuredClone(payload);
  crowd.attacks[0].effect = 'guanyin_barrage';
  crowd.attacks[0].hits = require('../../public/shared/attack-timing.json').guanyin_barrage.flatMap(
    ([delayMs, , phase]) =>
      Array.from({ length: 32 }, (_, i) => ({
        ...payload.attacks[0].hits[0],
        toId: 'victim-' + i,
        phase,
        delayMs,
      })),
  );
  assert.equal(read(crowd).attacks[0].hits.length, 160);
  crowd.attacks[0].hits.push({ ...crowd.attacks[0].hits[0], toId: 'overflow' });
  assert.throws(() => read(crowd));
});
test('three-ray geometry and the owning combat status survive the contract, while malformed fields are rejected', () => {
  const { createLobby } = require('../../src/rooms/lobby');
  let now = 1000;
  const lobby = createLobby(
      () => now,
      undefined,
      () => 0.5,
    ),
    users = Array.from({ length: 7 }, (_, i) => ({ id: String(i), display_name: String(i) }));
  users.forEach((user, i) => lobby.move(user, { x: 20 + i * 5, y: 50 }));
  now += 10000;
  users.forEach((user) => lobby.view(user));
  const raw = lobby.attack(users[0], {
      slot: 'q',
      effect: 'bijuu_beam',
      aspectRatio: 1,
      requestId: 'bijuu-contract-001',
    }),
    read = loader()(path.join(__dirname, '../src/contracts/lobby.ts')).readLobbySnapshot;
  const decoded = read({ ...raw, serverNow: now });
  assert.equal(decoded.attacks[0].rays.length, 3);
  assert.equal(decoded.attacks[0].hits.length, 6);
  assert.ok(decoded.visitors.find((v) => v.id === '0').combatStatus);
  assert.ok(decoded.visitors.filter((v) => v.id !== '0').every((v) => !v.combatStatus));
  const burning = structuredClone(raw);
  Object.assign(burning.visitors.find((v) => v.id === '0').combatStatus, {
    regenWaitMs: 5000,
    regenBlockedMs: 5000,
  });
  assert.equal(
    read({ ...burning, serverNow: now }).visitors.find((v) => v.id === '0').combatStatus
      .regenBlockedMs,
    5000,
  );
  delete burning.visitors.find((v) => v.id === '0').combatStatus.regenBlockedMs;
  assert.equal(
    read({ ...burning, serverNow: now }).visitors.find((v) => v.id === '0').combatStatus
      .regenBlockedMs,
    0,
  );
  for (const corrupt of [
    (p) => p.attacks[0].rays.push({ x: 20, y: 20 }),
    (p) => (p.attacks[0].rays[0].x = 101),
    (p) => (p.visitors.find((v) => v.id === '0').combatStatus.guanyin = 'yes'),
    (p) => (p.visitors.find((v) => v.id === '0').combatStatus.regenWaitMs = -1),
    (p) => (p.visitors.find((v) => v.id === '0').combatStatus.regenBlockedMs = 5001),
    (p) => (p.visitors.find((v) => v.id === '0').combatStatus.regenBlockedMs = '5000'),
  ]) {
    const broken = structuredClone(raw);
    corrupt(broken);
    assert.throws(() => read({ ...broken, serverNow: now }));
  }
});
