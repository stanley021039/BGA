const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const k of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[k] = k === 'window' ? window : window[k];
const vue = require('vue'),
  ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');
const { racers } = require('../../src/games/second-wind/catalog');

function fixture(component = 'AthleteScene.vue', initialGame = {}) {
  const calls = [];
  const actions = vue.reactive({
    notice: '',
    pending: false,
    canRetry: false,
    retrySame: () => calls.push(['retrySame']),
  });
  // The scene owns when to open; native dialog focus/top-layer behavior is
  // verified in Edge rather than emulated by linkedom.
  const dialogState = { opens: 0, close: () => {} };
  const DialogStub = vue.defineComponent({
    setup(_props, { slots, expose, attrs }) {
      const visible = vue.ref(false);
      const close = () => {
        visible.value = false;
      };
      dialogState.close = close;
      expose({
        open: () => {
          dialogState.opens++;
          visible.value = true;
        },
        close,
      });
      return () =>
        vue.h(
          'div',
          { 'data-twist-dialog': '', 'data-title': attrs.title },
          visible.value ? slots.default?.() : [],
        );
    },
  });
  const game = vue.reactive({
    phase: 'drafting',
    players: ['a', 'b', 'c'],
    teams: { a: ['penguin'], b: [], c: [] },
    scores: {},
    catalog: racers,
    ownSelection: null,
    selectedIds: [],
    market: ['understudy', 'kingtripper'],
    turnId: 'a',
    draftRound: 1,
    events: [],
    results: [],
    ...initialGame,
  });
  const athlete = {
    game,
    state: { me: 'a', players: ['a', 'b', 'c'].map((id) => ({ id, name: id })) },
    ready: true,
    act: (...args) => calls.push(args),
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} };
    cache.set(file, m);
    const raw = fs.readFileSync(file, 'utf8');
    const source = file.endsWith('.vue')
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
        window,
        document,
        HTMLElement: window.HTMLElement,
        require: (id) =>
          // Keep scene actions real without starting the unrelated icon observer.
          id.endsWith('/UiDialog.vue')
            ? { default: DialogStub }
            : id.endsWith('/engines/ui-widgets.js')
              ? { default: { icon: () => '' } }
              : id === 'vue'
                ? vue
                : id.includes('stores/second-wind')
                  ? { useAthleteStore: () => athlete }
                  : id.includes('stores/party-actions')
                    ? { usePartyActionsStore: () => actions }
                    : id.includes('stores/room')
                      ? { useRoomStore: () => ({ host: false }) }
                      : id === './art'
                        ? {
                            athleteArt: (id, kind = 'portrait') => `/art/${id}-${kind}.webp`,
                            trackArt: () => '/track.webp',
                            trackPoint: (p) => ({ left: `${p}%`, top: '17%' }),
                          }
                        : id.endsWith('.scss')
                          ? {}
                          : load(
                              path.resolve(
                                path.dirname(file),
                                id + (path.extname(id) ? '' : '.ts'),
                              ),
                            ),
      },
    );
    return m.exports;
  }
  const host = document.createElement('div');
  document.body.append(host);
  const props = vue.reactive({ src: '/first.webp', alt: '角色圖', width: 96, height: 70 });
  const Child = load(path.resolve(__dirname, '../src/pages/second-wind/' + component)).default;
  const app = vue.createApp({
    render: () => vue.h(Child, component === 'AthleteArt.vue' ? props : {}),
  });
  app.mount(host);
  return {
    host,
    game,
    calls,
    actions,
    dialogState,
    props,
    dispose: () => {
      app.unmount();
      host.remove();
    },
  };
}

test('illustrated draft retains its guarded action and own secret choice stays locked', async () => {
  const f = fixture();
  try {
    const card = f.host.querySelector('button[aria-label="Understudy"]');
    assert.ok(card.querySelector('img').src.endsWith('/understudy-card.webp'));
    assert.equal(card.closest('.athlete-offer').querySelector('h3').textContent, 'Understudy');
    assert.match(
      card.closest('.athlete-offer').querySelector('details').textContent,
      /完整能力說明/,
    );
    assert.equal(card.textContent.trim(), '');
    assert.equal(card.getAttribute('data-image-only'), 'true');
    assert.equal(card.parentElement.querySelector('.ui-hover-info-help'), null);
    card.click();
    assert.equal(f.calls[0][0], 'draft');
    assert.equal(f.calls[0][1].racerId, 'understudy');
    f.game.phase = 'choosing';
    f.game.ownSelection = 'penguin';
    f.game.selectedIds = ['a'];
    await vue.nextTick();
    assert.equal(f.host.querySelector('button[aria-label="Penguin"]').disabled, true);
    assert.equal(
      f.host.querySelector('button[aria-label="Penguin"]').getAttribute('data-readable-disabled'),
      'true',
    );
    assert.equal(
      f.host.querySelector('button[aria-label="Penguin"]').getAttribute('aria-pressed'),
      'true',
    );
    assert.equal(f.host.querySelector('button[aria-label="Understudy"]'), null);
    assert.doesNotMatch(f.host.textContent, /undefined/);
    assert.doesNotMatch(f.host.textContent, /\n\s*>\s*\n/);
  } finally {
    f.dispose();
  }
});

