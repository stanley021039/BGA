const fs = require('fs'),
  vm = require('vm'),
  path = require('path'),
  test = require('node:test'),
  assert = require('assert/strict');
const { parseHTML } = require('linkedom');
const { window } = parseHTML('<html><body></body></html>');
for (const k of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[k] = k === 'window' ? window : window[k];
const vue = require('vue'),
  ts = require('typescript'),
  { parse, compileScript } = require('vue/compiler-sfc');
const { CeoRoom } = require('../../src/games/ceo-room');
function fixture() {
  const engine = new CeoRoom('ABC123', 'UI', () => 0);
  const ps = Array.from({ length: 3 }, (_, i) => engine.add('player' + i));
  engine.start();
  const state = engine.view(ps[0].id);
  const calls = [];
  const ceo = vue.reactive({
    state,
    game: state.game,
    me: state.game.players[0],
    canAct: true,
    act: (...args) => calls.push(args),
  });
  const actions = vue.reactive({ notice: '', pending: false, canRetry: false });
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} };
    cache.set(file, m);
    const raw = fs.readFileSync(file, 'utf8'),
      source = file.endsWith('.vue')
        ? compileScript(parse(raw).descriptor, { id: file, inlineTemplate: true }).content
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
          // Icon registry lifecycle is covered by shared-component tests.
          id.endsWith('/engines/ui-widgets.js')
            ? { default: { icon: () => '' } }
            : id === 'vue'
              ? vue
              : id.includes('stores/ceo')
                ? { useCeoStore: () => ceo }
                : id.includes('stores/party-actions')
                  ? { usePartyActionsStore: () => actions }
                  : id.endsWith('.scss')
                    ? {}
                    : load(path.resolve(path.dirname(file), id + (path.extname(id) ? '' : '.ts'))),
      },
    );
    return m.exports;
  }
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp(load(path.resolve(__dirname, '../src/pages/ceo/CeoScene.vue')).default);
  app.mount(host);
  return { host, app, ceo, calls, engine, ps };
}
test('CEO scene buys stock with issuer group id and preserves final-round and turn guards', async () => {
  const f = fixture();
  try {
    const button = () =>
      [...f.host.querySelectorAll('button')].find((b) => b.textContent.includes('買入'));
    assert(button());
    button().click();
    assert.equal(f.calls[0][0], 'buyStock');
    const other = f.ceo.game.groups.find((g) => g.playerId && g.playerId !== f.ceo.state.me);
    assert.equal(f.calls[0][1].issuerId, other.id);
    f.ceo.game.countdown = 1;
    await vue.nextTick();
    assert(button().disabled);
    f.ceo.game.countdown = null;
    f.ceo.canAct = false;
    await vue.nextTick();
    assert(button().disabled);
  } finally {
    f.app.unmount();
    f.host.remove();
  }
});
test('CEO scene keeps a restart mount target on interrupted game and displays no private game', async () => {
  const f = fixture();
  try {
    f.ceo.game = null;
    f.ceo.state.phase = 'finished';
    f.ceo.state.interrupted = true;
    await vue.nextTick();
    assert(f.host.querySelector('#ceo-restart-settings'));
    assert(f.host.textContent.includes('本局中止'));
    assert(!f.host.textContent.includes('公司市場'));
    f.ceo.state.restoreFailed = true;
    await vue.nextTick();
    assert.match(f.host.textContent, /伺服器重啟後無法安全還原/);
    assert.doesNotMatch(f.host.textContent, /有人離席/);
  } finally {
    f.app.unmount();
    f.host.remove();
  }
});

test('a legally finished CEO match exposes all individual and group score details with the provisional-deck warning', async () => {
  const f = fixture();
  try {
    for (let step = 0; step < 500 && f.engine.phase === 'playing'; step++) {
      const view = f.engine.view(f.ps[0].id),
        game = view.game;
      const actor = game.players.find((p) => p.id === game.turnId);
      const slot = game.market.find((s) => s.card.assets + s.extraCost <= actor.cash);
      f.engine.act(game.turnId, slot ? 'acquire' : 'dividend', {
        roundId: view.roundId,
        requestId: 'ui335-finish-' + step,
        expectedRevision: game.revision,
        ...(slot ? { companyId: slot.card.id } : {}),
      });
    }
    assert.equal(f.engine.phase, 'finished');
    const view = f.engine.view(f.ps[0].id);
    f.ceo.state = view;
    f.ceo.game = view.game;
    f.ceo.canAct = false;
    await vue.nextTick();
    assert.match(f.host.textContent, /個人結算/);
    assert.match(f.host.textContent, /集團結算/);
    assert.match(f.host.textContent, /非原版/);
    assert.equal(f.host.querySelectorAll('.ui-statistic').length, view.game.results.players.length);
    assert(!f.host.textContent.includes('公司市場'));
    for (const result of view.game.results.players) {
      assert(f.host.textContent.includes(String(result.total)));
      for (const stock of result.stock) assert(f.host.textContent.includes(`${stock.count} 股 ×`));
      for (const company of result.companies)
        assert(f.host.textContent.includes(`：${company.score} 分`));
    }
    assert(f.host.querySelector('#ceo-restart-settings'));
  } finally {
    f.app.unmount();
    f.host.remove();
  }
});
