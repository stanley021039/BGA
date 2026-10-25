const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createChat } = require('../src/social/chat');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { createApp } = require('../src/app'),
  { openDatabase } = require('../src/db'),
  { createAuth } = require('../src/auth');
const json = (data, status = 200) => ({ status, ok: status === 200, json: async () => data });
const snapshot = (channel, code = null, messages = [], viewerId = 'alice') => ({
  channel,
  code,
  messages,
  viewerId,
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const event = (id) => ({
  id,
  name: '<img src=x onerror=bad()>',
  message: '<script>bad()</script>',
  at: 1,
});
test('history is capped, plain text preserved, channels isolated, retry idempotent and rate global', () => {
  let time = 1000;
  const chat = createChat({ clock: () => time }),
    alice = { id: 'a', display_name: 'A' },
    bob = { id: 'b', display_name: 'B' };
  const first = chat.send('AAAAAA', alice, '<img src=x onerror=bad()>', 'retry-0001');
  assert.equal(chat.send('AAAAAA', alice, first.message, 'retry-0001'), first);
  assert.throws(
    () => chat.send('AAAAAA', alice, 'changed', 'retry-0001'),
    (e) => e.code === 'CHAT_RETRY_CONFLICT',
  );
  assert.throws(
    () => chat.send('lobby', alice, 'bypass'),
    (e) => e.status === 429 || e.code === 'SOCIAL_RATE_LIMIT',
  );
  assert.deepEqual(chat.read('BBBBBB'), []);
  assert.deepEqual(chat.read('lobby'), []);
  assert.equal(JSON.stringify(first).includes('requestId'), false);
  for (let i = 0; i < 51; i++) {
    time += 1500;
    chat.send('AAAAAA', alice, 'message ' + i);
  }
  assert.equal(chat.read('AAAAAA').length, 50);
  assert.equal(chat.read('AAAAAA')[0].message, 'message 1');
  for (const message of ['', {}, 'a'.repeat(161), 'bad\u0000'])
    assert.throws(
      () => chat.send('lobby', bob, message),
      (e) => e.code === 'INVALID_MESSAGE',
    );
  chat.delete('AAAAAA');
  assert.deepEqual(chat.read('AAAAAA'), []);
  assert.deepEqual(createChat().read('lobby'), []);
});
test('HTTP chat auth, cross-room isolation, leave/kick, compatibility and no gameplay mutation', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-chat-'));
  const config = {
    host: '127.0.0.1',
    port: 0,
    dbFile: path.join(root, 'app.sqlite'),
    communityDir: path.join(root, 'community'),
    externalSideEffectsEnabled: false,
    achievementPurpose: 'test',
  };
  const db = openDatabase(config.dbFile);
  await createAuth(db).bootstrap('chatadmin', 'test-password-123');
  db.close();
  const app = createApp(config);
  try {
    const { port } = await app.listen(),
      base = `http://127.0.0.1:${port}`;
    const post = async (route, cookie, data) => {
      const r = await fetch(base + '/api/' + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(data),
      });
      return {
        status: r.status,
        data: await r.json(),
        cookie: r.headers.get('set-cookie')?.split(';')[0],
      };
    };
    const get = async (route, cookie) => {
      const r = await fetch(base + '/api/' + route, { headers: cookie ? { Cookie: cookie } : {} });
      return { status: r.status, data: await r.json() };
    };
    assert.equal((await get('chat?channel=lobby')).status, 401);
    const host = (
      await post('auth/login', null, { username: 'chatadmin', password: 'test-password-123' })
    ).cookie;
    const invite = (await post('admin/invites', host, { days: 1 })).data.code;
    const guest = (
      await post('auth/register', null, {
        username: 'chatguest',
        password: 'test-password-123',
        confirmPassword: 'test-password-123',
        invite,
      })
    ).cookie;
    const a = (await post('create', host, { type: 'poker' })).data.code,
      b = (await post('create', guest, { type: 'poker' })).data.code;
    const before = (await get('state?code=' + a, host)).data;
    assert.equal(
      (
        await post('chat', host, {
          channel: 'table',
          code: a,
          message: '<script>alert(1)</script>',
          requestId: 'request-0001',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post('chat', host, {
          channel: 'table',
          code: a,
          message: '<script>alert(1)</script>',
          requestId: 'request-0001',
        })
      ).data.messages.length,
      1,
    );
    assert.equal(
      (await post('social', host, { code: a, kind: 'message', message: 'rate bypass' })).status,
      429,
    );
    assert.equal((await get('chat?channel=table&code=' + a, guest)).status, 403);
    assert.equal(
      (await post('chat', guest, { channel: 'table', code: a, message: 'intruder' })).status,
      403,
    );
    assert.equal((await get('chat?channel=table&code=' + b, guest)).data.messages.length, 0);
    assert.equal((await get('chat?channel=lobby', guest)).status, 400);
    const after = (await get('state?code=' + a, host)).data;
    assert.equal(after.version, before.version);
    assert.equal(after.phase, before.phase);
    assert.equal(after.social[0].message, '<script>alert(1)</script>');
    assert.equal(after.barrages.length, 1);
    assert.equal(after.barrages[0].message, after.social[0].message);
    await post('join', guest, { code: a });
    assert.equal((await get('chat?channel=table&code=' + a, guest)).data.messages.length, 1);
    await post('leave', guest, { code: a });
    assert.equal((await get('chat?channel=table&code=' + a, guest)).status, 403);
    await post('join', guest, { code: a });
    const state = (await get('state?code=' + a, guest)).data;
    await post('kick', host, { code: a, playerId: state.me, confirmed: true });
    assert.equal((await get('chat?channel=table&code=' + a, guest)).status, 403);
    assert.equal(
      (await post('chat', guest, { channel: 'table', code: a, message: 'kicked' })).status,
      403,
    );
    assert.equal(
      (await post('chat', guest, { channel: 'lobby', message: 'still in lobby' })).status,
      400,
    );
    assert.equal((await get('chat?channel=lobby', host)).status, 400);
    assert.equal((await post('chat', host, { channel: 'other', message: 'bad' })).status, 400);
    await post('auth/logout', guest, {});
    assert.equal((await get('chat?channel=lobby', guest)).status, 401);
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test('all ten games share table chat membership without changing gameplay snapshots', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'all-room-chat-')),
    config = {
      host: '127.0.0.1',
      port: 0,
      dbFile: path.join(root, 'app.sqlite'),
      communityDir: path.join(root, 'community'),
      externalSideEffectsEnabled: false,
      achievementPurpose: 'test',
    };
  const types = [
    'poker',
    'thunder',
    'majority',
    'gift',
    'draw',
    'telephone',
    'trpg',
    'musicquiz',
    'minimal',
    'bluff',
  ];
  const db = openDatabase(config.dbFile);
  await createAuth(db).bootstrap('allchatadmin', 'test-password-123');
  const hash = db
    .prepare("SELECT password_hash FROM users WHERE username='allchatadmin'")
    .get().password_hash;
  require('../src/db').transaction(db, () => {
    const insert = db.prepare(
      'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    );
    for (const name of ['allchatguest', ...types.map((type) => 'chat_' + type)])
      insert.run(
        require('node:crypto').randomUUID(),
        name,
        name,
        hash,
        'member',
        new Date().toISOString(),
      );
  });
  db.close();
  const app = createApp(config);
  try {
    const { port } = await app.listen(),
      base = `http://127.0.0.1:${port}`;
    const post = async (route, cookie, data) => {
      const res = await fetch(base + '/api/' + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie || '' },
        body: JSON.stringify(data),
      });
      return {
        status: res.status,
        data: await res.json(),
        cookie: res.headers.get('set-cookie')?.split(';')[0],
      };
    };
    const get = async (route, cookie) => {
      const res = await fetch(base + '/api/' + route, { headers: { Cookie: cookie || '' } });
      return { status: res.status, data: await res.json() };
    };
    const guest = (
      await post('auth/login', null, { username: 'allchatguest', password: 'test-password-123' })
    ).cookie;
    // Independent senders avoid waiting on the global account rate limiter.
    // Global cross-room throttling remains covered by the createChat unit test.
    for (const type of types) {
      const login = await post('auth/login', null, {
        username: 'chat_' + type,
        password: 'test-password-123',
      });
      assert.equal(login.status, 200);
      const host = login.cookie;
      const created = await post('create', host, { type });
      assert.equal(created.status, 200, type);
      const code = created.data.code;
      assert.equal(
        (await get('chat?channel=table&code=' + code, guest)).status,
        403,
        type + ' outsider',
      );
      assert.equal(
        (await post('chat', guest, { channel: 'table', code, message: 'outsider' })).status,
        403,
        type + ' outsider write',
      );
      assert.equal((await post('join', guest, { code })).status, 200, type + ' join');
      const before = (await get('state?code=' + code, host)).data;
      const message = '😀'.repeat(160),
        requestId = 'all-room-' + type;
      const sent = await post('chat', host, { channel: 'table', code, message, requestId });
      assert.equal(sent.status, 200, type + ' send');
      assert.equal(sent.data.roomState.barrages[0].message, '😀'.repeat(40) + '…');
      assert.equal(
        (await post('social', host, { code, kind: 'barrage', message, requestId })).status,
        200,
        type + ' compatible retry',
      );
      assert.deepEqual(
        (await get('chat?channel=table&code=' + code, guest)).data.messages.map((m) => m.message),
        [message],
      );
      const after = (await get('state?code=' + code, host)).data;
      assert.equal(after.phase, before.phase);
      assert.equal(after.version, before.version);
      assert.equal(after.barrages.length, 1);
      assert.equal(after.social.length, 1);
      assert.equal((await post('leave', guest, { code })).status, 200);
      assert.equal(
        (await get('chat?channel=table&code=' + code, guest)).status,
        403,
        type + ' departed',
      );
      await post('leave', host, { code });
    }
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