function dialogHarness(f) {
  const dialog = f.host.querySelector('[data-twist-dialog]');
  dialog.close = () => f.dialogState.close();
  return { dialog, opens: () => f.dialogState.opens };
}
test('Twist opens on the first observed trigger only, lists all cards and can be reopened by its button', async () => {
  const f = fixture('AthleteScene.vue', {
    phase: 'racing',
    race: 1,
    twistCards: [],
    racers: [
      {
        id: 'r',
        racerId: 'penguin',
        playerId: 'a',
        position: 1,
        copiedPowers: [],
        tripped: false,
        transformed: false,
        finished: false,
        eliminated: false,
      },
    ],
  });
  try {
    const { dialog, opens } = dialogHarness(f);
    const button = () =>
      f.host.querySelector(
        'button[aria-label="尚未觸發twist"], button[aria-label="查看已觸發twist"]',
      );
    assert.equal(button().getAttribute('aria-label'), '尚未觸發twist');
    button().dispatchEvent(new window.Event('pointerenter'));
    await vue.nextTick();
    assert.equal(opens(), 0);
    button().click();
    await vue.nextTick();
    assert.equal(opens(), 1);
    assert.match(dialog.textContent, /尚未觸發 Twist/);
    dialog.close();
    f.game.twistCards = [{ id: 'fans-demand-chaos', summary: '依序抽取兩張' }];
    await vue.nextTick();
    await vue.nextTick();
    assert.equal(opens(), 2);
    assert.equal(button().getAttribute('aria-label'), '查看已觸發twist');
    f.game.twistCards.push(
      { id: 'conveyor', summary: '主移動加三' },
      { id: 'pinata', summary: '放置金幣' },
    );
    await vue.nextTick();
    assert.equal(opens(), 2);
    assert.equal(dialog.querySelectorAll('.athlete-twists img').length, 3);
    dialog.close();
    f.game.twistCards = [...f.game.twistCards];
    await vue.nextTick();
    assert.equal(opens(), 2);
    button().click();
    await vue.nextTick();
    assert.equal(opens(), 3);
    dialog.close();
    // Secret selection retains the old race's twist history until lineup.
    f.game.race = 2;
    f.game.phase = 'choosing';
    await vue.nextTick();
    assert.equal(f.host.querySelector('.athlete-track'), null);
    assert(!f.host.querySelector('.athlete-player-group').textContent.includes('出賽：'));
    f.game.phase = 'racing';
    f.game.twistCards = [];
    await vue.nextTick();
    f.game.twistCards = [{ id: 'pinata', summary: '放置金幣' }];
    await vue.nextTick();
    assert.equal(opens(), 4);
    dialog.close();
    // Fast remote play can skip both secret selection and the empty lineup.
    f.game.race = 3;
    f.game.twistCards = [{ id: 'conveyor', summary: '主移動加三' }];
    await vue.nextTick();
    assert.equal(opens(), 5);
    assert.equal(f.calls.length, 0);
  } finally {
    f.dispose();
  }
});
test('Whirly World never triggers a Twist, so its button and dialog explain only the vortexes', async () => {
  const f = fixture('AthleteScene.vue', {
    phase: 'racing',
    race: 2,
    trackId: 'whirly-world',
    twistCards: [],
    racers: [
      {
        id: 'r',
        racerId: 'penguin',
        playerId: 'a',
        position: 1,
        copiedPowers: [],
        tripped: false,
        transformed: false,
        finished: false,
        eliminated: false,
      },
    ],
  });
  try {
    const { dialog, opens } = dialogHarness(f);
    const button = f.host.querySelector('button[aria-label="查看漩渦規則"]');
    assert.ok(button, 'vortex rules button');
    assert.equal(f.host.querySelector('button[aria-label*="twist"]'), null);
    button.click();
    await vue.nextTick();
    assert.equal(opens(), 1);
    assert.equal(dialog.getAttribute('data-title'), '漩渦規則');
    assert.match(dialog.textContent, /漩渦配對/);
    assert.doesNotMatch(dialog.textContent, /Twist/);
    assert.equal(f.calls.length, 0);
  } finally {
    f.dispose();
  }
});
test('loading an already-triggered race does not automatically reopen Twist', async () => {
  const f = fixture('AthleteScene.vue', {
    phase: 'racing',
    race: 1,
    twistCards: [{ id: 'pinata', summary: '金幣' }],
  });
  try {
    const { opens } = dialogHarness(f);
    await vue.nextTick();
    assert.equal(opens(), 0);
    f.game.twistCards = [...f.game.twistCards];
    await vue.nextTick();
    assert.equal(opens(), 0);
  } finally {
    f.dispose();
  }
});

