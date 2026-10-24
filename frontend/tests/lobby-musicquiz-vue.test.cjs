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
            ? load(path.resolve(path.dirname(file), id + '.ts'))
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
