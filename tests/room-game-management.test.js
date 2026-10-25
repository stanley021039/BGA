const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createAuth } = require('../src/auth');
const { transaction } = require('../src/db');
const { appFixture } = require('./helpers/app-fixture.cjs');

async function fixture(t) {
  const password = 'synthetic-game-management';
  const { base } = await appFixture(t, {
    seed: async (db) => {
      const id = await createAuth(db).bootstrap('host', password);
      const hash = db.prepare('SELECT password_hash FROM users WHERE id=?').get(id).password_hash;
      transaction(db, () => {
        for (const name of ['manager', 'member', 'other'])
          db.prepare(
            'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
          ).run(randomUUID(), name, name, hash, 'member', new Date().toISOString());
      });
    },
  });
  const cookies = {};
  async function request(route, who, data) {
    const response = await fetch(base + '/api/' + route, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        Cookie: cookies[who] || '',
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  for (const who of ['host', 'manager', 'member', 'other']) {
    const login = await request('auth/login', who, { username: who, password });
    assert.equal(login.status, 200);
    cookies[who] = login.cookie;
  }
  const state = async (code, who = 'manager') => (await request('state?code=' + code, who)).body;
  async function create(type) {
    const created = await request('create', 'host', { type });
    assert.equal(created.status, 200);
    const code = created.body.code;
    for (const who of ['manager', 'member', 'other'])
      assert.equal((await request('join', who, { code })).status, 200);
    return code;
  }
  async function role(code, role, who = 'manager') {
    const result = await request('room-role', 'host', {
      code,
      playerId: (await state(code, who)).me,
      role,
    });
    assert.equal(result.status, 200);
  }
  return { request, state, create, role };
}

const settings = {
  thunder: { devilsRun: true },
  majority: { rounds: 5, customPercent: 0 },
  gift: { target: 15, customPercent: 0 },
  draw: { seconds: 90, topics: ['food'] },
  telephone: { sources: ['silly'] },
  bluff: { levels: [1], roleSeconds: 10 },
  quacks: { bookSet: 2, witches: true },
  musicquiz: { target: 8 },
};

test('all eleven games grant settings/start only to current host or managers; protected host actions stay protected', async (t) => {
  for (const type of [
    'poker',
    'thunder',
    'majority',
    'gift',
    'draw',
    'trpg',
    'telephone',
    'musicquiz',
    'minimal',
    'bluff',
    'quacks',
  ]) {
    await t.test(type, async () => {
      const f = await fixture(t);
      const code = await f.create(type);
      const configure = async (who, payload = settings[type]) => {
        const current = await f.state(code, who);
        return f.request(type === 'musicquiz' ? 'action' : 'settings', who, {
          ...payload,
          code,
          ...(type === 'musicquiz'
            ? { action: 'configure', roundId: current.roundId, requestId: randomUUID() }
            : {}),
        });
      };
      const before = await f.state(code);
      assert.equal(before.permissions.canManageSettings, false);
      assert.equal(before.permissions.canStartGame, false);
      assert.equal(
        (await f.request('start', 'manager', { code, role: 'manager', canStartGame: true })).status,
        403,
      );
      if (settings[type]) assert.equal((await configure('manager')).status, 403);
      await f.role(code, 'manager');
      const manager = await f.state(code);
      assert.equal(manager.permissions.canManageSettings, true);
      assert.equal(manager.permissions.canStartGame, true);
      assert.equal(manager.hostId || manager.host, before.hostId || before.host);
      assert.equal((await f.request('bot', 'manager', { code })).status, 400);
      assert.equal(
        (
          await f.request('room-role', 'manager', {
            code,
            playerId: (await f.state(code, 'member')).me,
            role: 'manager',
          })
        ).status,
        403,
      );
      if (type === 'draw') {
        assert.equal(
          (await f.request('draw/dissolve', 'manager', { code, confirmed: true })).status,
          403,
        );
        assert.equal(
          (
            await f.request('action', 'manager', {
              code,
              action: 'transfer-host',
              playerId: manager.me,
            })
          ).status,
          403,
        );
      }
      if (settings[type]) {
        assert.equal((await configure('manager')).status, 200);
        assert.equal(
          (
            await configure('member', {
              ...settings[type],
              role: 'manager',
              isHost: true,
              canManageSettings: true,
            })
          ).status,
          403,
        );
        // Serialized writes use the server snapshot: another manager/host's accepted
        // settings become the canonical values for all viewers.
        assert.equal((await configure('host')).status, 200);
        const host = await f.state(code, 'host');
        const peer = await f.state(code, 'member');
        assert.deepEqual(peer.options || peer.settings, host.options || host.settings);
      }
      await f.role(code, 'member');
      assert.equal((await f.state(code)).permissions.canStartGame, false);
      assert.equal((await f.request('start', 'manager', { code })).status, 403);
      if (settings[type]) assert.equal((await configure('manager')).status, 403);
      await f.role(code, 'manager');
      assert.equal((await f.request('start', 'member', { code })).status, 403);
      const started = await f.request('start', 'manager', { code });
      assert.equal(started.status, 200, JSON.stringify(started.body));
      assert.notEqual(started.body.phase, 'waiting');
      if (settings[type])
        assert.notEqual((await configure('manager')).status, 200, 'in-game settings remain locked');
      assert.notEqual(
        (await f.request('start', 'manager', { code })).status,
        200,
        'double start remains rejected',
      );
      if (['telephone', 'musicquiz', 'minimal', 'bluff', 'quacks'].includes(type)) {
        assert.equal((await f.request('leave', 'other', { code })).status, 200);
        assert.equal((await f.state(code)).phase, 'finished');
        const replay = await f.request('start', 'manager', { code });
        assert.equal(replay.status, 200, JSON.stringify(replay.body));
        assert.notEqual(replay.body.phase, 'finished');
      }
    });
  }
});

test('manager leaving and rejoining loses settings/start rights immediately; multiple managers remain independent', async (t) => {
  const f = await fixture(t),
    code = await f.create('draw');
  await f.role(code, 'manager');
  await f.role(code, 'manager', 'other');
  assert.equal((await f.request('reconnect', 'manager', { code })).status, 200);
  assert.equal((await f.state(code)).permissions.canManageSettings, true);
  assert.equal((await f.request('leave', 'manager', { code })).status, 200);
  assert.equal((await f.request('settings', 'manager', { code, ...settings.draw })).status, 403);
  assert.equal((await f.request('join', 'manager', { code })).status, 200);
  assert.equal((await f.state(code)).permissions.canManageSettings, false);
  assert.equal((await f.request('start', 'manager', { code })).status, 403);
  assert.equal((await f.state(code, 'other')).permissions.canStartGame, true);
  await f.role(code, 'member', 'other');
  assert.equal((await f.state(code, 'other')).permissions.canStartGame, false);
});
