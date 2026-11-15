const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { parse, compileScript } = require('vue/compiler-sfc');
const { createSSRApp, h } = require('vue');
const { renderToString } = require('vue/server-renderer');
const ts = require('typescript');
const { parseHTML } = require('linkedom');
const file = path.resolve(__dirname, '../src/components/BossHealthHud.vue');
const script = compileScript(parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor, {
  id: 'boss-health',
  inlineTemplate: true,
  genDefaultAs: '__component',
});
const mod = new Module(file, module);
mod.filename = file;
mod.paths = module.paths;
mod.require = (name) =>
  name === './UiPanel.vue'
    ? {
        default: {
          setup:
            (_, { slots }) =>
            () =>
              h('section', {}, slots.default?.()),
        },
      }
    : require(name);
mod._compile(
  ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText + '\nexports.default=__component;',
  file,
);
async function render(visitors, connected = true) {
  const context = {};
  await renderToString(
    createSSRApp({ render: () => h(mod.exports.default, { visitors, connected }) }),
    context,
  );
  return parseHTML('<html><body>' + (context.teleports?.body || '') + '</body></html>').document;
}
const boss = (id, health = 750) => ({
  id,
  name: 'Boss ' + id,
  bossId: 'thanos',
  health,
  maxHealth: 1000,
});
test('boss HUD exposes separate named authoritative health bars, clamps values and caps the lobby at two', async () => {
  const doc = await render([
    { id: 'player', health: 90, maxHealth: 100 },
    boss('a', 1200),
    boss('b', -20),
    boss('c'),
  ]);
  const meters = [...doc.querySelectorAll('progress')];
  assert.equal(meters.length, 2);
  assert.equal(meters[0].getAttribute('value'), '1000');
  assert.equal(meters[0].getAttribute('max'), '1000');
  assert.equal(meters[0].getAttribute('aria-label'), 'Boss a的生命值');
  assert.equal(meters[1].getAttribute('value'), '0');
  assert.match(doc.body.textContent, /已擊倒/);
  assert.doesNotMatch(doc.body.textContent, /Boss c/);
});
test('boss HUD clears on disconnect/removal and follows fresh health or respawn snapshots', async () => {
  for (const [visitors, connected] of [
    [[], true],
    [[boss('a')], false],
    [[boss('bad', NaN)], true],
  ]) {
    assert.equal((await render(visitors, connected)).querySelectorAll('progress').length, 0);
  }
  assert.equal(
    (await render([boss('a', 250)])).querySelector('progress').getAttribute('value'),
    '250',
  );
  assert.equal(
    (await render([boss('a', 1000)])).querySelector('progress').getAttribute('value'),
    '1000',
  );
});
