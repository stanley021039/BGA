const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  sharp = require('sharp');
const { createApp } = require('../src/app');
const asset = path.join(__dirname, '../public/assets/room-leave-thumbnail.jpg');
test('leave thumbnail is a bounded JPEG preserving the supplied landscape ratio', async () => {
  const image = await sharp(asset).metadata();
  assert.equal(image.format, 'jpeg');
  assert.equal(image.width, 640);
  assert.equal(image.height, 361);
  assert.ok(fs.statSync(asset).size < 40000);
  assert.ok(!image.exif);
});
test('thumbnail static route serves exact JPEG bytes without authentication; unknown assets stay blocked', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-leave-thumbnail-')),
    app = createApp({
      port: 0,
      host: '127.0.0.1',
      publicUrl: null,
      historyDir: path.join(root, 'history'),
      communityDir: path.join(root, 'community'),
      dbFile: path.join(root, 'app.sqlite'),
    });
  try {
    const { port } = await app.listen(),
      base = 'http://127.0.0.1:' + port,
      response = await fetch(base + '/assets/room-leave-thumbnail.jpg');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^image\/jpeg/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(asset));
    assert.equal((await fetch(base + '/assets/not-allowed.jpg')).status, 404);
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
