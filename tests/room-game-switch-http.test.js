'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
const { createApp } = require('../src/app');

test('three authenticated seats change games, preserve media/roles, reject stale actions and reconnect after restart', async (t) => {
  let restarted;
  t.after(() => restarted?.close());
  const f = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('switch_host', 'synthetic-password'),
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
  await call(0, 'auth/login', { username: 'switch_host', password: 'synthetic-password' });
  for (let i = 1; i < 3; i++) {
    const invite = await call(0, 'admin/invites', {});
    await call(i, 'auth/register', {
      username: 'switch_peer' + i,
      password: 'synthetic-password',
      confirmPassword: 'synthetic-password',
      invite: invite.code,
    });
  }
  const { code } = await call(0, 'create', { type: 'majority' });
  for (let i = 1; i < 3; i++) await call(i, 'join', { code });
  const state = (i = 0) => call(i, 'state?code=' + code);
  const initial = await state(),
    ids = initial.players.map((p) => p.id);
  await call(0, 'room-role', { code, playerId: ids[1], role: 'manager' });
  const media = () => call(0, 'room-media?code=' + code);
  async function mediaAct(action, extra = {}) {
    const m = await media();
    return call(0, 'room-media', {
      code,
      action,
      requestId: randomUUID(),
      roomInstanceId: m.roomInstanceId,
      playbackSessionId: m.playbackSessionId,
      expectedRevision: m.revision,
      ...extra,
    });
  }
  await mediaAct('enqueue', {
    type: 'video',
    url: 'https://youtu.be/M7lc1UVf-VE',
    title: 'Current video',
  });
  await mediaAct('enqueue', {
    type: 'video',
    url: 'https://youtu.be/dQw4w9WgXcQ',
    title: 'Queued video',
  });
  await mediaAct('seek', { positionSec: 42 });
  const before = await media();
  const input = { code, gameType: 'majority', gameRevision: 0, targetType: 'draw' };
  assert.equal((await call(1, 'change-game', input, 403)).code, 'HOST_ONLY');
  await call(0, 'change-game?code=' + code, undefined, 405);
  const switched = await call(0, 'change-game', input);
  assert.equal(switched.gameRevision, 1);
  for (let i = 0; i < 3; i++) {
    assert.equal((await call(i, 'reconnect', { code })).type, 'draw');
    const s = await state(i);
    assert.equal(s.type, 'draw');
    assert.equal(s.phase, 'waiting');
    assert.equal(s.me, ids[i]);
    assert.deepEqual(
      s.players.map((p) => p.id),
      ids,
    );
  }
  assert.equal((await state(1)).permissions.role, 'manager');
  const preserved = [
    'roomInstanceId',
    'playbackSessionId',
    'revision',
    'current',
    'queue',
    'playback',
  ];
  const after = await media();
  for (const key of preserved) assert.deepEqual(after[key], before[key], key);
  assert.equal((await call(0, 'change-game', input, 409)).code, 'ROOM_GAME_CHANGED');
  assert.equal((await call(0, 'start', { code }, 409)).code, 'ROOM_GAME_CHANGED');
  assert.equal(
    (await call(0, 'settings', { code, gameType: 'majority', gameRevision: 0, rounds: 9 }, 409))
      .code,
    'ROOM_GAME_CHANGED',
  );
  await call(0, 'settings', { code, gameType: 'draw', gameRevision: 1, seconds: 60 });
  await f.app.close();
  restarted = createApp(f.config);
  base = 'http://127.0.0.1:' + (await restarted.listen()).port;
  for (let i = 0; i < 3; i++) {
    assert.equal((await call(i, 'reconnect', { code })).type, 'draw');
    assert.equal((await state(i)).gameRevision, 1);
  }
  await call(0, 'start', { code, gameType: 'draw', gameRevision: 1 });
  assert.notEqual((await state()).phase, 'waiting');
  assert.equal(
    (
      await call(
        0,
        'change-game',
        { code, gameType: 'draw', gameRevision: 1, targetType: 'gift' },
        409,
      )
    ).code,
    'ROOM_NOT_WAITING',
  );
});
