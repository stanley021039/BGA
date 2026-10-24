'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');

test('every game exposes the same authenticated room scene without changing gameplay', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('scenehost', 'scene-test-password'),
  });
  async function post(route, cookie, data) {
    const response = await fetch(base + '/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(data),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  const login = await post('auth/login', null, {
    username: 'scenehost',
    password: 'scene-test-password',
  });
  const cookie = login.cookie;
  const invite = await post('admin/invites', cookie, { days: 1 });
  const other = await post('auth/register', null, {
    username: 'scenepeer',
    password: 'scene-test-password',
    confirmPassword: 'scene-test-password',
    invite: invite.body.code,
  });
  const types = [
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
  ];
  for (const type of types) {
    const created = await post('create', cookie, { type });
    assert.equal(created.status, 200, type);
    const code = created.body.code;
    const state = await (
      await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookie } })
    ).json();
    assert.equal(state.roomSpace.selfId, state.me, type);
    assert.equal(state.roomSpace.visitors.length, 1, type);
    assert.ok(state.roomSpace.visitors[0].maxHealth >= 11000, type);
    assert.equal((await post('room-space', null, { code, action: 'teleport' })).status, 401, type);
    assert.notEqual(
      (await post('room-space', other.cookie, { code, action: 'teleport' })).status,
      200,
      type,
    );
    const moved = await post('room-space', cookie, { code, action: 'step', dx: 1, dy: -1 });
    assert.equal(moved.status, 200, type);
    assert.equal(moved.body.roomSpace.visitors[0].moveId, 1, type);
    assert.equal(moved.body.phase, state.phase, type);
    assert.equal(moved.body.version, state.version, type);
    assert.deepEqual(moved.body.players, state.players, type);
    const teleported = await post('room-space', cookie, {
      code,
      action: 'teleport',
      entrance: 'runes',
    });
    assert.equal(teleported.status, 200, type);
    assert.equal(teleported.body.roomSpace.visitors[0].teleportId, 1, type);
    assert.equal(teleported.body.roomSpace.visitors[0].entrance, 'runes', type);
    for (const slot of ['q', 'e']) {
      const attack = await post('room-space', cookie, {
        code,
        action: 'attack',
        slot,
        aspectRatio: 1,
        requestId: 'all-scenes-' + type + '-' + slot,
      });
      // An empty room still reaches shared target validation for both loadout slots.
      assert.equal(attack.status, 409, type);
      assert.equal(attack.body.code, 'NO_ATTACK_TARGET', type);
    }
    await post('leave', cookie, { code });
  }
});
