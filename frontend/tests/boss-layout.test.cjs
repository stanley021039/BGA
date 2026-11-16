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
test('boss layers keep their artwork and do not match legacy nameplate or avatar-image selectors', async () => {
  const file = path.resolve(__dirname, '../src/components/BossPuppet.vue');
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
  mod._compile(code, file);
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(mod.exports.default, {
          visitor: { id: 'boss', bossId: 'thanos', health: 100, facing: 'left' },
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
