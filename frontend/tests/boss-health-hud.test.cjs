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
const energyFile = path.resolve(__dirname, '../src/components/SceneEnergy.vue');
const energyScript = compileScript(
  parse(fs.readFileSync(energyFile, 'utf8'), { filename: energyFile }).descriptor,
  { id: 'boss-energy', inlineTemplate: true, genDefaultAs: '__component' },
);
const energyModule = new Module(energyFile, module);
energyModule.filename = energyFile;
energyModule.paths = module.paths;
energyModule._compile(
  ts.transpileModule(energyScript.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText + '\nexports.default=__component;',
  energyFile,
);
mod.require = (name) =>
  name === './SceneEnergy.vue'
    ? energyModule.exports
    : name.endsWith('scene-rules.json')
      ? { default: require('../../public/shared/scene-rules.json') }
      : name === './UiPanel.vue'
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
async function render(visitors, connected = true, selfId) {
  const context = {};
  await renderToString(
    createSSRApp({ render: () => h(mod.exports.default, { visitors, connected, selfId }) }),
    context,
  );
  return parseHTML('<html><body>' + (context.teleports?.body || '') + '</body></html>').document;
}
const boss = (id, health = 750) => ({
  id,
  name: 'Boss ' + id,
  bossId: 'colossal',
  health,
  maxHealth: 1000,
});
test('boss HUD exposes separate named authoritative health bars, clamps values and caps the lobby at five', async () => {
  const doc = await render([
    { id: 'player', health: 90, maxHealth: 100 },
    boss('a', 1200),
    boss('b', -20),
    boss('c'),
    boss('d'),
    boss('e'),
    boss('f'),
    boss('g'),
  ]);
  const meters = [...doc.querySelectorAll('progress')];
  assert.equal(meters.length, 5);
  assert.equal(meters[0].getAttribute('value'), '1000');
  assert.equal(meters[0].getAttribute('max'), '1000');
  assert.equal(meters[0].getAttribute('aria-label'), 'Boss a的總生命值（三階段）');
  assert.equal(meters[1].getAttribute('value'), '750');
  assert.equal(doc.querySelectorAll('.boss-health-divider').length, 10);
  assert.doesNotMatch(doc.body.textContent, /Boss b|已擊倒|Boss g/);
});
test('boss HUD clears on disconnect/removal and follows fresh health or respawn snapshots', async () => {
  for (const [visitors, connected] of [
    [[], true],
    [[boss('a')], false],
    [[boss('bad', NaN)], true],
    [[boss('dead', 0)], true],
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
  const doc = await render([{ ...boss('a', 600), bossPhase: 2, bossPhaseLockMs: 1500 }]);
  assert.match(doc.body.textContent, /狂暴/);
  assert.match(doc.body.textContent, /鎖血/);
  assert.doesNotMatch(doc.body.textContent, /秒/);
  assert.deepEqual(
    [...doc.querySelectorAll('progress')].map((p) => Number(p.getAttribute('value'))),
    [600],
  );
  assert.match((await render([{ ...boss('a', 100), bossPhase: 3 }])).body.textContent, /最終階段/);
});

test('boss HP uses the same unscaled numeric units as damage popups', async () => {
  const doc = await render([{ ...boss('a', 8790000), maxHealth: 8960000 }]);
  assert.match(doc.body.textContent, /總生命 8,790,000 \/ 8,960,000 HP/);
});

test('control immunity label has no countdown and five bars remain scrollable', async () => {
  const doc = await render(
    Array.from({ length: 5 }, (_, i) => ({ ...boss(String(i)), bossControlImmuneMs: 4500 })),
  );
  assert.equal(doc.querySelectorAll('progress').length, 5);
  assert.match(doc.body.textContent, /免控/);
  assert.doesNotMatch(doc.body.textContent, /4.5|秒/);
  assert.ok(doc.querySelector('[tabindex="0"]'));
});

test('own controlled Boss shows a readable energy meter across all three phases and clears on death or role change', async () => {
  for (const phase of [1, 2, 3])
    for (const charge of [0, 50, 100]) {
      const own = {
        ...boss('self', (4 - phase) * 250),
        controlledBoss: true,
        bossPhase: phase,
        energy: charge,
        energyMaximum: 100,
      };
      const other = { ...boss('other'), controlledBoss: true, energy: 100, energyMaximum: 100 };
      const doc = await render([other, own], true, 'self');
      assert.equal(doc.querySelector('.boss-health-entry').getAttribute('data-boss-id'), 'self');
      assert.equal(doc.querySelectorAll('.boss-energy').length, 1);
      assert.match(doc.querySelector('.boss-energy').textContent, new RegExp(`${charge} / 100`));
      assert.match(
        doc.querySelector('.boss-energy').textContent,
        charge === 100 ? /蓄力已滿/ : /蓄力中/,
      );
      assert.equal(
        doc.querySelector('[aria-label="大招能量"]').getAttribute('aria-valuenow'),
        String(charge),
      );
    }
  for (const visitors of [
    [{ ...boss('self', 0), controlledBoss: true }],
    [boss('self')],
    [boss('other')],
  ])
    assert.equal((await render(visitors, true, 'self')).querySelectorAll('.boss-energy').length, 0);
});
