'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const sharp = require('sharp');
const { MediaThumbnails, thumbnailSize, contentHash } = require('../src/media/thumbnails');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth');

const asset = (name) => fs.readFileSync(path.join(__dirname, '../public/assets/characters', name));
function directory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-media-thumbnails-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('only the three published sizes are accepted', () => {
  assert.deepEqual(['128', '256', '512', '64', '256.5', null, 'x'].map(thumbnailSize), [
    128,
    256,
    512,
    null,
    null,
    null,
    null,
  ]);
});

test('thumbnails are WebP, never enlarged, keep animation and are shared by identical originals', async (t) => {
  const root = directory(t),
    thumbnails = new MediaThumbnails({ directory: root }),
    png = asset('traveler-neutral.png'),
    gif = asset('woods-happy.gif');
  assert.equal(await thumbnails.variant(png, 128), null);
  await thumbnails.prepare(png);
  const small = await thumbnails.variant(png, 128);
  assert.ok(small.bytes.length < png.length);
  const meta = await sharp(small.bytes).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 128);
  const large = await thumbnails.variant(png, 512);
  assert.equal((await sharp(large.bytes).metadata()).width, 256);

  await thumbnails.prepare(gif);
  const animated = await sharp((await thumbnails.variant(gif, 128)).bytes, {
    animated: true,
  }).metadata();
  assert.equal(animated.format, 'webp');
  assert.equal(animated.pages, 3);

  // The same bytes uploaded again reuse the existing derivatives.
  await thumbnails.prepare(Buffer.from(png));
  const files = fs.readdirSync(root).sort();
  assert.equal(files.length, 6);
  assert.ok(
    files.every((name) => name.startsWith(contentHash(png)) || name.startsWith(contentHash(gif))),
  );

  const reloaded = new MediaThumbnails({ directory: root });
  assert.deepEqual((await reloaded.variant(png, 128)).bytes, small.bytes);

  // A backfill over the remaining originals drops the deleted GIF's set.
  const past = new Date(Date.now() - 60000);
  for (const name of fs.readdirSync(root)) fs.utimesSync(path.join(root, name), past, past);
  await reloaded.backfill([() => png]);
  assert.deepEqual(
    fs.readdirSync(root).map((name) => name.slice(0, 64)),
    Array(3).fill(contentHash(png)),
  );
});

test('an original no larger than its thumbnail, or one that cannot be decoded, is served as is', async (t) => {
  const root = directory(t),
    bigger = new MediaThumbnails({
      directory: root,
      encode: async (bytes) => Buffer.concat([bytes, bytes]),
    }),
    png = asset('traveler-neutral.png');
  await bigger.prepare(png, [256]);
  assert.deepEqual(await bigger.variant(png, 256), { same: true });
  const broken = new MediaThumbnails({
    directory: root,
    encode: async () => {
      throw Error('decode failed');
    },
  });
  const garbage = Buffer.from('not an image');
  await broken.prepare(garbage, [128]);
  assert.deepEqual(await broken.variant(garbage, 128), { same: true });
});

test('image routes serve thumbnails with the cache policy of the original URL', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('thumbowner', 'synthetic-thumb-password'),
  });
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'thumbowner', password: 'synthetic-thumb-password' }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const get = (route) => fetch(base + route, { headers: { Cookie: cookie } });
  async function ready(route) {
    for (let i = 0; i < 100; i++) {
      const response = await get(route);
      if (response.headers.get('content-type') === 'image/webp') return response;
      // Until the thumbnail exists the original is sent, and never cached as the size.
      assert.equal(response.headers.get('cache-control'), 'private, no-cache');
      await response.arrayBuffer();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error('thumbnail was never prepared: ' + route);
  }

  const builtin = await ready('/assets/characters/traveler-neutral.png?size=128');
  assert.equal(builtin.headers.get('cache-control'), 'private, no-cache');
  assert.equal((await sharp(Buffer.from(await builtin.arrayBuffer())).metadata()).width, 128);
  const ignored = await get('/assets/characters/traveler-neutral.png?size=999');
  assert.equal(ignored.headers.get('content-type'), 'image/png');

  const created = await fetch(base + '/api/profile/characters', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '縮圖', base64: asset('mage-neutral.png').toString('base64') }),
  });
  const { id } = await created.json();
  const options = await (await get('/api/profile/options')).json();
  const neutral = options.characters.find((character) => character.id === id).expressions.neutral;
  const lobby = await (await get('/api/lobby')).json();
  assert.ok(lobby.visitors[0].image.endsWith('&size=256'));
  const versioned = await (
    await get(lobby.visitors[0].image.replace('&size=256', ''))
  ).arrayBuffer();
  assert.ok(versioned.byteLength > 0);
  const user = await ready(neutral + '?size=256');
  assert.equal(user.headers.get('cache-control'), 'private, no-cache');
  assert.equal(user.headers.get('content-security-policy'), "default-src 'none'");
  const etag = user.headers.get('etag');
  const again = await fetch(base + neutral + '?size=256', {
    headers: { Cookie: cookie, 'If-None-Match': etag },
  });
  assert.equal(again.status, 304);

  const avatar = await fetch(base + '/api/profile/avatar?size=128&v=1', {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
  assert.equal(avatar.status, 302);
  assert.match(
    avatar.headers.get('location'),
    /^\/assets\/characters\/[\w./-]+\?v=[\w-]{12}&size=128$/,
  );
});
