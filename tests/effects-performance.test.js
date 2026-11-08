const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { check } = require('../tools/perf-check.cjs'),
  { appFixture } = require('./helpers/app-fixture.cjs'),
  { versionFor } = require('../src/http/static-cache');
const root = path.resolve(__dirname, '..'),
  manifest = require('../public/assets/game-sounds/compressed-manifest.json'),
  gachaManifest = require('../public/assets/game-sounds/gacha-manifest.json');
test('all original short sounds deliver compressed MP3 under old and new URLs with ETag revalidation', async (t) => {
  const { base } = await appFixture(t);
  for (const e of manifest.sounds)
    for (const name of [e.source, e.file]) {
      const r = await fetch(base + '/assets/' + e.directory + '/' + name);
      assert.equal(r.status, 200, name);
      assert.equal(r.headers.get('content-type'), 'audio/mpeg', name);
      assert.equal(r.headers.get('cache-control'), 'private, no-cache');
      assert.deepEqual(
        Buffer.from(await r.arrayBuffer()),
        fs.readFileSync(path.join(root, 'public/assets', e.directory, e.file)),
      );
      const again = await fetch(base + '/assets/' + e.directory + '/' + name, {
        headers: { 'If-None-Match': r.headers.get('etag') },
      });
      assert.equal(again.status, 304, name);
      assert.equal((await again.arrayBuffer()).byteLength, 0);
    }
});
test('gacha cues cache only the version matching their compressed bytes', async (t) => {
  const { base } = await appFixture(t);
  for (const { file } of gachaManifest.files) {
    const bytes = fs.readFileSync(path.join(root, 'public/assets/game-sounds', file));
    const url = base + '/assets/game-sounds/' + file;
    const current = await fetch(url + '?v=' + versionFor(bytes));
    assert.equal(current.status, 200, file);
    assert.equal(current.headers.get('content-type'), 'audio/mpeg');
    assert.equal(current.headers.get('cache-control'), 'private, max-age=31536000, immutable');
    assert.deepEqual(Buffer.from(await current.arrayBuffer()), bytes);
    const stale = await fetch(url + '?v=stale', {
      headers: { 'If-None-Match': current.headers.get('etag') },
    });
    assert.equal(stale.status, 304, file);
    assert.equal(stale.headers.get('cache-control'), 'private, no-cache');
  }
});
test('performance guard fails on new raw audio, modified compressed bytes, oversized art, embedded media and build output', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-perf-check-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const rel of [
    'public/assets/game-sounds',
    'public/assets/gift-sounds',
    'public/assets/auth',
    'public/shared',
  ])
    fs.mkdirSync(path.join(dir, rel), { recursive: true });
  for (const f of fs.readdirSync(path.join(root, 'public/assets/game-sounds')))
    if (
      /\.(wav|mp3)$/.test(f) ||
      ['compressed-manifest.json', 'gacha-manifest.json', 'ping-voice-manifest.json'].includes(f)
    )
      fs.copyFileSync(
        path.join(root, 'public/assets/game-sounds', f),
        path.join(dir, 'public/assets/game-sounds', f),
      );
  for (const f of ['login-864.webp', 'home-family.jpg', 'soul-world.webp'])
    fs.copyFileSync(
      path.join(root, 'public/assets/auth', f),
      path.join(dir, 'public/assets/auth', f),
    );
  for (const f of ['entrance-stitch.json', 'lobby-background-live.json', 'ping-voices.json'])
    fs.copyFileSync(path.join(root, 'public/shared', f), path.join(dir, 'public/shared', f));
  fs.mkdirSync(path.join(dir, 'public/assets/gift-sounds'), { recursive: true });
  for (const file of fs.readdirSync(path.join(root, 'public/assets/gift-sounds')))
    if (/\.(wav|mp3)$/.test(file))
      fs.copyFileSync(
        path.join(root, 'public/assets/gift-sounds', file),
        path.join(dir, 'public/assets/gift-sounds', file),
      );
  assert.deepEqual(check(dir).errors, []);
  const raw = path.join(dir, 'public/assets/game-sounds/new.wav');
  fs.writeFileSync(raw, 'RIFF');
  assert.ok(check(dir).errors.some((e) => /Uncompressed/.test(e)));
  fs.unlinkSync(raw);
  const sound = path.join(dir, 'public/assets/game-sounds', manifest.sounds[0].file),
    original = fs.readFileSync(sound);
  fs.appendFileSync(sound, 'tampered');
  assert.ok(check(dir).errors.some((e) => /hash/.test(e)));
  fs.writeFileSync(sound, original);
  const image = path.join(dir, 'public/assets/auth/soul-world.webp');
  fs.writeFileSync(image, Buffer.alloc(256 * 1024 + 1));
  assert.ok(check(dir).errors.some((e) => /Opening image|Static image/.test(e)));
  fs.copyFileSync(path.join(root, 'public/assets/auth/soul-world.webp'), image);
  const json = path.join(dir, 'public/shared/entrance-stitch.json'),
    saved = fs.readFileSync(json);
  fs.writeFileSync(
    json,
    JSON.stringify([{ id: 'bad', html: '<img src="data:image/png;base64,abc">' }]),
  );
  assert.ok(check(dir).errors.some((e) => /embedded/.test(e)));
  fs.writeFileSync(json, saved);
  assert.throws(() => check(dir, { build: true }), /Build frontend/);
  fs.mkdirSync(path.join(dir, 'frontend/dist/frontend-assets'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'frontend/dist/frontend-assets/huge.js'),
    require('node:crypto').randomBytes(400000),
  );
  assert.ok(check(dir, { build: true }).errors.some((e) => /Built asset/.test(e)));
});
