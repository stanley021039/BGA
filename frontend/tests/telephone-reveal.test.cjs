'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { parseHTML } = require('linkedom');
const { window } = parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue');
const pinia = require('pinia');
const ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');
const { TelephoneRoom } = require('../../src/games/telephone');
function loader(mocks = {}) {
  const cache = new Map();
  return function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    vm.runInNewContext(
      ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        module: loaded,
        exports: loaded.exports,
        document,
        performance,
        structuredClone,
        sessionStorage: { getItem: () => null, removeItem() {}, setItem() {} },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        require: (id) =>
          mocks[id] ||
          (id.startsWith('.') ? load(path.resolve(path.dirname(file), id + '.ts')) : require(id)),
      },
    );
    return loaded.exports;
  };
}
function completedGame() {
  let now = 1000;
  const engine = new TelephoneRoom(
    'ABCDEF',
    '逐頁',
    () => 0,
    () => now,
  );
  const players = Array.from({ length: 3 }, (_, i) => engine.add('玩家' + i));
  engine.start();
  for (let round = 1; round <= engine.roundLimit; round++) {
    for (const player of players)
      engine.act(player.id, 'submit', {
        stepId: engine.stepId,
        requestId: randomUUID(),
        ...(round % 2
          ? { strokes: [{ tool: 'brush', color: '#123456', size: 2, points: [[1, 1]] }] }
          : { text: '秘密猜詞' + player.name }),
      });
    now = engine.deadline;
    engine.auto();
  }
  return { engine, players };
}
function client(engine, player) {
  const instance = pinia.createPinia();
  pinia.setActivePinia(instance);
  const room = vue.reactive({
    scope: 1,
    code: engine.code,
    seat: {},
    connected: true,
    host: player.id === engine.host,
    snapshot: null,
  });
  const actions = vue.reactive({
    pending: false,
    notice: '',
    target: '',
    setTarget(value) {
      this.target = value;
    },
    async command(action, data) {
      engine.act(player.id, action, { ...data, stepId: engine.stepId, requestId: randomUUID() });
      refresh();
      return true;
    },
  });
  const roomContract = loader()(path.join(__dirname, '../src/contracts/room.ts'));
  const load = loader({
    vue,
    pinia,
    './room': { ...roomContract, useRoomStore: () => room },
    './party-actions': { usePartyActionsStore: () => actions },
  });
  const reader = load(path.join(__dirname, '../src/contracts/telephone.ts')).readTelephoneSnapshot;
  function refresh() {
    room.snapshot = reader(engine.view(player.id));
    room.host = player.id === engine.host;
  }
  refresh();
  const store = load(path.join(__dirname, '../src/stores/telephone.ts')).useTelephoneStore();
  const stub = {
    setup(_p, { expose }) {
      expose({ cancel() {} });
      return () => null;
    },
  };
  const button = {
    props: ['label', 'disabled', 'pending'],
    emits: ['click'],
    setup(props, { emit }) {
      return () =>
        vue.h(
          'button',
          { 'aria-label': props.label, disabled: props.disabled, onClick: () => emit('click') },
          props.label,
        );
    },
  };
  const source = compileScript(
    parse(
      fs.readFileSync(path.join(__dirname, '../src/pages/telephone/TelephoneScene.vue'), 'utf8'),
    ).descriptor,
    { id: 'reveal', inlineTemplate: true },
  ).content;
  const loaded = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module: loaded,
      exports: loaded.exports,
      document,
      require: (id) =>
        id === 'vue'
          ? vue
          : id.includes('stores/telephone')
            ? { useTelephoneStore: () => store }
            : id.includes('stores/room')
              ? { useRoomStore: () => room }
              : id.includes('stores/party-actions')
                ? { usePartyActionsStore: () => actions }
                : { default: id.endsWith('UiButton.vue') ? button : stub },
    },
  );
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp(loaded.exports.default);
  app.mount(host);
  return {
    host,
    store,
    room,
    actions,
    reader,
    refresh,
    dispose() {
      app.unmount();
      pinia.disposePinia(instance);
      host.remove();
    },
  };
}
test('three actual scenes follow one server reveal position and render only one page', async () => {
  const { engine, players } = completedGame();
  const clients = players.map((player) => client(engine, player));
  try {
    for (const current of clients) {
      assert.equal(current.host.querySelectorAll('.vue-telephone-book-page').length, 0);
      assert.doesNotMatch(current.host.textContent, /秘密猜詞/);
    }
    assert.equal(clients[0].store.canReveal, true);
    assert.equal(clients[1].store.canReveal, false);
    assert.equal(await clients[1].store.reveal(), false);
    const pages = engine.books.flatMap((book) => book.pages);
    for (let index = 0; index < pages.length; index++) {
      clients[0].host.querySelector('button').click();
      await vue.nextTick();
      for (const current of clients) current.refresh();
      await vue.nextTick();
      for (const current of clients) {
        assert.equal(current.host.querySelectorAll('.vue-telephone-book-page').length, 1);
        assert.equal(current.store.state.review.index, index);
        const text = current.host.querySelector('.vue-telephone-book-text');
        assert.equal(
          text?.textContent || '',
          pages[index].kind === 'text' ? pages[index].text : '',
        );
      }
    }
    assert.equal(clients[0].store.canReveal, false);
    assert.match(clients[0].host.textContent, /所有故事已播放完畢/);
    const reconnected = client(engine, players[1]);
    try {
      assert.equal(reconnected.store.state.review.index, pages.length - 1);
    } finally {
      reconnected.dispose();
    }
    const invalid = engine.view(players[0].id);
    invalid.review.total++;
    assert.throws(() => clients[0].reader(invalid));
  } finally {
    clients.forEach((current) => current.dispose());
  }
});
