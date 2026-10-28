'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs'),
  path = require('node:path');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
const { games } = require('../src/rooms/spectator');

async function fixture(t, config = {}) {
  const password = 'synthetic-spectator-' + randomUUID();
  const f = await appFixture(t, {
    config: { ceoEnabled: true, secondWindEnabled: true, ...config },
    seed: async (db) => {
      await createAuth(db).bootstrap('watch_host', password);
      const hash = db
        .prepare('SELECT password_hash FROM users WHERE username=?')
        .get('watch_host').password_hash;
      db.prepare(
        'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
      ).run(randomUUID(), 'watch_guest', '觀戰朋友', hash, 'member', new Date().toISOString());
    },
  });
  const cookies = {};
  async function request(
    who,
    route,
    body,
    expected = 200,
    method = body === undefined ? 'GET' : 'POST',
  ) {
    const response = await fetch(f.base + '/api/' + route, {
      method,
      headers: {
        Cookie: cookies[who] || '',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    assert.equal(response.status, expected, route + ': ' + JSON.stringify(data));
    if (response.headers.has('set-cookie'))
      cookies[who] = response.headers.get('set-cookie').split(';')[0];
    return data;
  }
  for (const who of ['host', 'guest'])
    await request(who, 'auth/login', { username: 'watch_' + who, password });
  return { ...f, request, cookies };
}

test('every room type exposes GET-only authenticated observation without seats, player commands or private controller state', async (t) => {
  const f = await fixture(t),
    call = f.request;
  for (const type of Object.keys(games))
    await t.test(type, async () => {
      const { code } = await call('host', 'create', { type });
      if (type !== 'lounge') {
        await call('host', 'bot', { code });
        await call('host', 'bot', { code });
      }
      const count = type === 'lounge' ? 1 : 3;
      const before = await call('host', 'state?code=' + code);
      const v = await call('guest', 'watch?code=' + code.toLowerCase());
      assert.equal(v.type, type);
      assert.equal(v.spectator, true);
      assert.equal(v.players.length, count);
      const serialized = JSON.stringify(v);
      for (const p of before.players) assert.equal(serialized.includes(p.id), false);
      for (const field of [
        'roomSpace',
        'roomMedia',
        'permissions',
        'ownAnswer',
        'mine',
        'secretAnswer',
        'drafts',
      ])
        assert.equal(Object.hasOwn(v, field), false);
      await call('none', 'watch?code=' + code, undefined, 401);
      await call('host', 'watch?code=' + code, undefined, 409);
      await call('guest', 'watch', { code }, 405);
      await call('guest', 'state?code=' + code, undefined, 403);
      await call('guest', 'action', { code, action: 'skip', requestId: randomUUID() }, 403);
      await call('guest', 'start', { code }, 403);
      const after = await call('host', 'state?code=' + code);
      assert.deepEqual(
        after.players.map((p) => p.id),
        before.players.map((p) => p.id),
      );
      if (type !== 'lounge') {
        await call('host', 'start', { code });
        const started = await call('guest', 'watch?code=' + code);
        assert.notEqual(started.phase, 'waiting');
        assert.equal(started.players.length, 3);
      }
    });
});

test('observers follow same-room game changes and rematches; joining or being kicked revokes observation', async (t) => {
  const f = await fixture(t),
    call = f.request;
  const { code } = await call('host', 'create', { type: 'majority' });
  await call('host', 'bot', { code });
  await call('host', 'bot', { code });
  const initial = await call('guest', 'watch?code=' + code);
  await call('host', 'change-game', {
    code,
    gameType: 'majority',
    gameRevision: 0,
    targetType: 'telephone',
  });
  let v = await call('guest', 'watch?code=' + code);
  assert.equal(v.type, 'telephone');
  assert.ok(v.gameRevision > initial.gameRevision);
  assert.deepEqual(v.books, []);
  const context = { code, gameType: 'telephone', gameRevision: v.gameRevision };
  const s = await call('host', 'start', context);
  assert.equal((await call('guest', 'watch?code=' + code)).drawing, null);
  await call('host', 'kick', { code, playerId: s.players.find((p) => p.bot).id, confirmed: true });
  await call('host', 'rematch', context);
  v = await call('guest', 'watch?code=' + code);
  assert.equal(v.phase, 'waiting');
  assert.deepEqual(v.books, []);
  assert.equal(v.deadline, null);
  const joined = await call('guest', 'join', { code });
  await call('guest', 'watch?code=' + code, undefined, 409);
  const state = await call('host', 'state?code=' + code);
  await call('host', 'kick', {
    code,
    playerId: state.players.find((p) => p.name === '觀戰朋友').id,
    confirmed: true,
  });
  await call('guest', 'watch?code=' + code, undefined, 403);
  assert.equal(joined.code, code);
  await call('guest', 'watch?code=FFFFFF', undefined, 404);
});

test('spectator native song audio is authenticated, current-round scoped, range readable and never grants player access', async (t) => {
  const { MusicQuizRoom } = require('../src/games/musicquiz'),
    { CATALOG } = require('../src/games/musicquiz-library');
  const current = CATALOG[0],
    start = MusicQuizRoom.prototype.start;
  t.mock.method(MusicQuizRoom.prototype, 'start', function () {
    start.call(this);
    this.current = current;
    this.phase = 'intro';
    this.deadline = this.now() + 30000;
  });
  let audioDir;
  const f = await fixture(t, { gameAudioDir: undefined });
  audioDir = path.join(f.root, 'game-audio');
  fs.mkdirSync(path.join(audioDir, 'clips'), { recursive: true });
  const clip = 'clips/' + current.videoId + '.intro.mp3';
  fs.writeFileSync(path.join(audioDir, clip), Buffer.alloc(128000, 123));
  fs.writeFileSync(
    path.join(audioDir, 'manifest.json'),
    JSON.stringify({
      songs: {
        [current.id]: {
          videoId: current.videoId,
          status: 'ready',
          clips: { intro: { file: clip, start: current.introStart, seconds: 8, reviewed: false } },
        },
      },
    }),
  );
  const { code } = await f.request('host', 'create', { type: 'musicquiz' });
  await f.request('host', 'start', { code });
  const state = await f.request('guest', 'watch?code=' + code),
    media = state.clips[0].playback;
  assert.equal(media.provider, 'audio');
  assert.ok(media.url.startsWith('/api/watch-audio?'));
  const get = (suffix, options = {}) =>
    fetch(f.base + suffix, {
      ...options,
      headers: { Cookie: f.cookies.guest, ...options.headers },
    });
  const ranged = await get(media.url, { headers: { Range: 'bytes=0-9' } });
  assert.equal(ranged.status, 206);
  assert.equal((await ranged.arrayBuffer()).byteLength, 10);
  assert.equal(ranged.headers.get('cache-control'), 'no-store');
  assert.equal((await get(media.url, { method: 'HEAD' })).status, 200);
  assert.equal((await fetch(f.base + media.url)).status, 401);
  assert.equal((await get(media.url.replace('roundId=', 'roundId=stale-'))).status, 404);
  assert.equal(
    (
      await get(media.url, {
        method: 'POST',
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
      })
    ).status,
    405,
  );
  assert.equal(
    (await get(media.url.replace('/api/watch-audio?', '/api/game-song-audio?'))).status,
    403,
  );
});
