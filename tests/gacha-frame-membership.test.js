const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { byKey, poolItems } = require('../src/gacha/catalog');
test('all three legendary frame and player themes belong to both the style and combined pools', () => {
  for (const id of ['observatory', 'abyssal-glass', 'eclipse-theatre'])
    for (const kind of ['frames', 'media']) {
      const key = kind + ':' + id,
        item = byKey.get(key);
      assert.ok(item, key);
      assert.equal(item.rarity, 'legendary');
      assert.equal(item.exchangeCost, 560);
      assert.ok(item.weight > 0);
      for (const pool of ['styles', 'all'])
        assert.ok(
          poolItems(pool).some((x) => x.key === key),
          pool + ' ' + key,
        );
    }
});
