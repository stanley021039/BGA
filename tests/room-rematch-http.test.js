'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
const { createApp } = require('../src/app');

test('three authenticated seats see rematch waiting after reconnect/restart without a debug history recorder', async (t) => {
  let restarted;
  t.after(() => restarted?.close());
  const f = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('rematch_host', 'synthetic-password'),
  });
  let base = f.base;
  const cookies = [];
  async function call(i, route, body, expected = 200) {
    const res = await fetch(base + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookies[i] ? { Cookie: cookies[i] } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    assert.equal(res.status, expected, route + ' ' + JSON.stringify(data));
    if (res.headers.has('set-cookie')) cookies[i] = res.headers.get('set-cookie').split(';')[0];
    return data;
  }
  await call(0, 'auth/login', { username: 'rematch_host', password: 'synthetic-password' });
  for (let i = 1; i < 3; i++) {
    const invite = await call(0, 'admin/invites', {});
    await call(i, 'auth/register', {
      username: 'rematch_peer' + i,
      password: 'synthetic-password',
      confirmPassword: 'synthetic-password',
      invite: invite.code,
    });
  }
  const { code } = await call(0, 'create', { type: 'majority' });
  for (let i = 1; i < 3; i++) await call(i, 'join', { code });
  await call(0, 'settings', { code, rounds: 3 });
  await call(0, 'start', { code });
  const state = (i) => call(i, 'state?code=' + code);
  const initial = await state(0),
    ids = initial.players.map((p) => p.id);
  await call(1, 'rematch', { code }, 403);
  await call(0, 'rematch', { code }, 409);
  for (let round = 1; round <= 3; round++) {
    const s = await state(0),
      presenter = ids.indexOf(s.presenterId);
    await call(presenter, 'action', {
      code,
      action: 'ask',
      type: 'two',
      prompt: '第' + round + '題',
      options: ['A', 'B'],
    });
    for (let i = 0; i < 3; i++) await call(i, 'action', { code, action: 'answer', answer: 0 });
    await call(0, 'action', { code, action: 'next' });
  }
  assert.equal((await state(0)).phase, 'finished');
  await call(0, 'history', undefined, 404);
  await call(0, 'room-role', { code, playerId: ids[1], role: 'manager' });
  const waiting = await call(1, 'rematch', { code });
  assert.equal(waiting.phase, 'waiting');
  assert.ok(waiting.version > initial.version);
  assert.equal(waiting.roomInstanceId, initial.roomInstanceId);
  for (let i = 0; i < 3; i++) {
    await call(i, 'reconnect', { code });
    const s = await state(i);
    assert.equal(s.phase, 'waiting');
    assert.deepEqual(
      s.players.map((p) => p.id),
      ids,
    );
    assert.deepEqual(s.answeredIds, []);
    assert.equal(s.result, null);
    assert.equal(s.question, null);
    assert.equal(s.options.rounds, 3);
  }
  await call(0, 'history', undefined, 404);
  await f.app.close();
  restarted = createApp(f.config);
  base = 'http://127.0.0.1:' + (await restarted.listen()).port;
  for (let i = 0; i < 3; i++) assert.equal((await state(i)).phase, 'waiting');
  await call(0, 'start', { code });
  const next = await state(0);
  assert.equal(next.phase, 'choosing');
  assert.equal(next.round, 1);
  assert.ok(next.players.every((p) => p.score === 0));
  assert.deepEqual(next.answeredIds, []);
});
