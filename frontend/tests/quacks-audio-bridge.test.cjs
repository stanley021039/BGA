const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
('use strict');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('../../tests/helpers/browser-modules.cjs'),
  path = require('node:path'),
  vm = require('node:vm');
const vue = require('../node_modules/vue'),
  ts = require('../node_modules/typescript'),
  { parse, compileScript } = require('../node_modules/vue/compiler-sfc');
test('Vue quacks audio owner forwards fresh draw and stop events without replaying reload history', async () => {
  let clock = 100000;
  const calls = [],
    mounts = [],
    unmounts = [],
    timers = new Map();
  let timerId = 0;
  const document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const window = {
    MotionPolicy: undefined,
    GameUI: undefined,
    QuacksArt: undefined,
    document,
    addEventListener() {},
    removeEventListener() {},
    AudioSettings: {
      get: () => ({ effects: { enabled: true, volume: 0.25 } }),
      playEffect: (cue) => {
        calls.push(cue);
      },
      stopEffect() {},
    },
  };
  const sandbox = {
    window,
    Date: { now: () => clock },
    setTimeout(fn) {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  for (const file of ['public/shared/game-sounds.js', 'public/quacks-fx.js'])
    vm.runInNewContext(
      fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'),
      withEngineImports(sandbox),
    );
  const leaf = () => ({ update() {}, clear() {}, destroy() {}, show() {} });
  window.QuacksFx.create = leaf;
  window.QuacksFx.createExplosion = leaf;
  const room = vue.reactive({ connected: true, scope: 1 });
  const state = () => ({
    code: 'ABCDEF',
    roundId: 'round1',
    version: clock,
    phase: 'brewing',
    stage: 'drawing',
    mine: { drawEvents: [], stopEvents: [] },
    recipes: [],
    rollEvents: [],
  });
  const quacks = vue.reactive({ state: state(), selectedPot: 'me' });
  const filename = path.resolve(__dirname, '../src/pages/quacks/QuacksEffects.vue');
  const script = compileScript(parse(fs.readFileSync(filename, 'utf8')).descriptor, {
    id: 'audio-regression',
  }).content;
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(script, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    withEngineImports({
      module,
      exports: module.exports,
      window,
      document,
      require: (id) =>
        id === 'vue'
          ? {
              ...vue,
              onMounted: (fn) => mounts.push(fn),
              onBeforeUnmount: (fn) => unmounts.push(fn),
            }
          : id.includes('stores/room')
            ? { useRoomStore: () => room }
            : id.includes('stores/quacks')
              ? { useQuacksStore: () => quacks }
              : id === './quacks-motion'
                ? { createQuacksMotion: () => ({ ...leaf(), cancelVisuals() {}, burst() {} }) }
                : {},
    }),
  );
  const scope = vue.effectScope();
  let component;
  scope.run(() => {
    component = module.exports.default.setup({}, { expose() {} });
  });
  component.fxHost.value = {};
  component.burstHost.value = {};
  try {
    mounts.forEach((fn) => fn());
    clock += 1200;
    quacks.state = state();
    await vue.nextTick();
    clock += 100;
    const decision = { id: 'decision1', at: clock, decision: true };
    quacks.state = {
      ...state(),
      mine: { drawEvents: [], drawDecisionEvents: [decision], stopEvents: [] },
    };
    await vue.nextTick();
    assert.deepEqual(calls, ['ingredient-draw']);
    clock += 100;
    quacks.state = {
      ...state(),
      mine: {
        drawEvents: [{ id: 'resolved1', at: clock, decision: true }],
        drawDecisionEvents: [decision],
        stopEvents: [],
      },
    };
    await vue.nextTick();
    assert.deepEqual(
      calls,
      ['ingredient-draw'],
      'resolved chip does not replay the accepted decision',
    );
    clock += 100;
    quacks.state = {
      ...state(),
      mine: {
        drawEvents: [{ id: 'resolved1', at: clock - 100, decision: true }],
        drawDecisionEvents: [decision],
        stopEvents: [{ id: 'stop1', at: clock }],
      },
    };
    await vue.nextTick();
    for (const fn of [...timers.values()]) fn();
    assert.deepEqual(calls, ['ingredient-draw', 'quacks-stop']);
  } finally {
    unmounts.forEach((fn) => fn());
    scope.stop();
  }
});
