'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { SCENARIOS } = require('../src/games/majority-scenarios'),
  { themes } = require('../src/games/majority-tournament');
function ui() {
  const fields = {},
    nodes = [],
    button = {},
    document = {
      querySelector: (s) => fields[s] || null,
      createElement: () => ({
        innerHTML: '',
        className: '',
        setAttribute() {},
        querySelector: (s) => (s === 'audio' ? null : button),
        remove() {
          this.removed = true;
        },
      }),
      body: { append: (n) => nodes.push(n) },
    };
  document.addEventListener = () => {};
  const w = { addEventListener() {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../public/majority-tournament.js'), 'utf8'),
    { window: w, document, location: { origin: 'https://game.test' } },
  );
  return { api: w.MajorityTournament, fields, nodes, w };
}
test('Stitch art references resolve to reviewed local PNGs or safe standalone SVGs; classical and K-pop are playable themes', () => {
  const images = new Set(SCENARIOS.map((s) => s.image));
  assert.ok(images.size >= 10);
  for (const image of images) {
    const b = fs.readFileSync(path.join(__dirname, '../public', image));
    if (image.endsWith('.svg')) {
      assert.match(b.toString(), /<svg[^>]+xmlns=/);
      assert.doesNotMatch(
        b.toString(),
        /<script|<foreignObject|<image|(?:href|onload|onclick)\s*=/i,
      );
    } else {
      assert.equal(b.subarray(1, 4).toString(), 'PNG');
      assert.ok(b.readUInt32BE(16) > 0 && b.readUInt32BE(20) > 0);
    }
  }
  const t = themes('music');
  assert.ok(t.find((x) => x.id === 'classical').count >= 8);
  assert.equal(t.filter((x) => /K.?pop/i.test(x.label) && x.id.startsWith('genre:')).length, 1);
});
