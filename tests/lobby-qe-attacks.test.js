'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
const { createLobby } = require('../src/rooms/lobby');

test('Q and E have independent cooldowns, stable event artwork and deduplicated retries', () => {
  let time = 1000;
  const lobby = createLobby(() => time),
    a = { id: 'a', display_name: 'A' },
    b = { id: 'b', display_name: 'B' };
  lobby.view(a);
  lobby.view(b);
  const q = { slot: 'q', effect: 'blade_aura', aspectRatio: 1.5, requestId: 'request-qe-q' },
    e = { slot: 'e', effect: 'frost_spikes', aspectRatio: 1.5, requestId: 'request-qe-e' };
  const first = lobby.attack(a, q).attacks[0];
  assert.equal(first.slot, 'q');
  assert.equal(first.effect, 'blade_aura');
  assert.equal(first.toId, 'b');
  const both = lobby.attack(a, e).attacks;
  assert.equal(both.length, 2);
  assert.equal(both[1].effect, 'frost_spikes');
  assert.equal(lobby.attack(a, q).attacks.length, 2);
  assert.throws(
    () => lobby.attack(a, { ...q, effect: 'beam' }),
    (x) => x.code === 'REQUEST_CONFLICT',
  );
  for (const slot of ['q', 'e'])
    assert.throws(
      () => lobby.attack(a, { ...q, slot, requestId: 'request-cooldown-' + slot }),
      (x) => x.code === 'ATTACK_COOLDOWN',
    );
  for (const input of [
    { ...q, slot: 'f' },
    { ...q, effect: 'unknown' },
  ])
    assert.throws(
      () => lobby.attack(a, input),
      (x) => x.code === 'INVALID_ATTACK',
    );
  time += 2000;
  assert.equal(
    lobby.attack(a, { ...q, requestId: 'request-after-cooldown' }).attacks[0].effect,
    'blade_aura',
  );
});

test('account attack choices persist, preserve appearance changes, and determine HTTP event artwork', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('qe_owner', 'test-password-123'),
  });
  async function request(path, { method = 'GET', body, cookie } = {}) {
    const r = await fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get('set-cookie')?.split(';')[0],
    };
  }
  assert.equal((await request('/api/profile/attacks')).status, 401);
  const owner = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'qe_owner', password: 'test-password-123' },
  });
  const get = (path) => request(path, { cookie: owner.cookie }),
    post = (path, body) => request(path, { method: 'POST', body, cookie: owner.cookie });
  assert.deepEqual((await get('/api/profile/attacks')).body, { q: 'barrage', e: 'beam' });
  for (const body of [
    { q: 'unknown', e: 'beam' },
    { q: 'beam' },
    { q: 'beam', e: 'chains', other: true },
    [],
  ])
    assert.equal((await post('/api/profile/attacks', body)).status, 400);
  assert.equal(
    (await post('/api/profile/attacks', { q: 'blade_aura', e: 'chain_lightning' })).status,
    200,
  );
  const before = await get('/api/profile/settings');
  assert.equal((await post('/api/profile/settings', before.body)).status, 200);
  assert.deepEqual((await get('/api/profile/attacks')).body, {
    q: 'blade_aura',
    e: 'chain_lightning',
  });
  const invite = await post('/api/admin/invites', {}),
    peer = await request('/api/auth/register', {
      method: 'POST',
      body: {
        username: 'qe_peer',
        password: 'test-password-123',
        confirmPassword: 'test-password-123',
        invite: invite.body.code,
      },
    });
  assert.equal(peer.status, 200);
  assert.deepEqual((await request('/api/profile/attacks', { cookie: peer.cookie })).body, {
    q: 'barrage',
    e: 'beam',
  });
  await get('/api/lobby');
  await request('/api/lobby', { cookie: peer.cookie });
  const q = await post('/api/lobby/attack', {
    slot: 'q',
    requestId: 'request-http-q',
    aspectRatio: 1,
  });
  assert.equal(q.status, 200);
  assert.equal(q.body.attacks[0].effect, 'blade_aura');
  const e = await post('/api/lobby/attack', {
    slot: 'e',
    requestId: 'request-http-e',
    aspectRatio: 1,
  });
  assert.equal(e.status, 200);
  assert.equal(e.body.attacks[1].effect, 'chain_lightning');
  assert.equal(
    (
      await post('/api/lobby/attack', {
        slot: 'q',
        requestId: 'request-forged',
        aspectRatio: 1,
        effect: 'explosion',
      })
    ).status,
    400,
  );
});
