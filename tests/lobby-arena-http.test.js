'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
test('authenticated arena HTTP commands broadcast snapshots and practice stays owner isolated', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('arena_owner', 'test-password-123'),
  });
  async function request(route, cookie, body) {
    const response = await fetch(base + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  assert.equal((await request('lobby/arena', null, { action: 'team', team: 'red' })).status, 401);
  const owner = (
    await request('auth/login', null, { username: 'arena_owner', password: 'test-password-123' })
  ).cookie;
  const invite = (await request('admin/invites', owner, { days: 1 })).body.code;
  const guest = (
    await request('auth/register', null, {
      username: 'arena_guest',
      password: 'test-password-123',
      confirmPassword: 'test-password-123',
      invite,
    })
  ).cookie;
  const a = await request('lobby/arena', owner, { action: 'team', team: 'red' });
  assert.equal(a.status, 200);
  assert.equal(a.body.arena.teams.length, 1);
  assert.ok(a.body.serverNow);
  assert.equal((await request('lobby/arena', guest, { action: 'team', team: 'blue' })).status, 200);
  const before = await request('lobby', owner);
  const practice = await request('lobby/practice', owner, { action: 'start' });
  assert.equal(practice.status, 200);
  assert.equal(practice.body.step, 0);
  assert.equal((await request('lobby/practice', guest, { action: 'next', step: 0 })).status, 404);
  for (let step = 0; step < 5; step++)
    assert.equal((await request('lobby/practice', owner, { action: 'next', step })).status, 200);
  const after = await request('lobby', owner);
  assert.deepEqual(after.body.arena, before.body.arena);
  assert.equal(
    (await request('lobby/arena', owner, { action: 'team', team: 'green' })).status,
    400,
  );
  const started = await request('lobby/arena', owner, {
    action: 'start',
    mode: 'pk',
    matchId: null,
  });
  assert.equal(started.status, 200);
  assert.equal(started.body.arena.match.players.length, 2);
  const shared = await request('lobby', guest);
  assert.equal(shared.body.arena.match.id, started.body.arena.match.id);
  assert.equal((await request('lobby/arena', guest, { action: 'team', team: 'red' })).status, 409);
  assert.equal(
    (await request('lobby/arena', guest, { action: 'leave', matchId: started.body.arena.match.id }))
      .status,
    200,
  );
  assert.equal(
    (await request('lobby', owner)).body.arena.match.players.find(
      (p) => p.id === shared.body.selfId,
    ).forfeited,
    true,
  );
});
