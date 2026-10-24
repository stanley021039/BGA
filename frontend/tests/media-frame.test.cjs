const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
('use strict');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const ts = require('typescript');
const loaded = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src/services/media-frame.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  withEngineImports({ module: loaded, exports: loaded.exports }),
);
const { mediaFrameText } = loaded.exports;
test('light frame surfaces use dark ink, including ornate pastel themes', () => {
  for (const background of [
    '#fffdf3',
    '#fff3c7',
    '#fff',
    '#e7f1e6',
    'rgb(255, 228, 238)',
    'rgb(225, 245, 254)',
  ])
    assert.equal(mediaFrameText(background), '#111111', background);
});
test('dark frame surfaces keep light ink', () => {
  for (const background of ['#251535', '#14202b', 'rgb(37, 21, 53)', '#153b2b'])
    assert.equal(mediaFrameText(background), '#f8fafc', background);
});
test('gradient surfaces evaluate stops and ignore transparent overlays', () => {
  assert.equal(
    mediaFrameText('transparent', 'linear-gradient(rgb(255, 228, 238), rgb(255, 250, 225))'),
    '#111111',
  );
  assert.equal(
    mediaFrameText('#251535', 'linear-gradient(rgba(255, 255, 255, 0), rgba(0, 0, 0, 0))'),
    '#f8fafc',
  );
});

test('translucent gradient highlights use the composited surface instead of raw black or white', () => {
  assert.equal(
    mediaFrameText('#e7f1e6', 'linear-gradient(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0))'),
    '#111111',
  );
  assert.equal(
    mediaFrameText('#251535', 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0))'),
    '#f8fafc',
  );
});
