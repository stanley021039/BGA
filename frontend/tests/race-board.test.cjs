const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('../../tests/helpers/browser-modules.cjs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { window } = parseHTML('<html><body></body></html>');
// Linkedom exposes the select getter but omits the native value setter.
const selectValue = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value');
Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
  ...selectValue,
  set(value) {
    for (const option of this.options) option.selected = option.value === String(value);
  },
});
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue');
const ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');
function evaluate(source, resolve) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    withEngineImports({
      module,
      exports: module.exports,
      require: resolve,
      Map,
      Set,
      window,
      document,
    }),
  );
  return module.exports;
}
function harness({ scene } = {}) {
  const meta = evaluate(
    fs.readFileSync(path.join(__dirname, '../src/pages/race/race-meta.ts'), 'utf8'),
  );
  const compiled = compileScript(
    parse(fs.readFileSync(path.join(__dirname, '../src/pages/race/RaceBoard.vue'), 'utf8'))
      .descriptor,
    { id: 'race-board', inlineTemplate: true },
  ).content;
  const boardComponent = evaluate(compiled, (id) =>
    id === 'vue' ? vue : id === './race-meta' ? meta : { default: { render: () => vue.h('g') } },
  ).default;
  let component = boardComponent;
  const cars = [
    { id: 'own', owner: 'p1', x: 2, y: 3, size: 0, damage: [], dead: false },
    { id: 'other', owner: 'p2', x: 2, y: 4, size: 1, damage: [], dead: false },
  ];
  const route = { x: 2, y: 4, cost: 1, path: [{ x: 2, y: 4 }] };
  const props = vue.reactive({
    state: {
      code: 'AAAAAA',
      version: 1,
      round: 1,
      phase: 'move',
      me: 'p1',
      actor: 'p1',
      cars,
      players: [
        { id: 'p1', name: '自己', color: '#fff', dice: [{ value: 3, used: false }] },
        { id: 'p2', name: '對手', color: '#000', dice: [] },
      ],
      legalMoves: [{ x: 2, y: 4 }],
      active: { car: 'own', remaining: 3 },
      targets: [],
      available: ['own'],
      finishAt: null,
      winner: null,
      log: [],
      events: [],
      motions: [],
    },
    visual: {
      min: 0,
      tiles: [
        {
          start: 0,
          cells: Array.from({ length: 6 }, () => Array.from({ length: 8 }, () => ({ kind: 'O' }))),
        },
      ],
      cars,
      players: [],
    },
    enabled: true,
    routes: new Map([['2:4', route]]),
    preview: route,
  });
  const events = [];
  props.state.tiles = props.visual.tiles;
  const model = vue.reactive({
    state: props.state,
    canAct: true,
    connected: true,
    lesson: scene === 'RaceLessonScene',
    notice: '',
    busy: false,
    failed: false,
    now: 10000,
    offset: 0,
  });
  if (scene) {
    window.RacePaths = require('../src/engines/race-paths.js').default;
    const selection = evaluate(
      fs.readFileSync(path.join(__dirname, '../src/pages/race/useRaceSelection.ts'), 'utf8'),
      (id) => (id === 'vue' ? vue : meta),
    );
    const source = compileScript(
      parse(fs.readFileSync(path.join(__dirname, `../src/pages/race/${scene}.vue`), 'utf8'))
        .descriptor,
      { id: scene, inlineTemplate: true },
    ).content;
    component = evaluate(source, (id) =>
      id === 'vue'
        ? vue
        : id.endsWith('race-meta')
          ? meta
          : id.endsWith('useRaceSelection')
            ? selection
            : id.endsWith('useRacePresentation')
              ? {
                  useRacePresentation: () => ({
                    visual: vue.computed(() => ({
                      min: 0,
                      tiles: model.state.tiles,
                      cars: model.state.cars,
                      players: model.state.players,
                    })),
                    locked: vue.ref(false),
                    cue: vue.ref([]),
                    focus: vue.ref(false),
                    earned: vue.ref([]),
                    ready: true,
                    run: async () => true,
                  }),
                }
              : id.endsWith('RaceBoard.vue')
                ? { default: boardComponent }
                : { default: { render: () => null } },
    ).default;
  }
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp({
    render: () =>
      vue.h(
        component,
        scene
          ? { model }
          : {
              ...props,
              onPoint: (p) => events.push(['point', p]),
              onPreview: (p) => events.push(['preview', p]),
            },
      ),
  });
  app.mount(host);
  return {
    props,
    model,
    host,
    events,
    dispose() {
      app.unmount();
      host.remove();
    },
  };
}
for (const scene of ['RaceScene', 'RaceLessonScene'])
  test(`${scene} keeps a held route preview through equivalent presence snapshots`, async () => {
    const h = harness({ scene });
    try {
      const cell = h.host.querySelector('[data-x="2"][data-y="4"]');
      cell.dispatchEvent(new window.Event('pointerenter'));
      await vue.nextTick();
      assert.equal(!!h.host.querySelector('.race-route-line'), true);
      h.model.state = { ...h.model.state, serverNow: 11000 };
      await vue.nextTick();
      assert.equal(
        !!h.host.querySelector('.race-route-line'),
        true,
        'presence poll must not remove the guide under a stationary pointer',
      );
      h.model.state = { ...h.model.state, version: 2 };
      await vue.nextTick();
      assert.equal(
        !!h.host.querySelector('.race-route-line'),
        false,
        'a real board update still clears the old route',
      );
    } finally {
      h.dispose();
    }
  });
test('route guidance has no native hover title while preserving terrain help, focus and activation', async () => {
  const h = harness();
  try {
    const cell = h.host.querySelector('[data-x="2"][data-y="4"]');
    assert.equal(!!cell.querySelector('title'), false);
    assert.equal(!!h.host.querySelector('[data-car="other"] title'), false);
    assert.match(cell.getAttribute('aria-label'), /荒地.*進入花 1 點/);
    assert.ok(h.host.querySelector('[data-x="0"][data-y="0"] title'));
    cell.dispatchEvent(new window.Event('pointerenter'));
    const key = new window.Event('keydown', { cancelable: true });
    key.key = ' ';
    cell.dispatchEvent(key);
    assert.equal(key.defaultPrevented, true);
    assert.deepEqual(JSON.parse(JSON.stringify(h.events)), [
      ['preview', { x: 2, y: 4 }],
      ['point', { x: 2, y: 4 }],
    ]);
    assert.ok(h.host.querySelector('.race-route-line'));
    h.props.routes = new Map();
    h.props.preview = null;
    await vue.nextTick();
    assert.ok(cell.querySelector('title'));
    assert.ok(h.host.querySelector('[data-car="other"] title'));
  } finally {
    h.dispose();
  }
});
test('every direction face follows actual rendered hex positions for both lane parities', () => {
  const directions = require('../src/engines/race-directions.js').default;
  const { neighbor } = require('../../src/games/thunder');
  const h = harness();
  try {
    const point = (x, y) =>
      h.host
        .querySelector(`[data-x="${x}"][data-y="${y}"]`)
        .getAttribute('transform')
        .match(/-?\d+(?:\.\d+)?/g)
        .map(Number);
    for (const x of [2, 3])
      for (let i = 0; i < 6; i++) {
        const from = point(x, 3),
          target = neighbor(x, 3, i),
          to = point(target.x, target.y),
          face = directions.byIndex(i);
        assert.deepEqual([face.dx, face.dy], [to[0] - from[0], to[1] - from[1]]);
      }
  } finally {
    h.dispose();
  }
});
