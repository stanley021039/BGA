const { chargeScene } = require('../../tests/helpers/scene-charge.cjs');
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
        Error,
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

function purchaseScene(room, actions) {
  const filename = path.join(__dirname, '../src/pages/musicquiz/MusicQuizScene.vue');
  const script = compileScript(parse(fs.readFileSync(filename, 'utf8')).descriptor, {
    id: 'buy-regression',
  }).content;
  const module = { exports: {} };
  const mocks = {
    vue: { ...vue, onBeforeUnmount() {} },
    '../../stores/room': { useRoomStore: () => room },
    '../../stores/party-actions': { usePartyActionsStore: () => actions },
    '../../stores/preferences': { usePreferencesStore: () => ({}) },
    '../../composables/queued-save': loader({ vue })(
      path.join(__dirname, '../src/composables/queued-save.ts'),
    ),
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
  return module.exports.default.setup({}, { expose() {}, emit() {} });
}

test('real buy command updates buyer and peer scenes; lost-response retry charges only once and old events do not replay', async () => {
  const pinia = require('pinia'),
    { MusicQuizRoom } = require('../../src/games/musicquiz');
  const engine = new MusicQuizRoom(
    'ABCDEF',
    'buy',
    () => 0,
    () => 1000,
  );
  const players = [engine.add('DJ'), engine.add('買家')];
  engine.start();
  players[1].tokens = 3;
  const read = loader()(
    path.join(__dirname, '../src/contracts/musicquiz.ts'),
  ).readMusicQuizSnapshot;
  const rooms = players.map((p) =>
    vue.reactive({
      type: 'musicquiz',
      code: engine.code,
      scope: 1,
      seat: {},
      connected: true,
      busy: false,
      terminal: null,
      settingsManager: false,
      snapshot: read({ ...engine.view(p.id), serverNow: 1000 }),
    }),
  );
  let lostResponse = true;
  const requests = [];
  const instances = [],
    scopes = [],
    scenes = [],
    stores = [];
  try {
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const instance = pinia.createPinia();
      instances.push(instance);
      pinia.setActivePinia(instance);
      const load = loader({ vue, pinia, './room': { useRoomStore: () => room } });
      const { ApiError } = load(path.join(__dirname, '../src/services/http.ts'));
      room.request = async (_route, payload) => {
        requests.push(structuredClone(payload));
        try {
          engine.act(players[i].id, payload.action, payload);
        } catch (e) {
          throw new ApiError(e.message, e.status || 409, e.code);
        }
        if (lostResponse) {
          lostResponse = false;
          throw new ApiError('購買結果尚未確認', 503);
        }
        return engine.view(players[i].id);
      };
      room.accept = (value) => {
        room.snapshot = read({ ...value, serverNow: 1000 });
        return true;
      };
      const actions = load(
        path.join(__dirname, '../src/stores/party-actions.ts'),
      ).usePartyActionsStore();
      stores.push(actions);
      const scope = vue.effectScope();
      scopes.push(scope);
      scenes.push(scope.run(() => purchaseScene(room, actions)));
    }
    assert.equal(await stores[1].command('buy'), false);
    await vue.nextTick();
    assert.equal(scenes[1].purchaseNotice.value, '', 'HTTP error alone never means success');
    assert.match(stores[1].notice, /尚未確認/);
    assert.equal(stores[1].canRetry, true);
    rooms[0].accept(engine.view(players[0].id));
    await vue.nextTick();
    assert.match(scenes[0].purchaseNotice.value, /買家花3枚標記買入/);
    assert.equal(await stores[1].retrySame(), true);
    await vue.nextTick();
    assert.deepEqual(requests[0], requests[1]);
    assert.equal(players[1].tokens, 0);
    assert.equal(players[1].timeline.length, 2);
    assert.equal(stores[1].notice, '');
    assert.equal(scenes[1].purchaseNotice.value, scenes[0].purchaseNotice.value);
    const purchased = players[1].timeline.find(
      (c) => c.id === engine.sequence[engine.cursor - 1].id,
    );
    assert.ok(scenes[1].purchaseNotice.value.includes(purchased.title));
    assert.ok(scenes[1].purchaseNotice.value.includes(String(purchased.year)));
    for (const room of rooms) {
      const buyer = room.snapshot.players.find((p) => p.id === players[1].id);
      assert.equal(buyer.tokens, 0);
      assert.equal(buyer.timeline.length, 2);
    }
    const freshScope = vue.effectScope();
    scopes.push(freshScope);
    const refreshed = freshScope.run(() => purchaseScene(rooms[1], stores[1]));
    assert.equal(refreshed.purchaseNotice.value, '', 'reloading does not announce history');
    assert.equal(await stores[1].command('buy'), false);
    await vue.nextTick();
    assert.match(stores[1].notice, /需要3枚標記/);
    assert.equal(stores[1].canRetry, false);
    assert.equal(scenes[1].purchaseNotice.value, '', 'failed new purchase clears earlier success');
    // A coalesced SSE update must announce both purchases, rather than only the last one.
    for (const player of players) {
      player.tokens = 3;
      engine.act(player.id, 'buy', {
        roundId: engine.roundId,
        requestId: require('node:crypto').randomUUID(),
      });
    }
    for (let i = 0; i < rooms.length; i++) rooms[i].accept(engine.view(players[i].id));
    await vue.nextTick();
    for (const scene of scenes) {
      assert.match(scene.purchaseNotice.value, /DJ花3枚標記買入/);
      assert.match(scene.purchaseNotice.value, /買家花3枚標記買入/);
      assert.equal(scene.purchaseNotice.value.split('\n').length, 2);
    }
    assert.equal(await stores[0].command('listen'), true);
    assert.equal(engine.phase, 'intro');
  } finally {
    scopes.forEach((s) => s.stop());
    instances.forEach(pinia.disposePinia);
  }
});
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

