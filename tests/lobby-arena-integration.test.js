'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLobby } = require('../src/rooms/lobby');
function setup(options = {}) {
  let time = 1000;
  const users = [
    { id: 'formal-a', display_name: '甲' },
    { id: 'formal-b', display_name: '乙' },
    { id: 'formal-viewer', display_name: '旁觀者' },
  ];
  const lobby = createLobby(
    () => time,
    () => '',
    () => 0.5,
    () => false,
    options,
  );
  const refresh = () => {
    for (const u of users) lobby.view(u);
    return lobby.view(users[0]);
  };
  refresh();
  const advance = (ms) => {
    const end = time + ms;
    while (time < end) {
      time = Math.min(end, time + 5000);
      refresh();
    }
    return refresh();
  };
  const signup = () => {
    lobby.arena(users[0], { action: 'team', team: 'red' });
    lobby.arena(users[1], { action: 'team', team: 'blue' });
  };
  const start = () =>
    lobby.arena(users[0], {
      action: 'start',
      mode: 'pk',
      matchId: refresh().arena.match?.id || null,
    });
  return {
    lobby,
    users,
    refresh,
    advance,
    signup,
    start,
    get time() {
      return time;
    },
    set time(t) {
      time = t;
    },
  };
}
test('server chooses one shared new layout, rejects forced layout and locks trusted Q/E and profile for the round', () => {
  let loadout = { q: 'barrage', e: 'beam' };
  const f = setup({ attackLoadout: () => loadout });
  f.signup();
  f.lobby.arena(f.users[0], { action: 'archetype', archetype: 'health' });
  assert.throws(
    () => f.lobby.arena(f.users[0], { action: 'start', mode: 'pk', matchId: null, layoutId: 3 }),
    (e) => e.code === 'INVALID_ARENA',
  );
  const first = f.start();
  assert(first.arena.layoutId > 0);
  assert.equal(first.arena.match.players[0].archetype, 'health');
  assert(first.arena.covers.filter((c) => c.id.startsWith('wall-x-')).length === 13);
  const peer = f.lobby.view(f.users[1]);
  assert.deepEqual(peer.arena, first.arena);
  assert.throws(
    () => f.lobby.arena(f.users[0], { action: 'archetype', archetype: 'attack' }),
    (e) => e.code === 'ARENA_LOCKED',
  );
  loadout = { q: 'explosion', e: 'explosion' };
  f.lobby.move(f.users[0], { x: 32, y: 50 });
  f.lobby.move(f.users[1], { x: 35, y: 50 });
  f.advance(12000);
  const cast = f.lobby.attack(f.users[0], {
    slot: 'q',
    effect: 'explosion',
    aspectRatio: 1,
    requestId: 'locked-loadout-first',
  });
  assert.equal(cast.attacks.at(-1).effect, 'barrage');
  f.advance(60000);
  const ended = f.refresh();
  assert.equal(ended.arena.match.phase, 'finished');
  assert.equal(ended.visitors.find((p) => p.id === f.users[0].id).archetype, null);
  const next = f.start();
  assert.notEqual(next.arena.layoutId, first.arena.layoutId);
  assert.equal(next.arena.match.players[0].loadout.q, 'explosion');
});
test('arena walk paths avoid walls under both fine and coarse polling; spectators retain ordinary lobby movement', () => {
  for (const interval of [100, 2500]) {
    const f = setup();
    f.lobby.move(f.users[0], { x: 50, y: 5 });
    f.advance(7000);
    f.signup();
    const s = f.start();
    f.lobby.move(f.users[0], { x: 50, y: 50 });
    let state;
    for (let elapsed = 0; elapsed < 15000; elapsed += interval) {
      f.time += interval;
      state = f.refresh();
      const actor = state.visitors.find((p) => p.id === f.users[0].id);
      assert(
        !s.arena.covers.some(
          (b) =>
            actor.x > b.x - 2 &&
            actor.x < b.x + b.width + 2 &&
            actor.y > b.y - 2 &&
            actor.y < b.y + b.height + 2,
        ),
        'no tunneling',
      );
    }
    const actor = state.visitors.find((p) => p.id === f.users[0].id);
    assert(Math.hypot(actor.x - 50, actor.y - 50) < 0.1, 'arrives around X');
    const spectator = f.lobby.move(f.users[2], { x: 50, y: 25 });
    f.advance(8000);
    assert.equal(
      f.lobby.view(f.users[2]).visitors.find((p) => p.id === f.users[2].id).health,
      spectator.visitors.find((p) => p.id === f.users[2].id).health,
      'spectators receive no arena hazard damage',
    );
  }
});
test('burns use real server time, count received damage only, and stop on leaving; speed/defense/health types are server state', () => {
  const f = setup();
  f.lobby.move(f.users[0], { x: 75, y: 58 });
  f.advance(8000);
  f.signup();
  f.lobby.arena(f.users[0], { action: 'archetype', archetype: 'defense' });
  f.start();
  f.advance(4000);
  const burned = f.refresh(),
    a = burned.arena.match.players[0];
  assert(a.damageTaken > 0);
  assert.equal(a.trapDamageTaken, a.damageTaken);
  assert.equal(a.damageDealt, 0);
  const viewer = burned.visitors.find((p) => p.id === f.users[2].id);
  assert.equal(viewer.archetype, null);
  f.lobby.move(f.users[0], { x: 67, y: 70 });
  f.advance(6000);
  const at = f.refresh().arena.match.players[0].damageTaken;
  f.advance(2000);
  assert.equal(f.refresh().arena.match.players[0].damageTaken, at);
});
