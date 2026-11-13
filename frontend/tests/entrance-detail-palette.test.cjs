const { test } = require('node:test'),
  assert = require('node:assert/strict');
const data = require('../../public/shared/entrance-palette.json');
test('three refined entrances and their alternate each use exactly three distinct authored colours', () => {
  for (const id of ['smoke', 'sparks', 'rift', 'smoke-alt', 'sparks-alt', 'rift-alt']) {
    const effect = [...data.starters, ...data.variants].find((e) => e.id === id);
    assert.equal(effect.detailColors.length, 3, id);
    assert.equal(new Set(effect.detailColors).size, 3, id);
    assert.ok(
      effect.detailColors.every((color) => /^#[a-f0-9]{6}$/i.test(color)),
      id,
    );
  }
});