test('persistent homing survives the real Vue contract past its decorative animation and settles a late bite', () => {
  const { createLobby } = require('../../src/rooms/lobby');
  let now = 1000;
  const lobby = createLobby(
    () => now,
    undefined,
    () => 0.5,
  );
  const users = ['a', 'b'].map((id) => ({ id, display_name: id }));
  for (let i = 0; i < 25; i++) {
    lobby.move(users[0], { x: i % 2 ? 10 : 90, y: 50 });
    now += 6500;
    users.forEach((user) => lobby.view(user));
  }
  users.forEach((u, i) => lobby.move(u, { x: 20 + i * 40, y: 50 }));
  now += 10000;
  users.forEach((u) => lobby.view(u));
  const raw = {
    ...lobby.attack(users[0], {
      effect: 'shaohua_devour',
      slot: 'r',
      aspectRatio: 1,
      requestId: 'late-homing-contract',
    }),
    serverNow: now,
  };
  const read = loader()(path.join(__dirname, '../src/contracts/lobby.ts')).readLobbySnapshot;
  const event = raw.attacks[0];
  event.until = event.at + 105000;
  event.head.at = 100000;
  event.head.contactAt = 100000;
  event.head.biteAt = 100400;
  event.head.finished = true;
  event.damage = 1200000;
  event.hits = [
    {
      toId: 'b',
      toX: 60,
      toY: 50,
      phase: 'bite',
      delayMs: 100400,
      pending: false,
      damage: 1200000,
      critical: false,
    },
  ];
  assert.equal(read(raw).attacks[0].hits[0].delayMs, 100400);
  for (const corrupt of [
    (e) => (e.head.at = -1),
    (e) => (e.head.biteAt = Infinity),
    (e) => (e.hits[0].delayMs = 100400.5),
    (e) => (e.effect = 'beam'),
  ]) {
    const broken = structuredClone(raw);
    corrupt(broken.attacks[0]);
    assert.throws(() => read(broken));
  }
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
  chargeScene(lobby, null, users, users[0].id, (ms) => (now += ms));
  const payload = {
    ...lobby.attack(users[0], {
      slot: 'r',
      effect: 'dimension_cleave',
      aspectRatio: 1,
      requestId: 'contract-area-001',
    }),
    serverNow: now,
  };
  const read = loader()(path.join(__dirname, '../src/contracts/lobby.ts')).readLobbySnapshot;
  assert.equal(read(payload).attacks[0].hits.length, 6);
  assert.equal(read(payload).attacks[0].slot, 'r');
  assert.equal(read(payload).visitors.find((v) => v.id === users[0].id).energy, 0);
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
  chargeScene(lobby, null, users, users[0].id, (ms) => (now += ms));
  const raw = lobby.attack(users[0], {
      slot: 'r',
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
test('Rainbow Bear cast snapshots accept all four phases for the caster and target', () => {
  const { createLobby } = require('../../src/rooms/lobby');
  const { rainbow_bear: timing } = require('../../public/shared/attack-timing.json');
  let now = 1000;
  const lobby = createLobby(
    () => now,
    undefined,
    () => 0.5,
  );
  const users = ['a', 'b'].map((id) => ({ id, display_name: id }));
  const [caster, target] = users;
  lobby.move(caster, { x: 40, y: 50 });
  lobby.move(target, { x: 60, y: 50 });
  now += 10000;
  chargeScene(lobby, null, users, caster.id, (ms) => (now += ms));
  const read = loader()(path.join(__dirname, '../src/contracts/lobby.ts')).readLobbySnapshot;
  for (const effect of ['rainbow_bear', 'rainbow_bear_alt']) {
    if (effect.endsWith('_alt')) chargeScene(lobby, null, users, caster.id, (ms) => (now += ms));
    const raw = lobby.attack(caster, {
      slot: 'r',
      effect,
      aspectRatio: 1,
      requestId: 'bear-cast-' + effect.replaceAll('_', '-'),
    });
    const findAttack = (snapshot) =>
      read(snapshot).attacks.find((attack) => attack.effect === effect);
    const attack = findAttack({ ...raw, serverNow: now });
    assert.equal(attack.toId, target.id);
    assert.equal(attack.hits.length, 4);
    attack.hits.forEach((hit, index) => {
      assert.equal(hit.phase, timing[index][2]);
      assert.equal(hit.delayMs, timing[index][0]);
      assert.equal(hit.pending, true);
    });

    const corrupt = structuredClone({ ...raw, serverNow: now });
    corrupt.attacks.find((attack) => attack.effect === effect).hits.at(-1).delayMs += 1;
    assert.throws(() => read(corrupt), /攻擊階段資料格式不正確/);

    now += timing.at(-1)[0];
    const settled = findAttack({ ...lobby.view(target), serverNow: now });
    assert.ok(settled.hits.every((hit) => !hit.pending && hit.damage > 0));
  }
});

test('lobby snapshot retains the reflected projectile variant and rejects non-projectile returns', () => {
  const { createLobby } = require('../../src/rooms/lobby');
  let now = 1000;
  const lobby = createLobby(() => now);
  const attacker = { id: 'a', display_name: 'A' };
  const defender = { id: 'b', display_name: 'B' };
  lobby.move(attacker, { x: 40, y: 50 });
  lobby.move(defender, { x: 60, y: 50 });
  now += 10000;
  lobby.attack(defender, {
    effect: 'crystal_reflection_alt',
    slot: 'q',
    aspectRatio: 1,
    requestId: 'reflected-guard',
  });
  lobby.attack(attacker, {
    effect: 'tidal_blades_alt',
    slot: 'q',
    aspectRatio: 1,
    requestId: 'reflected-tide',
  });
  now += 450;
  const raw = { ...lobby.view(attacker), serverNow: now };
  const read = loader()(path.join(__dirname, '../src/contracts/lobby.ts')).readLobbySnapshot;
  const hit = (snapshot) =>
    snapshot.attacks.find((event) => event.effect === 'crystal_reflection_alt').hits[0];
  assert.equal(hit(read(raw)).reflectedEffect, 'tidal_blades_alt');
  assert.equal(hit(read(raw)).reflectedPhase, 'hit1');
  const corrupted = structuredClone(raw);
  hit(corrupted).reflectedEffect = 'starburst_stream';
  assert.throws(() => read(corrupted), /反彈招式資料格式不正確/);
  const legacy = structuredClone(raw);
  delete hit(legacy).reflectedEffect;
  delete hit(legacy).reflectedPhase;
  delete hit(legacy).reflectionIndex;
  assert.equal(hit(read(legacy)).reflectedEffect, undefined);
  now += 350;
  const both = { ...lobby.view(attacker), serverNow: now };
  const returns = (snapshot) =>
    snapshot.attacks.find((event) => event.effect === 'crystal_reflection_alt').hits;
  assert.equal(returns(read(both)).length, 2);
  assert.equal(returns(read(both))[1].reflectionIndex, 1);
  for (const invalid of [{ reflectionIndex: 0 }, { toId: 'c' }]) {
    const broken = structuredClone(both);
    Object.assign(returns(broken)[1], invalid);
    assert.throws(() => read(broken));
  }
});
