const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
const sharp = require('sharp');
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
test('thirteen boss assets are bounded transparent WebP with verified source and output metadata', async () => {
  const manifest = require('../public/shared/boss-art.json');
  assert.equal(manifest.bosses.length, 13);
  for (const c of manifest.bosses) {
    const b = fs.readFileSync(path.join(__dirname, '../public/assets/characters', c.file));
    assert.equal(b.length, c.bytes);
    assert.ok(b.length <= 256 * 1024);
    assert.equal(crypto.createHash('sha256').update(b).digest('hex'), c.sha256);
    const m = await sharp(b).metadata(),
      s = await sharp(b).stats();
    assert.equal(m.format, 'webp');
    assert.equal(m.width, 512);
    assert.equal(m.height, 512);
    assert.ok(m.hasAlpha);
    assert.equal(s.channels[3].min, 0);
  }
});
test('every existing boss has two bounded transparent evolved bodies with source hashes', async () => {
  const sprites = require('../public/shared/boss-phase-art.json').sprites;
  assert.equal(sprites.length, 26);
  for (const boss of require('../src/rooms/scene-bosses').bosses) {
    assert.deepEqual(
      sprites.filter((s) => s.boss === boss.id).map((s) => s.phase),
      [2, 3],
    );
  }
  for (const sprite of sprites) {
    const bytes = fs.readFileSync(path.join(__dirname, '../public/assets/characters', sprite.file));
    assert.equal(bytes.length, sprite.bytes);
    assert.ok(bytes.length <= 256 * 1024);
    assert.match(sprite.sourceSha256, /^[a-f0-9]{64}$/);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sprite.sha256);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 512);
    assert.equal((await sharp(bytes).stats()).channels[3].min, 0);
  }
});
test('boss HTTP requires authentication, validates scope and serves sized versioned images', async (t) => {
  const f = await appFixture(t, {
    async seed(db) {
      await createAuth(db).bootstrap('boss_http', 'test-boss-password');
    },
  });
  assert.equal((await fetch(f.base + '/api/lobby/bosses')).status, 401);
  const login = await fetch(f.base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'boss_http', password: 'test-boss-password' }),
  });
  const headers = {
    Cookie: login.headers.get('set-cookie').split(';')[0],
    'Content-Type': 'application/json',
  };
  const state = await (await fetch(f.base + '/api/lobby/bosses', { headers })).json();
  assert.equal(state.catalog.length, 13);
  assert.ok(!state.catalog.some((b) => b.id === 'thanos'));
  assert.equal(
    (await fetch(f.base + '/assets/characters/boss-thanos.webp', { headers })).status,
    404,
  );
  assert.equal(state.limit, 5);
  const sound = await fetch(f.base + '/assets/game-sounds/boss-warning-megaman-x4.mp3', {
    headers,
  });
  assert.equal(sound.status, 200);
  assert.match(sound.headers.get('content-type'), /audio\/mpeg/);
  const recording = Buffer.from(await sound.arrayBuffer());
  assert.equal(
    crypto.createHash('sha256').update(recording).digest('hex'),
    '767abc2dac81f92b45387070d51897b35fc4159f7c9ff8ae84a2cf643129ad11',
  );
  const boss = state.catalog[0];
  const phaseUrl = require('../src/http/asset-version').versionedAsset(
    '/assets/characters/boss-arkveld-phase-2.webp',
  );
  assert.equal((await fetch(f.base + phaseUrl)).status, 401);
  const phaseArt = await fetch(f.base + phaseUrl, { headers });
  assert.equal(phaseArt.status, 200);
  assert.match(phaseArt.headers.get('cache-control'), /immutable/);
  assert.match(
    (await fetch(f.base + phaseUrl.replace(/v=[^&]+/, 'v=old'), { headers })).headers.get(
      'cache-control',
    ),
    /no-cache/,
  );
  assert.match(boss.image, /\?v=/);
  assert.equal((await fetch(f.base + boss.image)).status, 401);
  const art = await fetch(f.base + boss.image, { headers });
  assert.equal(art.headers.get('content-type'), 'image/webp');
  assert.match(art.headers.get('cache-control'), /immutable/);
  const outdated = await fetch(f.base + boss.image.replace(/v=[^&]+/, 'v=old'), { headers });
  assert.match(outdated.headers.get('cache-control'), /no-cache/);
  let thumb;
  for (let n = 0; n < 15; n++) {
    thumb = await fetch(f.base + boss.image + '&size=256', { headers });
    const b = Buffer.from(await thumb.arrayBuffer());
    if ((await sharp(b).metadata()).width === 256) break;
    await new Promise((r) => setTimeout(r, 60));
  }
  const sized = await fetch(f.base + boss.image + '&size=256', { headers });
  assert.equal((await sharp(Buffer.from(await sized.arrayBuffer())).metadata()).width, 256);
  const post = (body, suffix = '') =>
    fetch(f.base + '/api/lobby/bosses' + suffix, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  assert.equal((await post({ action: 'add', bossId: boss.id })).status, 200);
  assert.equal((await post({ action: 'add', bossId: 'prismatic-void' })).status, 200);
  for (const bossId of ['greeza', 'cthulhu', 'hyper-zetton'])
    assert.equal((await post({ action: 'add', bossId })).status, 200);
  assert.equal((await post({ action: 'add', bossId: 'greeza' })).status, 409);
  assert.equal((await post({ action: 'add', bossId: 'greeza', health: 1 })).status, 400);
  const training = await post({ action: 'list' }, '?training=1');
  assert.equal(training.status, 200);
  const trainingState = await training.json();
  assert.equal(trainingState.limit, 1);
  assert.deepEqual(trainingState.bosses, []);
});
