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
  const roomCommand = (cookie, action, roomId) =>
    request('lobby/arena-room', cookie, { action, roomId });
  const arenaCommand = (cookie, action, options = {}) =>
    request('lobby/arena?arena=1', cookie, { action, ...options });
  assert.equal((await arenaCommand(owner, 'team', { team: 'red' })).status, 409);
  const createRoom = (cookie, roomName) =>
    request('lobby/arena-room', cookie, { action: 'create', roomName });
  const first = await createRoom(owner, '  週末友誼賽  ');
  const firstId = first.body.arenaRoom.currentId;
  const second = await roomCommand(guest, 'create');
  const secondId = second.body.arenaRoom.currentId;
  assert.notEqual(firstId, secondId);
  assert.equal(second.body.arenaRoom.rooms.find((room) => room.id === firstId).name, '週末友誼賽');
  assert.match(
    second.body.arenaRoom.rooms.find((room) => room.id === secondId).name,
    /^競技場 \d+$/,
  );
  assert.equal((await createRoom(owner, '長'.repeat(25))).status, 400);
  assert.equal((await createRoom(owner, 123)).status, 400);
  assert.equal((await request('lobby?arena=1', owner)).body.arenaRoom.currentId, firstId);
  assert.equal(second.body.arenaRoom.rooms.length, 2);
  const setup = await arenaCommand(owner, 'archetype', { archetype: 'defense' });
  assert.equal(setup.body.arena.ownArchetype, 'defense');
  assert.equal(setup.body.arena.teams.length, 0);
  assert.equal(setup.body.arena.maps.length, 5);
  assert.equal(setup.body.arena.maps.filter((map) => !map.wide).length, 2);
  const maps = setup.body.arena.maps;
  assert.equal(new Set(maps.map((map) => map.name)).size, 5);
  assert.ok(maps[1].preview.walls.some((wall) => wall.id.startsWith('wall-x-')));
  assert.ok(!maps[0].preview.walls.some((wall) => wall.id.startsWith('wall-x-')));
  assert.equal(
    new Set(
      maps.map((map) =>
        JSON.stringify(
          map.preview.walls
            .filter((wall) => wall.id.startsWith('map-wall'))
            .map(({ width, height }) => [width, height]),
        ),
      ),
    ).size,
    5,
  );
  assert.equal(
    maps[2].preview.bushes.filter((zone) => zone.id.startsWith('wing-bush-extra')).length,
    3,
  );
  assert.equal(
    maps[4].preview.hazards.filter((zone) => zone.id.startsWith('wing-trap-extra')).length,
    3,
  );
  await arenaCommand(owner, 'team', { team: 'red' });
  await arenaCommand(guest, 'team', { team: 'blue' });
  assert.equal((await request('lobby?arena=1', owner)).body.arena.teams.length, 1);
  assert.equal((await roomCommand(guest, 'join', firstId)).body.arenaRoom.currentId, firstId);
  const assigned = await arenaCommand(guest, 'team', { team: 'random' });
  assert.equal(assigned.body.arena.teams.find((p) => p.id === assigned.body.selfId).team, 'blue');
  const startPk = () => arenaCommand(owner, 'start', { mode: 'pk' });
  assert.equal((await arenaCommand(owner, 'ready', { ready: true })).status, 200);
  assert.equal((await startPk()).status, 409);
  assert.equal((await arenaCommand(guest, 'ready', { ready: true })).status, 200);
  assert.equal(
    (await arenaCommand(owner, 'start', { mode: 'pk', durationSeconds: 60, mapId: 3 })).status,
    400,
  );
  const roomMatch = await startPk();
  assert.equal(roomMatch.body.arena.expanded, undefined);
  const preview = setup.body.arena.maps[0].preview;
  assert.deepEqual(roomMatch.body.arena.covers, preview.walls);
  assert.deepEqual(roomMatch.body.arena.hazards, preview.hazards);
  assert.deepEqual(roomMatch.body.arena.bushes, preview.bushes);
  assert.equal(roomMatch.body.arena.maps, undefined);
  assert.equal(roomMatch.status, 200);
  assert.equal(roomMatch.body.arena.match.players.length, 2);
  assert.equal(
    roomMatch.body.arena.match.players.find((p) => p.id === roomMatch.body.selfId).archetype,
    'defense',
  );
  assert.equal((await roomCommand(guest, 'create')).body.arena.match, null);
  const oldRoom = await request('lobby?arena=1', owner);
  assert.equal(oldRoom.body.arena.match.players.filter((player) => player.forfeited).length, 1);
  assert.equal(oldRoom.body.arenaRoom.rooms.length, 2);
});
