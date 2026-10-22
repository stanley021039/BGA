'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth');

test('room pages list their same-origin scripts and styles for the lobby to prefetch', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-page-assets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const page of require('../frontend/pages.json')) {
    fs.mkdirSync(path.join(root, 'pages', page.id), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'pages', page.id, 'index.html'),
      page.id === 'race'
        ? '<script type="module" src="/frontend-assets/race-AbCd1234.js"></script>' +
            '<link rel="modulepreload" href="/frontend-assets/shared-EfGh5678.js">' +
            '<link rel="stylesheet" href="/frontend-assets/race-IjKl9012.css">' +
            '<script src="/shared/room-ui.js"></script><script src="/frontend-assets/race-AbCd1234.js"></script>' +
            '<img src="https://example.com/x.js"><a href="/rules">rules</a>'
        : '<main></main>',
    );
  }
  fs.mkdirSync(path.join(root, 'frontend-assets'));
  const { base } = await appFixture(t, {
    config: { frontendEnabled: true, frontendRoot: root },
    seed: (db) => createAuth(db).bootstrap('pageowner', 'synthetic-page-password'),
  });
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'pageowner', password: 'synthetic-page-password' }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0],
    get = (type) =>
      fetch(base + '/api/frontend/page-assets?type=' + type, { headers: { Cookie: cookie } });
  // The lobby's 雷霆之路 card is "thunder"; its room page is race.
  assert.deepEqual(await (await get('thunder')).json(), {
    assets: [
      '/frontend-assets/race-AbCd1234.js',
      '/frontend-assets/shared-EfGh5678.js',
      '/frontend-assets/race-IjKl9012.css',
      '/shared/room-ui.js',
    ],
  });
  assert.deepEqual(await (await get('quacks')).json(), { assets: [] });
  for (const type of ['lobby', 'admin', '../race', 'market'])
    assert.equal((await get(type)).status, 400, type);
  assert.equal((await fetch(base + '/api/frontend/page-assets?type=race')).status, 401);
});
