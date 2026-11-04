const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { createApp } = require('../src/app'),
  { openDatabase } = require('../src/db'),
  { createAuth } = require('../src/auth');
test('presence requires a seat, returns no snapshot and cannot resurrect a departed seat', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-presence-'));
  const dbFile = path.join(root, 'app.sqlite');
  const db = openDatabase(dbFile);
  await createAuth(db).bootstrap('tester', 'test-password-123');
  db.prepare(
    "INSERT INTO users(id,username,display_name,password_hash,role,created_at) SELECT 'outsider-id','outsider','outsider',password_hash,'member',created_at FROM users LIMIT 1",
  ).run();
  db.close();
  const app = createApp({
    host: '127.0.0.1',
    port: 0,
    dbFile,
    communityDir: path.join(root, 'community'),
    achievementPurpose: 'test',
    externalSideEffectsEnabled: false,
    marketAutomationEnabled: false,
  });
  const base = 'http://127.0.0.1:' + (await app.listen()).port;
  t.after(async () => {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  let cookie = '';
  async function api(route, data, auth = true) {
    const res = await fetch(base + '/api/' + route, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth && cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(data),
    });
    return { res, data: await res.json() };
  }
  const login = await api('auth/login', { username: 'tester', password: 'test-password-123' });
  cookie = login.res.headers.get('set-cookie').split(';')[0];
  const created = await api('create', { type: 'poker' });
  assert.equal(created.res.status, 200);
  const code = created.data.code;
  assert.equal((await api('room-presence', { code }, false)).res.status, 401);
  const memberCookie = cookie;
  const outsider = await api('auth/login', { username: 'outsider', password: 'test-password-123' });
  cookie = outsider.res.headers.get('set-cookie').split(';')[0];
  assert.equal((await api('room-presence', { code })).res.status, 403);
  cookie = memberCookie;
  const presence = await api('room-presence', { code });
  assert.equal(presence.res.status, 200);
  assert.deepEqual(presence.data, { alive: true });
  await api('leave', { code });
  assert.equal((await api('room-presence', { code })).res.status, 404);
});
