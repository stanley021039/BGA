'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth');

const IMMUTABLE = 'public, max-age=31536000, immutable',
  PRIVATE_IMMUTABLE = 'private, max-age=31536000, immutable';
const image = (name) =>
  fs.readFileSync(path.join(__dirname, '../public/assets/characters', name)).toString('base64');

test('hashed build assets are immutable, public files revalidate by ETag and documents stay uncached', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-static-cache-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const page of require('../frontend/pages.json')) {
    fs.mkdirSync(path.join(root, 'pages', page.id), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'pages', page.id, 'index.html'),
      '<!doctype html><main></main>',
    );
  }
  fs.mkdirSync(path.join(root, 'frontend-assets'));
  fs.writeFileSync(path.join(root, 'frontend-assets', 'probe-AbCd1234.js'), 'window.probe=1;');
  const { base } = await appFixture(t, { config: { frontendEnabled: true, frontendRoot: root } });

  const built = await fetch(base + '/frontend-assets/probe-AbCd1234.js');
  assert.equal(built.status, 200);
  assert.equal(built.headers.get('cache-control'), IMMUTABLE);

  const shared = await fetch(base + '/shared/ui-widgets.js'),
    etag = shared.headers.get('etag');
  assert.equal(shared.status, 200);
  assert.equal(shared.headers.get('cache-control'), 'no-cache');
  assert.match(etag, /^"[\w-]{27}"$/);
  assert.equal(
    await shared.text(),
    fs.readFileSync(path.join(__dirname, '../public/shared/ui-widgets.js'), 'utf8'),
  );
  const again = await fetch(base + '/shared/ui-widgets.js', { headers: { 'If-None-Match': etag } });
  assert.equal(again.status, 304);
  assert.equal(again.headers.get('etag'), etag);
  assert.equal(await again.text(), '');
  const weak = await fetch(base + '/shared/ui-widgets.js', {
    headers: { 'If-None-Match': '"other", W/' + etag },
  });
  assert.equal(weak.status, 304);
  const changed = await fetch(base + '/shared/ui-widgets.js', {
    headers: { 'If-None-Match': '"other"' },
  });
  assert.equal(changed.status, 200);

  for (const route of ['/login', '/api/version']) {
    const response = await fetch(base + route);
    assert.equal(response.headers.get('cache-control'), 'no-store', route);
  }
});

test('portrait URLs name their bytes and follow appearance and image changes', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('portraitowner', 'synthetic-portrait-password'),
  });
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'portraitowner', password: 'synthetic-portrait-password' }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0],
    me = (await login.json()).id;
  const get = (route, headers = {}) =>
    fetch(base + route, { headers: { Cookie: cookie, ...headers } });
  const post = async (route, data) => {
    const response = await fetch(base + '/api/' + route, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    assert.equal(response.status, 200, route);
    return response.json();
  };
  const lobbyImage = async () =>
    (await (await get('/api/lobby')).json()).visitors.find((visitor) => visitor.id === me).image;
  const { code } = await post('create', { type: 'draw', roomName: 'portrait cache' });
  const seat = async () => (await (await get('/api/state?code=' + code)).json()).players[0].avatar;

  const first = await lobbyImage();
  assert.match(first, new RegExp(`^/characters/${me}\\?v=[\\w-]{16}$`));
  assert.equal(await seat(), first);
  const current = await get(first);
  assert.equal(current.status, 200);
  assert.equal(current.headers.get('cache-control'), PRIVATE_IMMUTABLE);
  const stale = await get(`/characters/${me}?v=AAAAAAAAAAAAAAAA`);
  assert.equal(stale.status, 200);
  assert.equal(stale.headers.get('cache-control'), 'private, no-cache');
  assert.deepEqual(
    Buffer.from(await stale.arrayBuffer()),
    Buffer.from(await current.arrayBuffer()),
  );
  const unversioned = await get(`/characters/${me}`);
  assert.equal(
    (await get(`/characters/${me}`, { 'If-None-Match': unversioned.headers.get('etag') })).status,
    304,
  );

  await post('profile/appearance', {
    version: 5,
    characterId: 'builtin:woods',
    expression: 'neutral',
  });
  const woods = await lobbyImage();
  assert.notEqual(woods, first);
  assert.equal(await seat(), woods);

  const character = await post('profile/characters', {
    name: '快取測試',
    base64: image('traveler-neutral.png'),
  });
  await post('profile/appearance', {
    version: 5,
    characterId: character.id,
    expression: 'neutral',
  });
  const uploaded = await lobbyImage();
  assert.notEqual(uploaded, woods);
  assert.equal(await seat(), uploaded);
  // Replacing the shown image keeps the appearance but must not reuse its URL.
  await post(`profile/characters/${character.id.slice(5)}/expressions`, {
    expression: 'neutral',
    base64: image('mage-neutral.png'),
  });
  const replaced = await lobbyImage();
  assert.notEqual(replaced, uploaded);
  assert.equal(await seat(), replaced);
  assert.equal((await get(replaced)).headers.get('cache-control'), PRIVATE_IMMUTABLE);
  assert.equal((await get(uploaded)).headers.get('cache-control'), 'private, no-cache');
});
