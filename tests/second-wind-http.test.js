'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
test('Second Wind HTTP: isolated feature gate, seats, private projection, retries, listing and history', async (t) => {
  const { base } = await appFixture(t, {
    config: { secondWindEnabled: true, marketAutomationEnabled: false },
    seed: (db) => createAuth(db).bootstrap('athlete_owner', 'synthetic-athlete-password'),
  });
  async function post(path, cookie, data, expected = 200) {
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
    await post('auth/login', null, {
      username: 'athlete_owner',
      password: 'synthetic-athlete-password',
    })
  ).cookie;
  const cookies = [owner];
  for (let i = 1; i < 3; i++) {
    const invite = (await post('admin/invites', owner, {})).body.code;
    cookies.push(
      (
        await post('auth/register', null, {
          username: 'athlete_peer_' + i,
          displayName: '選手' + i,
          password: 'synthetic-athlete-password',
          confirmPassword: 'synthetic-athlete-password',
          invite,
        })
      ).cookie,
    );
  }
  const { code } = (await post('create', owner, { type: 'second-wind' })).body;
  for (const cookie of cookies.slice(1)) await post('join', cookie, { code });
  await post('start', cookies[1], { code }, 403);
  let v = (await post('start', owner, { code })).body;
  const seats = new Map();
  for (const cookie of cookies) {
    const res = await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookie } });
    const view = await res.json();
    seats.set(view.me, cookie);
  }
  const payload = {
    code,
    action: 'roll',
    roundId: v.roundId,
    requestId: randomUUID(),
    expectedRevision: v.game.revision,
  };
  v = (await post('action', owner, payload)).body;
  const duplicate = (await post('action', owner, payload)).body;
  assert.equal(v.game.revision, duplicate.game.revision);
  await post('action', owner, { ...payload, expectedRevision: 999 }, 409);
  for (let n = 0; n < 120 && v.game.phase !== 'racing'; n++) {
    const g = v.game;
    let actor,
      action,
      data = {};
    if (['draft-rolloff', 'race-rolloff'].includes(g.phase)) {
      actor = g.players.find((id) => !Object.hasOwn(g.rolls, id));
      action = 'roll';
    } else if (g.phase === 'drafting') {
      actor = g.turnId;
      action = 'draft';
      data.racerId = g.market[0];
    } else if (g.phase === 'choosing') {
      actor = g.players.find((id) => !g.selectedIds.includes(id));
      action = 'select';
      data.racerId = g.teams[actor][0];
    } else break;
    v = (
      await post('action', seats.get(actor), {
        code,
        action,
        roundId: v.roundId,
        requestId: randomUUID(),
        expectedRevision: g.revision,
        ...data,
      })
    ).body;
    if (g.phase === 'choosing' && v.game.phase === 'choosing') {
      const other = g.players.find((id) => id !== actor),
        res = await fetch(base + '/api/state?code=' + code, {
          headers: { Cookie: seats.get(other) },
        }),
        view = await res.json();
      assert.notEqual(view.game.ownSelection, data.racerId);
      assert.equal(view.game.lineup, null);
    }
    assert.equal('reserve' in v.game, false);
    assert.equal('randomKey' in v.game, false);
  }
  assert.equal(v.game.phase, 'racing');
  const listed = await (await fetch(base + '/api/rooms', { headers: { Cookie: owner } })).json();
  assert.equal(listed.rooms.find((r) => r.code === code).playerCount, 3);
  const history = await (await fetch(base + '/api/history', { headers: { Cookie: owner } })).json();
  assert.ok(history.some((r) => r.room === code));
  await post('leave', cookies[1], { code });
  const ended = await (
    await fetch(base + '/api/state?code=' + code, { headers: { Cookie: owner } })
  ).json();
  assert.equal(ended.interrupted, true);
  assert.equal(ended.game, null);
});
test('Second Wind cannot create a room on legacy-only hosts', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('athlete_owner', 'synthetic-athlete-password'),
  });
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'athlete_owner', password: 'synthetic-athlete-password' }),
  });
  const res = await fetch(base + '/api/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: login.headers.get('set-cookie').split(';')[0],
    },
    body: JSON.stringify({ type: 'second-wind' }),
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, 'GAME_NOT_ENABLED');
  assert.equal((await fetch(base + '/second-wind/ABCDEF')).status, 404);
});
