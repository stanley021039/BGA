'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  { randomUUID } = require('node:crypto');
const { createApp } = require('../src/app'),
  { openDatabase } = require('../src/db'),
  { createAuth } = require('../src/auth');
const publicDir = path.resolve(__dirname, '../public');

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-merged-app-')),
    password = 'test-' + randomUUID();
  // Pages come from the Vue build (#233): the real page shells stand in for it.
  const vueRoot = path.join(root, 'vue');
  for (const page of require('../frontend/pages.json')) {
    fs.mkdirSync(path.join(vueRoot, 'pages', page.id), { recursive: true });
    fs.copyFileSync(
      path.resolve(__dirname, '../frontend/pages', page.id, 'index.html'),
      path.join(vueRoot, 'pages', page.id, 'index.html'),
    );
  }
  fs.mkdirSync(path.join(vueRoot, 'frontend-assets'));
  const config = {
    host: '127.0.0.1',
    port: 0,
    frontendEnabled: true,
    frontendRoot: vueRoot,
    dbFile: path.join(root, 'db.sqlite'),
    historyDir: path.join(root, 'history'),
    communityDir: path.join(root, 'community'),
    musicDir: path.join(root, 'music'),
    externalSideEffectsEnabled: false,
    marketClock: () => Date.parse('2027-01-04T12:00:00Z'),
  };
  const db = openDatabase(config.dbFile);
  await createAuth(db).bootstrap('merge_app_owner', password);
  db.close();
  const app = createApp(config),
    base = 'http://127.0.0.1:' + (await app.listen()).port;
  t.after(async () => {
    await app.close();
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('bga-merged-app-'));
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  });
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'merge_app_owner', password }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0],
    user = await login.json();
  const get = (route, anonymous = false) =>
    fetch(base + route, { headers: anonymous ? {} : { Cookie: cookie }, redirect: 'manual' });
  const post = async (route, data) => {
    const response = await fetch(base + route, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return { status: response.status, body: await response.json() };
  };
  return { get, post, user };
}

test('entry intro repeats on refresh while authentication and deep-link redirects remain intact', async (t) => {
  const f = await fixture(t);
  for (let refresh = 0; refresh < 2; refresh++) {
    const response = await f.get('/');
    assert.equal(response.status, 200);
    assert.match(await response.text(), /id="entry-intro"/);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  const anonymous = await f.get('/quacks/ABC123', true);
  assert.equal(anonymous.status, 302);
  assert.equal(anonymous.headers.get('location'), '/login?next=%2Fquacks%2FABC123');
  assert.equal((await f.get('/api/auth/me')).status, 200);
});

test('merged app serves every HTML script and stylesheet, market entry and game sound assets together', async (t) => {
  const f = await fixture(t),
    resources = new Set(),
    // Every Vue page plus the two pages that are still served from public/.
    pages = [
      ...require('../frontend/pages.json').map((page) => ({
        file: page.document,
        route: page.route,
      })),
      { file: 'sound-library.html', route: '/sound-library' },
      { file: 'game-audio-admin.html', route: '/admin/game-audio' },
    ];
  for (const { file, route } of pages) {
    const response = await f.get(route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /^text\/html/, route);
    const html = (await response.text())
      .replace(/\s+/g, ' ')
      .replace(/\s+>/g, '>')
      .replace(/>\s+</g, '><');
    if (file === 'login.html') assert.doesNotMatch(html, /id="entry-intro"/, route);
    else assert.match(html, /id="entry-intro"/, route);
    assert.match(
      html,
      file === 'login.html' ? /\/shared\/auth-entry\.js/ : /\/shared\/entry-intro\.js/,
      route,
    );
    for (const match of html.matchAll(
      /<script\b[^>]*\bsrc="([^"]+)"|<link\b[^>]*\bhref="([^"]+)"/g,
    )) {
      const url = match[1] || match[2];
      if (url.startsWith('/') && /\.(?:js|css)(?:\?|$)/.test(url)) resources.add(url);
    }
  }
  for (const route of resources) {
    const response = await f.get(route);
    assert.equal(response.status, 200, route);
    assert.match(
      response.headers.get('content-type'),
      route.split('?')[0].endsWith('.css') ? /^text\/css/ : /^text\/javascript/,
      route,
    );
    assert.ok((await response.text()).length > 0, route);
  }
  for (const name of ['turn', 'dice-roll', 'shot', 'slam', 'nitro', 'skid']) {
    const route = '/assets/game-sounds/' + name + '.wav',
      response = await f.get(route, true);
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg', route);
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      fs.readFileSync(path.join(publicDir, route.replace(/\.wav$/, '.mp3'))),
      route,
    );
  }
  const version = await f.get('/api/version', true);
  assert.equal(version.status, 200);
  assert.equal(version.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await version.json(), { version: require('../package.json').version });
  for (const route of ['/market', '/draw/ABC123']) {
    const response = await f.get(route, true);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/login?next=' + encodeURIComponent(route));
  }
});

test('nickname and market APIs coexist without changing the canonical account or vote', async (t) => {
  const f = await fixture(t),
    created = await f.post('/api/admin/market/rounds', {
      requestId: randomUUID(),
      targetDate: '2027-01-06',
      confirmed: true,
    });
  assert.equal(created.status, 200);
  const roundId = created.body.roundId;
  const vote = await f.post('/api/market/vote', {
    requestId: randomUUID(),
    roundId,
    forecastTick: 20,
    expectedRevision: 0,
  });
  assert.equal(vote.status, 200);
  const before = await (await f.get('/api/market')).json(),
    renamed = await f.post('/api/profile/name', { displayName: '新的冥燈' });
  assert.equal(before.rounds[0].rules.version, 3);
  assert.equal(before.rounds[0].vote.forecastTick, 20);
  assert.equal(before.rounds[0].vote.revision, 1);
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.id, before.me.id);
  assert.equal(renamed.body.username, before.me.username);
  const after = await (await f.get('/api/market')).json();
  assert.equal(after.me.id, before.me.id);
  assert.equal(after.me.displayName, '新的冥燈');
  assert.deepEqual(after.rounds, before.rounds);
  assert.deepEqual(after.stats, before.stats);
  assert.deepEqual(after.ledger, before.ledger);
  assert.equal((await f.get('/api/market/vote')).status, 405);
});
