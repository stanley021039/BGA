const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  Module = require('node:module');
const { parse, compileScript } = require('vue/compiler-sfc'),
  { createSSRApp, h } = require('vue'),
  { renderToString } = require('vue/server-renderer'),
  ts = require('typescript'),
  { parseHTML } = require('linkedom');
const cache = new Map();
function loadTs(file) {
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = module.paths;
  const resolve = Module.createRequire(file);
  mod.require = (id) =>
    id.startsWith('.') && !path.extname(id)
      ? loadTs(path.resolve(path.dirname(file), id + '.ts'))
      : resolve(id);
  mod._compile(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    file,
  );
  return mod.exports;
}
function loadComponent(file) {
  if (cache.has(file)) return cache.get(file);
  const script = compileScript(
    parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor,
    { id: 'boss-layout', inlineTemplate: true, genDefaultAs: '__component' },
  );
  const code =
    ts.transpileModule(script.content, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText + '\nexports.default=__component;';
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = module.paths;
  const resolve = Module.createRequire(file);
  mod.require = (id) =>
    id.endsWith('.vue')
      ? { default: loadComponent(path.resolve(path.dirname(file), id)) }
      : id.endsWith('.json')
        ? { default: resolve(id) }
        : id.startsWith('.') && !path.extname(id)
          ? loadTs(path.resolve(path.dirname(file), id + '.ts'))
          : resolve(id);
  mod._compile(code, file);
  cache.set(file, mod.exports.default);
  return mod.exports.default;
}

test('boss layers keep their artwork and do not match legacy nameplate or avatar-image selectors', async () => {
  const file = path.resolve(__dirname, '../src/components/BossPuppet.vue');
  const component = loadComponent(file);
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(component, {
          visitor: { id: 'boss', bossId: 'colossal', health: 100, facing: 'left' },
          src: '/boss.webp',
          active: false,
          serverNow: 1000,
        }),
    }),
  );
  const { document } = parseHTML(
    '<html><body><div class="lobby-avatar is-self"><div class="scene-avatar-portrait">' +
      html +
      '</div><span class="nameplate">Boss</span></div></body></html>',
  );
  const puppet = document.querySelector('.boss-puppet');
  assert.ok(puppet);
  assert.equal(
    puppet.querySelectorAll('span,img').length,
    0,
    'boss artwork must not inherit legacy label panels or fixed character image sizes',
  );
  assert.equal(
    document.querySelectorAll('.lobby-avatar span').length,
    1,
    'only the actual nameplate matches the legacy selector',
  );
  assert.equal(
    puppet.querySelectorAll('svg image').length,
    4,
    'fallback and three animation layers retain their artwork',
  );
  for (const image of puppet.querySelectorAll('image'))
    assert.equal(image.getAttribute('href'), '/boss.webp');
  assert.ok(
    puppet.classList.contains('is-facing-left'),
    'facing remains explicit when legacy img mirroring no longer applies',
  );
});

test('all thirteen bosses have distinct localized phase details, more final etchings, and no replacement raster or label frames', async () => {
  const component = loadComponent(
    path.resolve(__dirname, '../src/components/BossPhaseDetails.vue'),
  );
  const profiles = require('../src/services/boss-phase-art.js').bossPhaseProfiles;
  const bosses = [
    ...new Set(require('../../public/shared/boss-abilities.json').map((a) => a.boss)),
  ];
  assert.equal(Object.keys(profiles).length, bosses.length);
  for (const boss of bosses) {
    const renders = [];
    for (const phase of [1, 2, 3]) {
      const html = await renderToString(
        createSSRApp({ render: () => h(component, { boss, phase, src: '/boss.webp' }) }),
      );
      const doc = parseHTML('<html><body>' + html + '</body></html>').document;
      if (phase === 1) {
        assert.equal(doc.querySelector('svg'), null);
        continue;
      }
      assert.equal(doc.querySelector('svg').getAttribute('data-boss-stage'), String(phase));
      assert.equal(doc.querySelectorAll('img,span,filter').length, 0);
      assert.equal(doc.querySelector('mask image').getAttribute('href'), '/boss.webp');
      renders.push(doc.querySelectorAll('path').length);
    }
    assert.ok(renders[1] > renders[0], boss);
  }
});

test('beam mouth cutouts retain the portrait and disappear for death, hidden motion, other casts and expired waves', async () => {
  const component = loadComponent(path.resolve(__dirname, '../src/components/BossPuppet.vue'));
  const ability = require('../../public/shared/boss-abilities.json').find(
    (a) => a.id === 'boss_ghidorah_turtle_q',
  );
  const visitor = {
    id: 'boss',
    bossId: 'ghidorah-turtle',
    health: 100,
    bossIntent: { effect: ability.id, until: 10000 + ability.windup, attackRate: 1 },
  };
  for (const scenario of [
    { visitor, active: true, serverNow: 10000 + ability.windup, mouths: true },
    { visitor: { ...visitor, health: 0 }, active: true, serverNow: 10000 + ability.windup },
    { visitor, active: false, serverNow: 10000 + ability.windup },
    {
      visitor: {
        ...visitor,
        bossIntent: { ...visitor.bossIntent, effect: 'boss_ghidorah_turtle_e' },
      },
      active: true,
      serverNow: 10000 + ability.windup,
    },
    { visitor, active: true, serverNow: 15000 },
  ]) {
    const html = await renderToString(
      createSSRApp({ render: () => h(component, { ...scenario, src: '/boss.webp' }) }),
    );
    const doc = parseHTML('<html><body>' + html + '</body></html>').document;
    assert.equal(doc.querySelectorAll('[data-mouth-head]').length > 0, !!scenario.mouths);
    for (const image of doc.querySelectorAll('image'))
      assert.equal(image.getAttribute('href'), '/boss.webp');
    if (!scenario.mouths) assert.equal(doc.querySelector('clipPath'), null);
  }
});
