const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');

test('training scenes isolate users, keep preview settings and do not grant public attack overrides', async (t) => {
  const { base } = await appFixture(t, {
    seed: async (db) => {
      const auth = createAuth(db),
        id = await auth.bootstrap('training_owner', 'test-password-123');
      const admin = db.prepare('SELECT * FROM users WHERE id=?').get(id);
      await auth.register(
        {
          username: 'training_guest',
          displayName: 'Guest',
          password: 'test-password-123',
          confirmPassword: 'test-password-123',
          invite: auth.createInvite(admin).code,
        },
        { setHeader() {} },
      );
    },
  });
  async function login(username) {
    const r = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'test-password-123' }),
    });
    assert.equal(r.status, 200);
    return r.headers.get('set-cookie').split(';')[0];
  }
  const a = await login('training_owner'),
    b = await login('training_guest');
  async function request(cookie, url, body) {
    const r = await fetch(base + url, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json() };
  }
  const own = await request(a, '/api/lobby?training=1'),
    other = await request(b, '/api/lobby?training=1');
  assert.equal(own.status, 200);
  assert.equal(own.body.visitors.length, 2);
  const ownBot = own.body.visitors.find((v) => v.id !== own.body.selfId);
  assert.ok(!other.body.visitors.some((v) => v.id === ownBot.id));
  assert.equal(
    (await request(b, '/api/lobby/bots?training=1', { action: 'remove', id: ownBot.id })).status,
    403,
  );
  const config = await request(a, '/api/lobby/training?training=1', {
    action: 'settings',
    q: 'beam',
    e: 'barrage',
    r: 'guanyin_barrage',
    entrance: 'classic',
  });
  assert.equal(config.status, 200);
  const refill = await request(a, '/api/lobby/training?training=1', { action: 'refill' });
  assert.equal(refill.body.visitors.find((v) => v.id === refill.body.selfId).energy, 150);
  const hit = await request(a, '/api/lobby/attack?training=1', {
    requestId: 'training-hit-0001',
    slot: 'q',
    aspectRatio: 1.6,
  });
  assert.equal(hit.status, 200);
  assert.equal(hit.body.attacks.at(-1).effect, 'beam');
  assert.ok(!(await request(a, '/api/lobby')).body.visitors.some((v) => v.id === ownBot.id));
  assert.equal(
    (
      await request(a, '/api/lobby/attack', {
        requestId: 'spoofed-hit-0001',
        slot: 'q',
        aspectRatio: 1.6,
        effect: 'guanyin_barrage',
      })
    ).status,
    400,
  );
  assert.equal((await request(a, '/api/lobby/bots?arena=1')).status, 409);
  const trainingBosses = await request(a, '/api/lobby/bosses?training=1');
  assert.equal(trainingBosses.status, 200);
  assert.equal(trainingBosses.body.limit, 1);
  const summoned = await request(a, '/api/lobby/bosses?training=1', {
    action: 'add',
    bossId: 'ghidorah-turtle',
  });
  assert.equal(summoned.status, 200);
  const ownBoss = summoned.body.bosses[0];
  assert.equal(
    (await request(a, '/api/lobby/bosses?training=1', { action: 'add', bossId: 'gyo' })).status,
    409,
  );
  assert.ok(
    !(await request(b, '/api/lobby/bosses?training=1')).body.bosses.some(
      (boss) => boss.id === ownBoss.id,
    ),
  );
  assert.ok(
    !(await request(a, '/api/lobby/bosses')).body.bosses.some((boss) => boss.id === ownBoss.id),
  );
  assert.equal(
    (await request(b, '/api/lobby/bosses?training=1', { action: 'remove', id: ownBoss.id })).status,
    403,
  );
  assert.equal(
    (await request(a, '/api/lobby/bosses?training=1', { action: 'remove', id: ownBoss.id })).status,
    200,
  );
  assert.equal(
    (await request(a, '/api/lobby/bots?training=1')).body.characters.length,
    require('../src/profiles/appearance').builtinCharacters.length,
  );
});
