'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth'),
  { LoungeRoom } = require('../src/games/lounge'),
  { listRooms } = require('../src/rooms/listing');

// 場外休憩區 (#277): a non-game room for up to 10 people.
test('lounge seats 10, never starts a match and stays joinable after someone leaves', () => {
  const room = new LoungeRoom('ABCDEF', '場外休憩區'),
    players = Array.from({ length: 10 }, (_, i) => room.add('朋友' + i));
  assert.throws(() => room.add('第十一位'), { code: 'ROOM_FULL' });
  assert.throws(() => room.start(), { code: 'NO_MATCH' });
  assert.throws(() => room.act(players[0].id, 'anything', {}), { code: 'INVALID_ACTION' });
  const listed = () => listRooms(new Map([[room.code, room]]), new Map(), new Map(), 'visitor')[0];
  assert.deepEqual(
    [listed().type, listed().playerCount, listed().maxPlayers, listed().joinable],
    ['lounge', 10, 10, false],
  );
  room.kick(room.host, players[4].id, true);
  assert.equal(room.phase, 'waiting');
  assert.equal(listed().joinable, true);
  assert.equal(room.view(players[0].id).type, 'lounge');
});

test('lounge rooms open without a test AI, list in 找一桌加入 and refuse game-only actions', async (t) => {
  const { base } = await appFixture(t, {
    config: { achievementPurpose: 'test', marketAutomationEnabled: false },
    seed: (db) => createAuth(db).bootstrap('lounge_owner', 'synthetic-lounge-password'),
  });
  async function call(route, cookie, data = {}) {
    const res = await fetch(base + '/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(data),
    });
    return {
      status: res.status,
      body: await res.json(),
      cookie: res.headers.get('set-cookie')?.split(';')[0],
    };
  }
  const owner = (
    await call('auth/login', null, {
      username: 'lounge_owner',
      password: 'synthetic-lounge-password',
    })
  ).cookie;
  const created = await call('create', owner, { type: 'lounge' });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.type, 'lounge');
  const { code } = created.body;
  const rooms = (await (await fetch(base + '/api/rooms', { headers: { Cookie: owner } })).json())
    .rooms;
  assert.deepEqual(
    rooms.map((room) => [room.code, room.type, room.name, room.maxPlayers, room.seated]),
    [[code, 'lounge', '場外休憩區', 10, true]],
  );
  assert.equal((await call('start', owner, { code })).body.code, 'NO_MATCH');
  assert.equal((await call('rebuy', owner, { code })).status >= 400, true);
  // Without a frontend build the route answers 503; an unregistered room path would be 404.
  const page = await fetch(base + '/lounge/' + code, { headers: { Cookie: owner } });
  assert.notEqual(page.status, 404);
});
