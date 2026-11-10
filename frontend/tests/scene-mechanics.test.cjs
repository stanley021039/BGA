const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];

function loadAttackLayer(vue, runtime = {}) {
  const ts = require('typescript');
  const { parse, compileScript } = require('vue/compiler-sfc');
  const file = path.join(__dirname, '../src/pages/lobby/LobbyAttackLayer.vue');
  const code = compileScript(parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor, {
    id: 'lobby-equation',
    inlineTemplate: true,
  }).content;
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      document,
      ...runtime,
      require(id) {
        if (id === 'vue') return vue;
        if (id.endsWith('/preferences')) return { usePreferencesStore: () => ({}) };
        if (id.endsWith('/SceneEquation.vue'))
          return {
            default: {
              props: ['puzzle'],
              setup: (props) => () => vue.h('aside', props.puzzle.prompt),
            },
          };
        return {};
      },
    },
  );
  return module.exports.default;
}

test('the lobby shows the local equation by default and rooms can explicitly suppress it', async () => {
  const vue = require('vue');
  const { renderToString } = require('vue/server-renderer');
  const AttackLayer = loadAttackLayer(vue);
  const snapshot = {
    selfId: 'self',
    serverNow: 1000,
    attacks: [],
    visitors: [
      { id: 'self', equation: { id: 'mine', prompt: 'my question' } },
      { id: 'peer', equation: { id: 'theirs', prompt: 'their question' } },
    ],
  };
  const render = (options) =>
    renderToString(
      vue.createSSRApp({
        render: () => vue.h(AttackLayer, { snapshot, connected: true, ...options }),
      }),
    );
  assert.match(await render({}), /my question/);
  assert.doesNotMatch(await render({}), /their question/);
  assert.doesNotMatch(await render({ puzzleEnabled: false }), /my question/);
  assert.doesNotMatch(await render({ connected: false }), /my question/);
});

test('black coffin counts down on the hit player only and clears the overlay and timer', async () => {
  const vue = require('vue');
  let now = 0;
  const timers = new Set();
  const AttackLayer = loadAttackLayer(vue, {
    performance: { now: () => now },
    setTimeout: (callback) => (timers.add(callback), callback),
    clearTimeout: (callback) => timers.delete(callback),
  });
  const snapshot = vue.reactive({
    selfId: 'self',
    serverNow: 1000,
    attacks: [],
    visitors: [{ id: 'self' }, { id: 'peer', blackoutUntil: 3000 }],
  });
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp({ render: () => vue.h(AttackLayer, { snapshot, connected: true }) });
  const overlay = () => document.querySelector('.coffin-blackout');
  const advance = async (ms) => {
    now += ms;
    const callback = [...timers][0];
    timers.delete(callback);
    callback();
    await vue.nextTick();
  };
  app.mount(host);
  try {
    assert.equal(overlay(), null);
    snapshot.visitors[0].blackoutUntil = 3000;
    await vue.nextTick();
    assert.match(overlay().textContent, /墮入無盡的黑暗深淵吧.*2 秒/);
    await advance(1000);
    assert.match(overlay().textContent, /1 秒/);
    await advance(1000);
    assert.equal(overlay(), null);
    assert.equal(timers.size, 0);
    snapshot.visitors[0].blackoutUntil = 5000;
    await vue.nextTick();
    assert.equal(timers.size, 1);
  } finally {
    app.unmount();
    host.remove();
  }
  assert.equal(timers.size, 0);
});

test('knockback moves the real actor from its hit point to the server destination, with bounded concurrent jobs and immediate policy cleanup', () => {
  const source = fs
    .readFileSync(path.join(__dirname, '../src/services/scene-knockback.js'), 'utf8')
    .replace(/^import .*;\r?\n/, '')
    .replace('export function ', 'function ');
  const animations = [],
    cancelJobs = new Set();
  let allowed = true;
  const scope = {
    motionAllowed: () => allowed,
    watchMotionCancellation(fn) {
      cancelJobs.add(fn);
      return () => cancelJobs.delete(fn);
    },
  };
  vm.createContext(scope);
  vm.runInContext(source, scope);
  const node = {
    closest: () => ({ getBoundingClientRect: () => ({ width: 1000, height: 600 }) }),
    animate(frames, options) {
      const a = {
        frames,
        options,
        cancelled: 0,
        cancel() {
          this.cancelled++;
        },
      };
      animations.push(a);
      return a;
    },
  };
  const visitor = { x: 52, y: 50, knockback: { fromX: 40, fromY: 50 } };
  const stops = Array.from({ length: 9 }, () => scope.playKnockback(node, visitor));
  assert.equal(animations.length, 6);
  assert.equal(cancelJobs.size, 6);
  assert.equal(animations[0].frames[0].translate, '-120px 0px');
  assert.equal(animations[0].frames.at(-1).translate, '0px 0px');
  assert.equal(animations[0].options.duration, 450);
  allowed = false;
  for (const stop of [...cancelJobs]) stop();
  stops.forEach((stop) => stop());
  assert.ok(animations.every((a) => a.cancelled === 1));
  assert.equal(cancelJobs.size, 0);
  scope.playKnockback(node, visitor);
  assert.equal(animations.length, 6);
});

test('a dropped lower body renders only the owner image bottom half and its independent health; collection removes the entity', async () => {
  const vue = require('vue'),
    ts = require('typescript'),
    { parse, compileScript } = require('vue/compiler-sfc');
  const file = path.join(__dirname, '../src/components/SceneFragments.vue');
  const code = compileScript(parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor, {
    id: 'fragments',
    inlineTemplate: true,
  }).content;
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) => (id === 'vue' ? vue : { sizedImage: (url) => url }),
    },
  );
  const owner = vue.reactive({
    id: 'owner',
    name: '測試玩家',
    image: '/character.png',
    fragment: { id: 'lower', x: 35, y: 55, health: 600000, maxHealth: 600000, stealable: false },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp({ render: () => vue.h(module.exports.default, { visitors: [owner] }) });
  app.mount(host);
  try {
    assert.match(host.querySelector('[role=img]').getAttribute('aria-label'), /本人可拾回/);
    assert.equal(host.querySelector('img').getAttribute('src'), '/character.png');
    assert.equal(host.querySelector('progress').getAttribute('value'), '600000');
    owner.fragment.stealable = true;
    owner.fragment.health = 400000;
    await vue.nextTick();
    assert.equal(host.querySelector('progress').getAttribute('value'), '400000');
    assert.match(
      host.querySelector('[role=img]').getAttribute('aria-label'),
      /其他玩家拾取回 30 能量/,
    );
    owner.fragment = null;
    await vue.nextTick();
    assert.equal(host.querySelector('.scene-fragment'), null);
  } finally {
    app.unmount();
    host.remove();
  }
});
