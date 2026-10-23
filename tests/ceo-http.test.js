'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');

test('CEO HTTP: disabled by default until reviewed UI is available', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('ceo_owner', 'synthetic-ceo-password'),
  });
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ceo_owner', password: 'synthetic-ceo-password' }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const res = await fetch(base + '/api/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ type: 'ceo' }),
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, 'GAME_NOT_ENABLED');
});

test('CEO HTTP: authenticated game, secrecy, receipt retry, listing, history, leave and restart', async (t) => {
  const { base } = await appFixture(t, {
    config: { ceoEnabled: true, achievementPurpose: 'test', marketAutomationEnabled: false },
    seed: (db) => createAuth(db).bootstrap('ceo_owner', 'synthetic-ceo-password'),
  });
  async function post(path, cookie, data = {}, expected = 200) {
    const res = await fetch(base + '/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    assert.equal(res.status, expected, JSON.stringify(body));
    return { body, cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }
  const owner = (
    await post('auth/login', null, { username: 'ceo_owner', password: 'synthetic-ceo-password' })
  ).cookie;
  const cookies = [owner];
  for (let i = 1; i < 4; i++) {
    const invite = (await post('admin/invites', owner)).body.code;
    cookies.push(
      (
        await post('auth/register', null, {
          username: `ceo_peer_${i}`,
          displayName: `CEO玩家${i}`,
          password: 'synthetic-ceo-password',
          confirmPassword: 'synthetic-ceo-password',
          invite,
        })
      ).cookie,
    );
  }
  async function get(path, cookie, expected = 200) {
    const res = await fetch(base + '/api/' + path, { headers: { Cookie: cookie } });
    const body = await res.json();
    assert.equal(res.status, expected, JSON.stringify(body));
    return body;
  }
  await post('create', null, { type: 'ceo' }, 401);
  const { code } = (await post('create', owner, { type: 'ceo' })).body;
  for (const cookie of cookies.slice(1, 3)) await post('join', cookie, { code });
  await post('start', cookies[1], { code }, 403);
  await get('state?code=' + code, cookies[3], 403);
  let s = (await post('start', owner, { code })).body;
  assert.equal(s.catalogStatus, 'provisional');
  assert.equal(s.game.catalogStatus, 'provisional');
  assert.equal(s.game.players.length, 3);
  const seats = new Map();
  for (const cookie of cookies.slice(0, 3))
    seats.set((await get('state?code=' + code, cookie)).me, cookie);
  const originalActor = s.game.turnId;
  const request = {
    code,
    action: 'dividend',
    roundId: s.roundId,
    requestId: randomUUID(),
    expectedRevision: s.game.revision,
  };
  const retry = (await post('action', seats.get(originalActor), request)).body;
  const repeated = (await post('action', seats.get(originalActor), request)).body;
  assert.equal(repeated.game.revision, retry.game.revision);
  assert.deepEqual(repeated.game.players, retry.game.players);
  assert.equal(repeated.version, retry.version);
  const conflict = await post(
    'action',
    seats.get(originalActor),
    { ...request, expectedRevision: 100 },
    409,
  );
  assert.equal(conflict.body.code, 'REQUEST_CONFLICT');
  const listed = (await get('rooms', owner)).rooms.find((room) => room.code === code);
  assert.equal(listed.type, 'ceo');
  assert.equal(listed.playerCount, 3);
  assert.equal(listed.maxPlayers, 6);
  assert.equal(
    (await get('rooms', cookies[3])).rooms.find((room) => room.code === code).joinable,
    false,
  );
  await post('join', cookies[3], { code }, 409);
  const active = (await get('history', owner)).find((match) => match.room === code);
  assert.equal(active.status, 'playing');
  await get('history/' + active.id, owner, 400);
  s = repeated;
  let didSecretCheck = false;
  for (let step = 0; step < 300 && s.phase !== 'finished'; step++) {
    const state = s.game;
    const actor = state.turnId;
    const person = state.players.find((player) => player.id === actor);
    const affordable = state.market.find(
      (entry) => entry.card.assets + entry.extraCost <= person.cash,
    );
    s = (
      await post('action', seats.get(actor), {
        code,
        action: affordable ? 'acquire' : 'dividend',
        ...(affordable ? { companyId: affordable.card.id } : {}),
        roundId: s.roundId,
        requestId: randomUUID(),
        expectedRevision: state.revision,
      })
    ).body;
    if (
      !didSecretCheck &&
      s.phase === 'playing' &&
      s.game.groups.some((group) => group.adjustmentCount)
    ) {
      for (const [id, cookie] of seats) {
        const personal = await get('state?code=' + code, cookie);
        for (const group of personal.game.groups) {
          if (group.playerId !== id) assert.equal(group.adjustments, null);
        }
        assert.ok(!JSON.stringify(personal).includes('"deck"'));
      }
      didSecretCheck = true;
    }
  }
  assert.equal(s.phase, 'finished');
  assert.equal(s.interrupted, false);
  assert.ok(didSecretCheck);
  assert.equal(s.game.results.players.length, 3);
  const completed = (await get('history', owner)).find((match) => match.id === active.id);
  assert.equal(completed.status, 'finished');
  const archive = await get('history/' + completed.id, owner);
  assert.ok(JSON.stringify(archive).includes('provisionalCatalog'));
  assert.ok(JSON.stringify(archive).includes('rulesCore'));
  assert.ok(!JSON.stringify(archive).includes('"secret"'));
  assert.equal(
    (await get('rooms', cookies[3])).rooms.find((room) => room.code === code).joinable,
    true,
  );
  const added = (await post('join', cookies[3], { code })).body;
  const newView = await get('state?code=' + code, cookies[3]);
  assert.equal(newView.game, null);
  assert.ok(added);
  s = (await post('start', owner, { code })).body;
  assert.equal(s.game.players.length, 4);
  assert.equal(s.game.revision, 0);
  await post('leave', cookies[3], { code });
  s = await get('state?code=' + code, owner);
  assert.equal(s.interrupted, true);
  assert.equal(s.game, null);
  const interrupted = (await get('history', owner)).filter(
    (match) => match.room === code && match.id !== completed.id,
  );
  assert.equal(interrupted[0].status, 'interrupted');
});
