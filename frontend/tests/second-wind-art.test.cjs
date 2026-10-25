const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const { racers, twists } = require('../../src/games/second-wind/catalog');
const base = path.resolve(__dirname, '../src/assets/second-wind');
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json')));
const moduleValue = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src/pages/second-wind/track-layout.ts'), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText,
  { module: moduleValue, exports: moduleValue.exports },
);
const { trackPoint } = moduleValue.exports;

test('all 36 base cards and bounded portraits match their source manifest and delivery budget', () => {
  const { baseRacers } = require('../../src/games/second-wind/catalog');
  const folder = path.resolve(__dirname, '../src/assets/second-wind-base');
  const data = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json')));
  const required = baseRacers.flatMap((r) => [r.id + '-card.webp', r.id + '-portrait.webp']).sort();
  assert.deepEqual(data.assets.map((a) => a.file).sort(), required);
  assert.deepEqual(
    fs
      .readdirSync(folder)
      .filter((f) => f.endsWith('.webp'))
      .sort(),
    required,
  );
  for (const asset of data.assets) {
    const bytes = fs.readFileSync(path.join(folder, asset.file));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.ok(bytes.length <= 256 * 1024);
    if (asset.file.includes('-portrait')) assert.ok(asset.width <= 96 && asset.height <= 72);
  }
  assert.ok(data.assets.reduce((sum, asset) => sum + asset.bytes, 0) < 600 * 1024);
});

test('original roster and every Twist have verified compressed art with no missing or oversized files', () => {
  const required = racers
    .flatMap((r) => [r.id + '-card.webp', r.id + '-portrait.webp'])
    .concat(
      twists.map((t) => t.id + '-twist.webp'),
      [
        'weremouth-portrait.webp',
        'hero.webp',
        'twisty-twirl-800.webp',
        'twisty-twirl-1600.webp',
        'whirly-world-800.webp',
        'whirly-world-1600.webp',
      ],
    );
  assert.equal(new Set(required).size, 91);
  assert.deepEqual(manifest.assets.map((a) => a.file).sort(), required.sort());
  assert.deepEqual(
    fs
      .readdirSync(base)
      .filter((f) => f.endsWith('.webp'))
      .sort(),
    required,
  );
  for (const asset of manifest.assets) {
    const bytes = fs.readFileSync(path.join(base, asset.file));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.ok(bytes.length <= 256 * 1024, asset.file);
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.ok(asset.origin && asset.width > 0 && asset.height > 0);
    if (asset.file.includes('-portrait')) assert.ok(asset.width <= 96);
  }
  assert.ok(manifest.assets.reduce((n, a) => n + a.bytes, 0) < 1.1 * 1024 * 1024);
});

test('track positions retain both physical endpoints and mirror portals without displacing racers', () => {
  assert.equal(trackPoint(0).left, '10.5%');
  assert.equal(trackPoint(30).top, '51%');
  assert.equal(trackPoint(12).top, '17%');
  assert.equal(trackPoint(15).top, '83.5%');
  for (let p = 0; p <= 30; p++) {
    assert.deepEqual(trackPoint(p, -1), trackPoint(30 - p));
    assert.ok(parseFloat(trackPoint(p).left) > 0 && parseFloat(trackPoint(p).left) < 100);
  }
  const points = Array.from({ length: 31 }, (_, p) => JSON.stringify(trackPoint(p)));
  assert.equal(new Set(points).size, 31);
  assert.ok(parseFloat(trackPoint(1).left) < parseFloat(trackPoint(2).left));
  assert.ok(parseFloat(trackPoint(28).left) > parseFloat(trackPoint(29).left));
});
