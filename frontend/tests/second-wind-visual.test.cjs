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

function fixture(component = 'AthleteScene.vue') {
  const calls = [];
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
        require: (id) =>
          id === 'vue'
            ? vue
            : id.includes('stores/second-wind')
              ? { useAthleteStore: () => athlete }
              : id.includes('stores/party-actions')
                ? { usePartyActionsStore: () => ({ notice: '', canRetry: false }) }
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
                          path.resolve(path.dirname(file), id + (path.extname(id) ? '' : '.ts')),
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
    assert.equal(card.parentElement.getAttribute('aria-label'), 'Understudy');
    assert.equal(card.textContent.trim(), '');
    assert.equal(card.getAttribute('data-image-only'), 'true');
    assert.equal(f.host.querySelector('.ui-hover-info-help'), null);
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

test('scoreboard collapses all player content while keeping the heading and log identity', async () => {
  const f = fixture();
  try {
    f.game.events = [{ id: 1, type: 'die', text: 'Stunner 擲出 6', playerId: 'b' }];
    await vue.nextTick();
    assert.match(f.host.textContent, /b（ID：b）｜Stunner 擲出 6/);
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
    assert.equal(f.host.querySelectorAll('.athlete-track-pieces img').length, 2);
    assert.equal(f.host.querySelectorAll('.athlete-piece.ui-hover-info').length, 2);
    assert.equal(f.host.querySelector('.athlete-piece').getAttribute('tabindex'), '0');
    assert.equal(f.host.querySelector('.athlete-track-cell .ui-hover-info-help'), null);
    assert.equal(f.host.querySelector('.athlete-track-number'), null);
    assert.equal(f.host.querySelector('.athlete-piece .ui-badge'), null);
    assert.equal(f.host.querySelectorAll('.athlete-racer-row').length, 4);
    assert.ok(f.host.querySelector('.athlete-tripped'));
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
