'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
test('unowned brawl equipment is temporary, bot-inclusive and isolated from profile and new rooms', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('brawl_owner', 'test-password-123'),
  });
  let cookie = '';
  const api = async (route, body) => {
    const r = await fetch(base + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (route === 'auth/login') cookie = r.headers.get('set-cookie').split(';')[0];
    return { status: r.status, body: await r.json() };
  };
  await api('auth/login', { username: 'brawl_owner', password: 'test-password-123' });
  const profile = (await api('profile/attacks')).body,
    owned = (await api('achievements')).body.bonusRewards;
  assert.equal(profile.r, '');
  await api('lobby/arena-room', { action: 'create', roomName: '隨機測試' });
  await api('lobby?arena=1');
  await api('lobby/arena?arena=1', { action: 'team', team: 'red' });
  const bots = await api('lobby/bots?arena=1', { action: 'add', team: 'red' });
  assert.equal(bots.status, 200, JSON.stringify(bots.body));
  await api('lobby/arena?arena=1', { action: 'ready', ready: true });
  const start = await api('lobby/arena?arena=1', {
    action: 'start',
    mode: 'brawl',
    mapId: 5,
    durationSeconds: 60,
    matchId: null,
  });
  assert.equal(start.status, 200);
  const match = start.body.arena.match;
  assert.equal(match.players.length, 2);
  assert.equal(match.mode, 'brawl');
  assert.ok(match.players.every((p) => p.loadout.r && p.entrance));
  assert.ok([1, 2].includes(match.mapId));
  assert.ok(match.players.some((p) => p.id.startsWith('scene-bot:')));
  assert.deepEqual((await api('profile/attacks')).body, profile);
  assert.deepEqual((await api('achievements')).body.bonusRewards, owned);
  assert.equal(
    (
      await api('lobby/attack?arena=1', {
        requestId: 'reject-brawl-injection',
        slot: 'q',
        effect: 'explosion',
        aspectRatio: 1,
      })
    ).status,
    400,
  );
  const left = await api('lobby/arena?arena=1', { action: 'leave', matchId: match.id });
  assert.equal(left.status, 200);
  await api('lobby/arena-room', { action: 'create', roomName: '另一個房間' });
  const next = await api('lobby?arena=1');
  assert.equal(next.body.arena.match, null);
  assert.equal(
    (
      await api('lobby/attack?arena=1', {
        requestId: 'after-random-r-no-grant',
        slot: 'r',
        aspectRatio: 1,
      })
    ).body.code,
    'NO_MULTI_ATTACK_LOADOUT',
  );
  assert.deepEqual((await api('profile/attacks')).body, profile);
});
