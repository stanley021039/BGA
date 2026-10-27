const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
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
  const { window } = require('linkedom').parseHTML('<html><body></body></html>');
  for (const k of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
    global[k] = k === 'window' ? window : window[k];
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
    fragment: { id: 'lower', x: 35, y: 55, health: 600000, maxHealth: 600000 },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp({ render: () => vue.h(module.exports.default, { visitors: [owner] }) });
  app.mount(host);
  try {
    assert.match(host.querySelector('[role=img]').getAttribute('aria-label'), /本人走近可拾回/);
    assert.equal(host.querySelector('img').getAttribute('src'), '/character.png');
    assert.equal(host.querySelector('progress').getAttribute('value'), '600000');
    owner.fragment.health = 400000;
    await vue.nextTick();
    assert.equal(host.querySelector('progress').getAttribute('value'), '400000');
    owner.fragment = null;
    await vue.nextTick();
    assert.equal(host.querySelector('.scene-fragment'), null);
  } finally {
    app.unmount();
    host.remove();
  }
});
