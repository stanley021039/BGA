const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  test = require('node:test'),
  assert = require('node:assert/strict');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const k of ['window', 'document', 'Document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[k] = k === 'window' ? window : window[k];
const vue = require('vue'),
  ts = require('typescript'),
  { parse, compileScript } = require('vue/compiler-sfc');
const { DecryptoRoom } = require('../../src/games/decrypto');
const { randomUUID } = require('node:crypto');
function load(file, overrides = {}, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
  const raw = fs.readFileSync(file, 'utf8'),
    source = file.endsWith('.vue')
      ? compileScript(parse(raw, { filename: file }).descriptor, { id: file, inlineTemplate: true })
          .content
      : raw;
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module: m,
      exports: m.exports,
      setTimeout,
      clearTimeout,
      Intl,
      require: (id) =>
        id in overrides
          ? overrides[id]
          : id === 'vue'
            ? vue
            : id.endsWith('.scss')
              ? {}
              : id.endsWith('/engines/ui-widgets.js')
                ? { default: { icon: () => '' } }
                : load(
                    path.resolve(path.dirname(file), id + (path.extname(id) ? '' : '.ts')),
                    overrides,
                    cache,
                  ),
    },
  );
  return m.exports;
}
const { readDecryptoSnapshot } = load(path.resolve(__dirname, '../src/contracts/decrypto.ts'));
function make() {
  const e = new DecryptoRoom('ABC123', 'test', (n) => 0);
  for (let i = 0; i < 4; i++) e.add('玩家' + i);
  return e;
}
const input = (r) => ({ roundId: r.roundId, turn: r.turn, requestId: randomUUID() });
test('shipped parser accepts actual waiting, private clues, guessing, reveal and finished/tiebreak projections', () => {
  for (const count of [4, 5, 6, 7, 8]) {
    const r = new DecryptoRoom('ABC123', 'test', (n) => 0);
    for (let i = 0; i < count; i++) r.add('P' + i);
    const read = () => {
      for (const p of r.players) readDecryptoSnapshot({ ...r.view(p.id), serverNow: 1000 });
    };
    read();
    r.start();
    read();
    for (let i = 0; i < 8; i++) {
      for (let t = 0; t < 2; t++) {
        r.act(r.encryptors[t], 'clues', {
          ...input(r),
          clues: [0, 1, 2].map((j) => `R${i}T${t}C${j}`),
        });
        read();
      }
      for (let t = 0; t < 2; t++) {
        if (r.round > 1) r.act(r.decoders[1 - t], 'intercept', { ...input(r), digits: [2, 1, 3] });
        r.act(r.decoders[t], 'decode', { ...input(r), digits: [1, 2, 3] });
        read();
        r.act(r.host, 'next', input(r));
        read();
      }
    }
    assert.equal(r.phase, 'tiebreak');
    for (let t = 0; t < 2; t++)
      r.act(r.decoders[t], 'keywords', { ...input(r), words: ['', '', '', ''] });
    read();
  }
  const r = make(),
    v = () => ({ ...r.view(r.host), serverNow: 1000 });
  for (const mutate of [
    (v) => (v.myTeam = '0'),
    (v) => (v.turn = null),
    (v) => (v.keywords = [['one'], []]),
    (v) => (v.guessReady.decode = 'yes'),
    (v) => (v.secretCode = [1, 1, 2]),
    (v) => (v.teams[0].interceptions = -1),
  ]) {
    const bad = v();
    mutate(bad);
    assert.throws(() => readDecryptoSnapshot(bad));
  }
});

