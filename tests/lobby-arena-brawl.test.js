'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createLobby } = require('../src/rooms/lobby');
const { createLobbyArena } = require('../src/rooms/lobby-arena');
const { types } = require('../src/rooms/archetypes');
const effects = require('../public/shared/attack-effects.json');
const { randomArenaLoadout } = require('../src/rooms/arena-random-loadout');
test('brawl assigns legal distinct ordinary slots and a full temporary loadout to all entrants', () => {
  let time = 1000;
  const original = { q: 'barrage', e: 'beam', r: '' };
  const lobby = createLobby(
    () => time,
    undefined,
    () => 0.5,
    () => false,
    { attackLoadout: () => original },
  );
  const users = Array.from({ length: 3 }, (_, i) => ({
    id: 'brawl-' + i,
    display_name: '亂鬥' + i,
  }));
  for (const user of users) {
    lobby.view(user, { entrance: 'classic' });
    lobby.arena(user, { action: 'team', team: 'red' });
    lobby.arena(user, { action: 'archetype', archetype: 'health' });
  }
  const started = lobby.arena(users[0], { action: 'start', mode: 'brawl', matchId: null });
  assert.equal(started.arena.match.mode, 'brawl');
  assert.equal(started.arena.match.players.length, 3);
  for (const p of started.arena.match.players) {
    assert.ok(Object.hasOwn(types, p.archetype));
    assert.ok(p.entrance);
    assert.notEqual(p.loadout.q, p.loadout.e);
    for (const slot of ['q', 'e', 'r']) {
      const e = effects.find((e) => e.id === p.loadout[slot]);
      assert.ok(e);
      assert.equal(!!(e.area || e.ultimate), slot === 'r');
    }
    assert.equal(started.visitors.find((v) => v.id === p.id).entrance, p.entrance);
  }
  const p = started.arena.match.players[0];
  const cast = lobby.attack(users[0], {
    requestId: 'brawl-fixed-choice',
    slot: 'q',
    effect: 'barrage',
    aspectRatio: 1.6,
  });
  assert.equal(cast.attacks.find((a) => a.fromId === users[0].id).effect, p.loadout.q);
  assert.throws(
    () => lobby.arena(users[0], { action: 'archetype', archetype: 'attack' }),
    (e) => e.code === 'ARENA_LOCKED',
  );
  lobby.view(users[0], { entrance: 'smoke' });
  assert.equal(
    lobby.view(users[0]).visitors.find((v) => v.id === users[0].id).entrance,
    p.entrance,
  );
  for (let i = 0; i < 13; i++) {
    time += 5000;
    for (const u of users) lobby.view(u);
  }
  const finished = lobby.view(users[0]);
  assert.equal(finished.arena.match.phase, 'finished');
  assert.equal(finished.visitors.find((v) => v.id === users[0].id).entrance, 'smoke');
  assert.equal(finished.visitors.find((v) => v.id === users[0].id).archetype, null);
  assert.deepEqual(original, { q: 'barrage', e: 'beam', r: '' });
  assert.throws(
    () => lobby.attack(users[0], { requestId: 'after-brawl-no-r', slot: 'r', aspectRatio: 1.6 }),
    (e) => e.code === 'NO_MULTI_ATTACK_LOADOUT',
  );
});
test('brawl permits same-team opponents, excludes observers and counts individual winners', () => {
  let time = 1000;
  const visitors = new Map(
    ['a', 'b', 'watcher'].map((id) => [id, { id, name: id, maxHealth: 100, health: 100 }]),
  );
  const arena = createLobbyArena(() => time);
  const user = (id) => ({ id });
  for (const id of ['a', 'b'])
    arena.command(user(id), { action: 'team', team: 'red' }, visitors, () => {});
  arena.command(user('a'), { action: 'start', mode: 'brawl', matchId: null }, visitors, () => {});
  const match = arena.view(visitors).match;
  assert.equal(arena.canPair('a', 'b'), true);
  assert.equal(arena.areAllies('a', 'b'), false);
  assert.equal(arena.canPair('a', 'watcher'), false);
  arena.onHit({ id: 'a', matchId: match.id, castId: 'one' }, visitors.get('b'), time, 5);
  time = 61000;
  arena.finish(time, visitors);
  assert.deepEqual(arena.view(visitors).match.winners, ['a']);
});
test('brawl honours readiness, randomizes only eligible map sizes and rejects a lone entrant', () => {
  const options = {
    expandedMap: true,
    requireReady: true,
    attackLoadout: () => ({ q: 'barrage', e: 'beam', r: '' }),
  };
  const lobby = createLobby(
    () => 1000,
    undefined,
    () => 0.5,
    () => false,
    options,
  );
  const a = { id: 'map-a', display_name: 'A' },
    b = { id: 'map-b', display_name: 'B' };
  lobby.view(a);
  lobby.view(b);
  lobby.arena(a, { action: 'team', team: 'red' });
  lobby.arena(a, { action: 'ready', ready: true });
  assert.throws(
    () => lobby.arena(a, { action: 'start', mode: 'brawl', matchId: null }),
    (e) => e.code === 'ARENA_PLAYERS',
  );
  lobby.arena(b, { action: 'team', team: 'red' });
  assert.throws(
    () => lobby.arena(a, { action: 'start', mode: 'brawl', matchId: null }),
    (e) => e.code === 'ARENA_NOT_READY',
  );
  lobby.arena(b, { action: 'ready', ready: true });
  const started = lobby.arena(a, {
    action: 'start',
    mode: 'brawl',
    durationSeconds: 60,
    mapId: 5,
    matchId: null,
  });
  assert.ok([1, 2].includes(started.arena.match.mapId));
  assert.deepEqual(lobby.view(b).arena.match, started.arena.match);
});
test('the server random pool includes alternate effects and valid R skills without modifying catalogs', () => {
  const before = JSON.stringify(effects);
  for (let i = 0; i < 50; i++) {
    const x = randomArenaLoadout();
    assert.ok(effects.find((e) => e.id === x.r && (e.area || e.ultimate)));
    assert.notEqual(x.q, x.e);
  }
  assert.equal(JSON.stringify(effects), before);
});