test('scoreboard collapses all player content and event text has no repeated identity prefix', async () => {
  const f = fixture();
  try {
    f.game.events = [{ id: 1, type: 'die', text: 'Stunner 擲出 6', playerId: 'b' }];
    await vue.nextTick();
    assert.equal(f.host.querySelector('.athlete-events').textContent.trim(), 'Stunner 擲出 6');
    assert.doesNotMatch(f.host.querySelector('.athlete-events').textContent, /ID：|｜/);
    const toggle = f.host.querySelector('button[aria-label="收合積分與隊伍"]');
    toggle.click();
    await vue.nextTick();
    assert.equal(f.host.querySelector('.athlete-team').style.display, 'none');
    assert.equal(f.host.querySelector('.athlete-scores').style.display, 'none');
    assert.equal(
      f.host.querySelector('button[aria-label="展開積分與隊伍"]').getAttribute('aria-expanded'),
      'false',
    );
  } finally {
    f.dispose();
  }
});

test('crowded track bounds portraits while the complete racer list remains readable', async () => {
  const f = fixture();
  try {
    f.game.phase = 'racing';
    f.game.trackId = 'whirly-world';
    f.game.direction = -1;
    f.game.racers = Array.from({ length: 4 }, (_, i) => ({
      id: 'r' + i,
      racerId: racers[i].id,
      playerId: ['a', 'b', 'c'][i % 3],
      position: 0,
      copiedPowers: [],
      tripped: i === 0,
      transformed: false,
      eliminated: false,
      finished: false,
    }));
    await vue.nextTick();
    assert.equal(f.host.querySelectorAll('.athlete-track-pieces img').length, 0);
    assert.equal(f.host.querySelectorAll('.athlete-stack-trigger').length, 1);
    assert.equal(
      f.host.querySelector('button[aria-label="查看同格 4 位角色"]').textContent.trim(),
      '4',
    );
    assert.equal(f.host.querySelector('.athlete-track-cell .ui-hover-info-help'), null);
    assert.equal(f.host.querySelector('.athlete-track-number'), null);
    assert.equal(f.host.querySelector('.athlete-piece .ui-badge'), null);
    assert.equal(f.host.querySelectorAll('.athlete-racer-row').length, 4);
    assert.equal(
      f.host.querySelector('.athlete-stack-trigger').getAttribute('aria-label'),
      '第0格（4位）',
    );
    f.game.racers.forEach((r) => {
      r.position = 5;
    });
    await vue.nextTick();
    assert.equal(
      f.host.querySelector('.athlete-stack-trigger').getAttribute('aria-label'),
      '第5格（4位）',
    );
    assert.equal(f.host.querySelector('.athlete-track-scroll').getAttribute('tabindex'), '0');
  } finally {
    f.dispose();
  }
});

test('image failure retains its size and readable fallback, then recovers on a new source', async () => {
  const f = fixture('AthleteArt.vue');
  try {
    const ratio = f.host.firstElementChild.style.aspectRatio;
    f.host.querySelector('img').dispatchEvent(new window.Event('error'));
    await vue.nextTick();
    assert.equal(f.host.querySelector('img'), null);
    assert.match(f.host.textContent, /圖片未載入/);
    assert.equal(f.host.firstElementChild.style.aspectRatio, ratio);
    f.props.src = '/second.webp';
    await vue.nextTick();
    await vue.nextTick();
    assert.ok(f.host.querySelector('img').src.endsWith('/second.webp'));
  } finally {
    f.dispose();
  }
});

