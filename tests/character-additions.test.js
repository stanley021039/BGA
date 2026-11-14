const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto'),
  sharp = require('sharp');
const manifest = require('../public/shared/character-additions.json');
test('thirty characters have six compressed transparent expressions with verified content hashes', async () => {
  assert.equal(manifest.characters.length, 30);
  assert.equal(new Set(manifest.characters.map((c) => c.id)).size, 30);
  for (const character of manifest.characters) {
    assert.deepEqual(Object.keys(character.expressions), [
      'neutral',
      'happy',
      'sad',
      'surprised',
      'thinking',
      'angry',
    ]);
    for (const asset of Object.values(character.expressions)) {
      const bytes = fs.readFileSync(
        path.join(__dirname, '../public/assets/characters', asset.file),
      );
      assert.equal(bytes.length, asset.bytes);
      assert.ok(bytes.length <= 256 * 1024);
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256);
      const image = sharp(bytes),
        meta = await image.metadata(),
        stats = await image.stats();
      assert.equal(meta.format, 'webp');
      assert.equal(meta.width, 256);
      assert.equal(meta.height, 256);
      assert.equal(meta.hasAlpha, true);
      assert.equal(stats.channels[3].min, 0);
    }
  }
});
