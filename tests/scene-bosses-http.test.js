const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
const sharp = require('sharp');
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
test('eleven boss assets are bounded transparent WebP with verified source and output metadata', async () => {
  const manifest = require('../public/shared/boss-art.json');
  assert.equal(manifest.bosses.length, 11);
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
  assert.equal(state.catalog.length, 11);
  assert.equal(state.limit, 2);
  const boss = state.catalog[0];
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
  assert.equal((await post({ action: 'add', bossId: 'greeza' })).status, 409);
  assert.equal((await post({ action: 'add', bossId: 'greeza', health: 1 })).status, 400);
  assert.equal((await post({ action: 'list' }, '?training=1')).status, 403);
});