test('score groups show names, points and original remaining racers; roll buttons belong only to the local seat', async () => {
  const f = fixture();
  try {
    const groups = [...f.host.querySelectorAll('.athlete-player-group')];
    assert.equal(groups.length, 3);
    assert.ok(groups.every((g) => g.querySelector('h3') && g.querySelector('.ui-statistic')));
    assert.match(groups[0].querySelector('.athlete-team').textContent, /Penguin/);
    assert.equal(groups[0].querySelector('h3').textContent, 'a');
    assert.match(groups[0].textContent, /備選跑者名冊/);
    assert.equal(groups[0].querySelector('.ui-statistic strong').textContent, '0');
    f.game.phase = 'draft-rolloff';
    f.game.rolls = { b: 3 };
    await vue.nextTick();
    assert.match(groups[1].textContent, /等待招募角色/);
    assert.doesNotMatch(groups[1].textContent, /全部角色已出賽/);
    const rollers = [...f.host.querySelectorAll('.athlete-roll-player')];
    assert.equal(rollers.length, 3);
    assert.equal(rollers[0].querySelector('button').getAttribute('aria-label'), '擲骰');
    assert.equal(rollers[1].querySelectorAll('button').length, 0);
    assert.equal(rollers[2].querySelectorAll('button').length, 0);
    rollers[0].querySelector('button').click();
    assert.equal(f.calls.at(-1)[0], 'roll');
    f.game.rolls.a = 4;
    await vue.nextTick();
    assert.equal(rollers[0].querySelector('button').disabled, true);
  } finally {
    f.dispose();
  }
});

test('header order follows the real draft and action seat, and racer details precede the board collapsed', async () => {
  const f = fixture();
  try {
    f.game.draftOrder = ['c', 'b', 'a', 'a', 'b', 'c'];
    f.game.turnId = 'b';
    await vue.nextTick();
    assert.equal(f.host.querySelector('.athlete-turn-order').textContent.trim(), 'c ↔ b ↔ a');
    assert.equal(f.host.querySelector('[aria-current="step"]').textContent, 'b');
    assert.doesNotMatch(f.host.textContent, /輪到.*招募/);
    f.game.phase = 'racing';
    f.game.first = 'c';
    f.game.trackId = 'twisty-twirl';
    f.game.racers = [
      {
        id: 'r',
        racerId: 'penguin',
        playerId: 'a',
        position: 2,
        copiedPowers: [],
        tripped: false,
        transformed: false,
        eliminated: false,
        finished: false,
      },
    ];
    await vue.nextTick();
    assert.equal(f.host.querySelector('.athlete-turn-order').textContent.trim(), 'c → a → b');
    assert.equal(f.host.querySelector('#athlete-racer-details').style.display, 'none');
    const headings = [...f.host.querySelectorAll('h2')].map((h) => h.textContent.trim());
    assert.deepEqual(headings.slice(0, 3), ['積分與隊伍', '本場角色與能力', '曲折賽道']);
    f.host.querySelector('button[aria-label="展開本場角色與能力"]').click();
    await vue.nextTick();
    assert.notEqual(f.host.querySelector('#athlete-racer-details').style.display, 'none');
    assert.doesNotMatch(f.host.textContent, /輪到.*行動|Twisty Twirl｜|待核對/);
    f.game.pending = { id: 'q', playerId: 'a', title: '選擇能力', options: [] };
    await vue.nextTick();
    assert.equal(f.host.querySelector('[aria-current="step"]').textContent, 'a');
  } finally {
    f.dispose();
  }
});

test('pending and uncertain action notices persist and render a real same-operation retry without dropping the board', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture('AthleteScene.vue', {
    phase: 'racing',
    race: 1,
    racers: [
      {
        id: 'r',
        racerId: 'penguin',
        playerId: 'a',
        position: 8,
        copiedPowers: [],
        tripped: false,
        eliminated: false,
        finished: false,
        transformed: false,
      },
    ],
  });
  try {
    f.actions.notice = '正在送出…';
    f.actions.pending = true;
    await vue.nextTick();
    t.mock.timers.tick(5000);
    await vue.nextTick();
    const notice = f.host.querySelector('[data-density="action"] .ui-notice');
    assert.equal(notice.hidden, false);
    assert.match(notice.textContent, /正在送出/);
    assert.match(f.host.querySelector('.athlete-position-list').textContent, /Penguin/);
    f.actions.pending = false;
    f.actions.canRetry = true;
    f.actions.notice = '操作結果尚未確認';
    await vue.nextTick();
    t.mock.timers.tick(5000);
    await vue.nextTick();
    const retry = notice.querySelector('button[aria-label="重試同一操作"]');
    assert(retry);
    assert.equal(notice.tagName, 'DIV');
    assert.equal(notice.hidden, false);
    retry.click();
    assert.deepEqual(f.calls.at(-1), ['retrySame']);
    assert.equal(f.game.racers[0].position, 8);
    f.actions.notice = '';
    f.actions.canRetry = false;
    await vue.nextTick();
    assert.equal(notice.hidden, true);
    assert.equal(notice.querySelector('button'), null);
  } finally {
    f.dispose();
  }
});
