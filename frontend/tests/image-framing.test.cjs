const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  ts = require('typescript');
const centers = require('../src/assets/character-framing.json'),
  mod = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src/services/image-framing.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  {
    module: mod,
    exports: mod.exports,
    URL,
    location: { href: 'http://localhost/settings' },
    require: () => ({ default: centers }),
  },
);
const align = mod.exports.centerChoiceImage;
test('transparent Gumayusi padding is centred at both width and height constrained sizes', () => {
  for (const [width, height] of [
    [80, 105],
    [200, 105],
    [120, 66],
  ]) {
    const image = {
      naturalWidth: 256,
      naturalHeight: 252,
      currentSrc: 'http://localhost/assets/characters/community-gumayusi-neutral.webp?size=128',
      style: {},
      getBoundingClientRect: () => ({ width, height }),
    };
    align(image);
    const rendered = Math.min(width, (height * 256) / 252),
      shift = parseFloat(image.style.translate);
    const visibleCenter =
      (width - rendered) / 2 + centers['community-gumayusi-neutral.webp'] * rendered + shift;
    assert.ok(Math.abs(visibleCenter - width / 2) < 0.01);
  }
});
test('custom images and not-yet-loaded images do not acquire builtin offsets', () => {
  const custom = {
    naturalWidth: 128,
    naturalHeight: 128,
    currentSrc: 'http://localhost/characters/community-gumayusi-neutral.webp?size=128',
    style: { translate: '-10px 0px' },
    getBoundingClientRect: () => ({ width: 40, height: 40 }),
  };
  align(custom);
  assert.equal(custom.style.translate, '');
  const pending = { naturalWidth: 0, naturalHeight: 0, style: {} };
  assert.doesNotThrow(() => align(pending));
});