test('Decrypto cues follow live confirmed actions without replay on reconnect or polling', () => {
  const engine = make();
  engine.start();
  const room = vue.reactive({ connected: true, scope: 1, lastReceivedAt: 1000 });
  const snapshot = vue.shallowRef(engine.view(engine.host));
  const publish = () => {
    snapshot.value = engine.view(engine.host);
  };
  const cues = [];
  let listening = false;
  let disposed = false;
  const { useDecryptoSounds } = load(
    path.resolve(__dirname, '../src/pages/decrypto/decrypto-sounds.ts'),
    {
      '../../engines/game-sounds.js': {
        __esModule: true,
        default: {
          create: () => ({
            update() {
              const live = listening;
              listening = true;
              return live;
            },
            play: (cue) => cues.push(cue),
            disconnect: () => (listening = false),
            stop() {},
            destroy: () => (disposed = true),
          }),
        },
      },
    },
  );
  const scope = vue.effectScope();
  try {
    scope.run(() =>
      useDecryptoSounds(
        room,
        vue.computed(() => snapshot.value),
      ),
    );
    assert.deepEqual(cues, []);
    room.lastReceivedAt += 10000;
    assert.deepEqual(cues, []);
    engine.act(engine.encryptors[1], 'clues', {
      ...input(engine),
      clues: ['對手甲', '對手乙', '對手丙'],
    });
    publish();
    assert.deepEqual(cues, []);
    engine.act(engine.host, 'clues', { ...input(engine), clues: ['本隊甲', '本隊乙', '本隊丙'] });
    publish();
    publish();
    assert.deepEqual(cues, ['quacks-buy']);
    engine.act(engine.decoders[0], 'decode', { ...input(engine), digits: engine.codes[0] });
    publish();
    publish();
    assert.deepEqual(cues, ['quacks-buy', 'quacks-ruby']);
    room.connected = false;
    room.connected = true;
    engine.act(engine.host, 'next', input(engine));
    engine.act(engine.decoders[1], 'decode', { ...input(engine), digits: engine.codes[1] });
    publish();
    assert.deepEqual(cues, ['quacks-buy', 'quacks-ruby']);
  } finally {
    scope.stop();
  }
  assert.equal(disposed, true);
});
function mount(engine, id) {
  const room = vue.reactive({ scope: 1, busy: false, connected: true, host: id === engine.host }),
    calls = [];
  room.gameManager = id === engine.host;
  room.command = async (...args) => {
    calls.push(['room', ...args]);
    return true;
  };
  const game = vue.reactive({
    state: engine.view(id),
    act: async (...args) => {
      calls.push(args);
      return false;
    },
  });
  const page = load(path.resolve(__dirname, '../src/pages/decrypto/DecryptoScene.vue'), {
    '../../stores/room': { useRoomStore: () => room },
    '../../stores/decrypto': { useDecryptoStore: () => game },
  }).default;
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp(page);
  app.mount(host);
  return {
    room,
    game,
    calls,
    host,
    close: () => {
      app.unmount();
      host.remove();
    },
  };
}
test('actual Vue clue form keeps input and failure/offline drafts; new round clears private draft', async () => {
  const e = make();
  e.start();
  const f = mount(e, e.host);
  try {
    const fields = [...f.host.querySelectorAll('input')];
    assert.equal(fields.length, 3);
    assert.match(f.host.textContent, /只有你看得到的密碼/);
    for (const [i, el] of fields.entries()) {
      el.value = ['旅遊收納', '夏日鳴叫', '童話人物'][i];
      el.dispatchEvent(new window.Event('input', { bubbles: true }));
    }
    await vue.nextTick();
    f.host
      .querySelector('form')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await vue.nextTick();
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0])), [
      'clues',
      { clues: ['旅遊收納', '夏日鳴叫', '童話人物'] },
    ]);
    f.room.connected = false;
    await vue.nextTick();
    assert.ok(f.host.querySelector('input').hasAttribute('disabled'));
    assert.equal(f.host.querySelector('input').value, '旅遊收納');
    f.room.connected = true;
    await vue.nextTick();
    assert.equal(f.host.querySelector('input').value, '旅遊收納');
    f.game.state = { ...f.game.state, roundId: randomUUID() };
    await vue.nextTick();
    assert.equal(f.host.querySelector('input').value, '');
  } finally {
    f.close();
  }
});
test('actual Vue guessing form never renders encryptor code and sends digits separately from room code', async () => {
  const e = make();
  e.start();
  for (let t = 0; t < 2; t++)
    e.act(e.encryptors[t], 'clues', { ...input(e), clues: ['甲' + t, '乙' + t, '丙' + t] });
  const f = mount(e, e.decoders[0]);
  try {
    assert.ok(!f.host.textContent.includes('只有你看得到的密碼'));
    const selects = f.host.querySelectorAll('select');
    const submit = () =>
      f.host
        .querySelector('form')
        .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    const choose = (index, value) => {
      const select = selects[index];
      Array.from(select.options).find((option) => option.value === value).selected = true;
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
    };
    assert.equal(selects.length, 3);
    assert.ok(f.host.querySelector('button[type=submit]').hasAttribute('disabled'));
    submit();
    assert.deepEqual(f.calls, []);
    choose(0, '1');
    choose(1, '1');
    choose(2, '3');
    await vue.nextTick();
    assert.match(f.host.textContent, /三個數字不能重複/);
    assert.ok(f.host.querySelector('button[type=submit]').hasAttribute('disabled'));
    submit();
    assert.deepEqual(f.calls, []);
    choose(1, '2');
    await vue.nextTick();
    assert.ok(!f.host.querySelector('button[type=submit]').hasAttribute('disabled'));
    submit();
    await vue.nextTick();
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [['decode', { digits: [1, 2, 3] }]]);
  } finally {
    f.close();
  }
  const other = mount(e, e.encryptors[0]);
  assert.equal(other.host.querySelectorAll('select').length, 0);
  other.close();
});

test('word cards, phase steps and keyboard-readable team notes keep unrevealed clues private', async () => {
  const e = make();
  e.start();
  for (let t = 0; t < 2; t++)
    e.act(e.encryptors[t], 'clues', {
      ...input(e),
      clues: ['公開甲' + t, '公開乙' + t, '公開丙' + t],
    });
  e.act(e.decoders[0], 'decode', { ...input(e), digits: [1, 2, 3] });
  const f = mount(e, e.host);
  try {
    assert.equal(f.host.querySelectorAll('.decrypto-word-card').length, 4);
    assert.equal(f.host.querySelectorAll('.decrypto-flow li').length, 4);
    assert.equal(f.host.querySelectorAll('[aria-current="step"]').length, 1);
    assert.match(f.host.querySelector('[role="tabpanel"]').textContent, /還沒有公開線索/);
    const tabs = f.host.querySelectorAll('[role="tab"]');
    assert.equal(tabs.length, 2);
    tabs[0].click();
    await vue.nextTick();
    const panel = f.host.querySelector('[role="tabpanel"]');
    assert.match(panel.textContent, /公開甲0/);
    assert.doesNotMatch(panel.textContent, /公開甲1/);
    assert.equal(panel.getAttribute('aria-labelledby'), tabs[0].id);
    tabs[1].click();
    await vue.nextTick();
    assert.match(f.host.querySelector('[role="tabpanel"]').textContent, /還沒有公開線索/);
  } finally {
    f.close();
  }
});

test('finished result offers the authorized replay path directly and disables it offline', async () => {
  const e = make();
  e.start();
  e.end([0], '截碼／失誤');
  const f = mount(e, e.host);
  try {
    const button = [...f.host.querySelectorAll('button')].find((b) =>
      b.textContent.includes('返回等待室'),
    );
    assert.ok(button);
    button.click();
    await vue.nextTick();
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0])), ['room', 'rematch', {}]);
    f.room.connected = false;
    await vue.nextTick();
    assert.ok(button.hasAttribute('disabled'));
  } finally {
    f.close();
  }
});
