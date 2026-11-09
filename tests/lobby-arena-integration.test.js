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
test('server chooses one shared new layout, rejects forced layout and locks trusted Q/E/R and profile for the round', () => {
  let loadout = { q: 'barrage', e: 'beam', r: 'bijuu_beam' };
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
  const { ownArchetype: peerType, ...peerArena } = peer.arena;
  const { ownArchetype: firstType, ...firstArena } = first.arena;
  assert.deepEqual(peerArena, firstArena);
  assert.notEqual(peerType, firstType);
  assert.throws(
    () => f.lobby.arena(f.users[0], { action: 'archetype', archetype: 'attack' }),
    (e) => e.code === 'ARENA_LOCKED',
  );
  loadout = { q: 'explosion', e: 'explosion', r: '' };
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
  assert.throws(
    () => f.lobby.attack(f.users[0], { slot: 'r', aspectRatio: 1, requestId: 'locked-r-first' }),
    (error) => error.code === 'INSUFFICIENT_SCENE_ENERGY',
  );
  f.advance(60000);
  const ended = f.refresh();
  assert.equal(ended.arena.match.phase, 'finished');
  assert.equal(ended.visitors.find((p) => p.id === f.users[0].id).archetype, null);
  const next = f.start();
  assert.notEqual(next.arena.layoutId, first.arena.layoutId);
  assert.notDeepEqual(next.arena.hazards, first.arena.hazards);
  assert.equal(next.arena.match.players[0].loadout.q, 'explosion');
  assert.equal(next.arena.match.players[0].loadout.r, '');
  assert.throws(
    () =>
      f.lobby.attack(f.users[0], {
        slot: 'r',
        effect: 'bijuu_beam',
        aspectRatio: 1,
        requestId: 'locked-r-second',
      }),
    (error) => error.code === 'NO_MULTI_ATTACK_LOADOUT',
  );
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
  f.signup();
  f.lobby.arena(f.users[0], { action: 'archetype', archetype: 'defense' });
  const embers = f.start().arena.hazards.find((zone) => zone.kind === 'embers');
  f.lobby.move(f.users[0], { x: embers.x + embers.width / 2, y: embers.y + embers.height / 2 });
  f.advance(12000);
  const burned = f.refresh(),
    a = burned.arena.match.players[0];
  assert(a.damageTaken > 0);
  assert.equal(a.trapDamageTaken, a.damageTaken);
  assert.equal(a.damageDealt, 0);
  const viewer = burned.visitors.find((p) => p.id === f.users[2].id);
  assert.equal(viewer.archetype, null);
  f.lobby.move(f.users[0], { x: embers.x - 8, y: embers.y + embers.height / 2 });
  f.advance(6000);
  const at = f.refresh().arena.match.players[0].damageTaken;
  f.advance(2000);
  assert.equal(f.refresh().arena.match.players[0].damageTaken, at);
});

test('preview team match fills three seats per side and respects the selected duration', () => {
  const practiceBots = Array.from({ length: 5 }, (_, index) => ({
    id: 'preview-bot-' + index,
    display_name: 'Bot ' + index,
  }));
  const f = setup({ practiceBots });
  f.lobby.arena(f.users[0], { action: 'team', team: 'red' });
  assert.throws(
    () => f.lobby.arena(f.users[0], { action: 'start', mode: 'team', durationSeconds: 90 }),
    (error) => error.code === 'INVALID_ARENA_DURATION',
  );
  assert.equal(f.refresh().arena.teams.length, 1);
  const state = f.lobby.arena(f.users[0], { action: 'start', mode: 'team', durationSeconds: 120 });
  const match = state.arena.match;
  assert.equal(match.endsAt - match.startedAt, 120000);
  assert.deepEqual(
    ['red', 'blue'].map((team) => match.players.filter((player) => player.team === team).length),
    [3, 3],
  );
  f.advance(119999);
  assert.equal(f.refresh().arena.match.phase, 'running');
  f.advance(1);
  assert.deepEqual(
    f.refresh().arena.teams.map((p) => p.id),
    [f.users[0].id],
  );
  f.lobby.arena(f.users[1], { action: 'team', team: 'blue' });
  const next = f.lobby.arena(f.users[0], {
    action: 'start',
    mode: 'pk',
    matchId: match.id,
    durationSeconds: 180,
  }).arena.match;
  assert.equal(next.endsAt - next.startedAt, 180000);
  assert.equal(next.players.length, 2);
});

test('bushes hide opponents from snapshots and new attacks until revealed', () => {
  const f = setup();
  assert.deepEqual(f.refresh().arena.bushes, []);
  f.signup();
  const bush = f.start().arena.bushes[0];
  const spot = { x: bush.x + bush.width / 2, y: bush.y + bush.height / 2 };
  f.lobby.move(f.users[1], spot);
  f.lobby.move(f.users[0], { x: spot.x, y: bush.y - 2 });
  f.advance(15000);
  assert.ok(!f.refresh().visitors.some((v) => v.id === f.users[1].id));
  assert.ok(f.lobby.view(f.users[1]).visitors.some((v) => v.id === f.users[1].id));
  assert.throws(
    () =>
      f.lobby.attack(f.users[0], {
        requestId: 'hidden-enemy-001',
        aspectRatio: 1,
        effect: 'barrage',
      }),
    (e) => e.code === 'NO_ATTACK_TARGET',
  );
  f.lobby.attack(f.users[1], { requestId: 'bush-reveal-001', aspectRatio: 1, effect: 'barrage' });
  assert.ok(f.refresh().visitors.some((v) => v.id === f.users[1].id));
  f.advance(2000);
  assert.ok(!f.refresh().visitors.some((v) => v.id === f.users[1].id));
  f.lobby.move(f.users[0], spot);
  f.advance(15000);
  assert.ok(f.refresh().visitors.some((v) => v.id === f.users[1].id));
});

test('five second warmup blocks movement, teleport and attacks before the full round clock starts', () => {
  const f = setup({ startDelayMs: 5000 });
  f.signup();
  const match = f.start().arena.match;
  assert.equal(match.startedAt - f.time, 5000);
  assert.equal(match.endsAt - match.startedAt, 60000);
  const countdown = (error) => error.code === 'ARENA_COUNTDOWN';
  assert.throws(() => f.lobby.move(f.users[0], { x: 30, y: 30 }), countdown);
  assert.throws(() => f.lobby.teleport(f.users[0]), countdown);
  assert.throws(
    () =>
      f.lobby.attack(f.users[0], { requestId: 'warmup-attack', aspectRatio: 1, effect: 'shield' }),
    countdown,
  );
  f.advance(4999);
  assert.throws(() => f.lobby.move(f.users[0], { x: 30, y: 30 }), countdown);
  f.advance(1);
  assert.doesNotThrow(() => f.lobby.move(f.users[0], { x: 30, y: 30 }));
});

test('expanded arena reaches new regions, clamps edges and connects only paired wormholes', () => {
  const f = setup({ expandedMap: true });
  f.signup();
  const started = f.start();
  const player = f.users[0];
  const own = (state) => state.visitors.find((visitor) => visitor.id === player.id);
  assert.equal(started.arena.expanded, true);
  assert.equal(started.arena.covers.filter((wall) => wall.id.startsWith('wing-wall')).length, 4);
  assert.equal(started.arena.hazards.filter((trap) => trap.id.startsWith('wing-trap')).length, 4);
  assert.equal(started.arena.bushes.filter((bush) => bush.id.startsWith('wing-bush')).length, 4);
  assert.equal(started.arena.portals.length, 4);
  assert.throws(() => f.lobby.teleport(player), { code: 'INSUFFICIENT_SCENE_ENERGY' });
  f.lobby.move(player, { x: 0, y: 10 });
  const edge = own(f.advance(16000));
  assert.equal(edge.x, 1);
  f.lobby.move(player, { dx: -1, dy: 0 });
  assert.equal(own(f.advance(1000)).x, 1);
  f.lobby.move(player, { x: 5, y: 50 });
  const arrived = own(f.advance(12000));
  assert.equal(arrived.x, 95);
  assert.equal(arrived.y, 50);
  assert.equal(own(f.advance(3000)).x, 95);
});

test('expanded arena bush concealment expires while the player remains inside', () => {
  const f = setup({ expandedMap: true });
  f.signup();
  const bush = f.start().arena.bushes.find((zone) => zone.id === 'wing-bush-0');
  f.lobby.move(f.users[1], { x: bush.x + bush.width / 2, y: bush.y + bush.height / 2 });
  const visible = (state) => state.visitors.some((v) => v.id === f.users[1].id);
  let hidden = false;
  for (let i = 0; i < 200; i++) {
    if (!visible(f.advance(100))) {
      hidden = true;
      break;
    }
  }
  assert.ok(hidden);
  assert.ok(visible(f.advance(1000)));
  assert.ok(visible(f.advance(1500)));
});

test('twin lane rings each choose between two opposite landing points', () => {
  const { twinLanePortals, traversePortal } = require('../src/rooms/arena-expanded-map');
  for (const entrance of twinLanePortals) {
    for (const [index, random] of [() => 0, () => 0.99].entries()) {
      const actor = { x: entrance.x, y: entrance.y, moveId: 0 };
      assert.ok(traversePortal(actor, twinLanePortals, random));
      assert.deepEqual({ x: actor.x, y: actor.y }, entrance.exits[index]);
      assert.equal(actor.teleportId, 1);
    }
  }
  const f = setup({ expandedMap: true, requireReady: true });
  f.signup();
  for (const user of f.users.slice(0, 2)) f.lobby.arena(user, { action: 'ready', ready: true });
  const result = f.start();
  assert.equal(result.arena.expanded, undefined);
  assert.equal(result.arena.portals.length, 2);
  assert.equal(result.arena.hazards.filter((zone) => zone.id.startsWith('twin-trap')).length, 2);
  const ring = result.arena.portals[0];
  f.lobby.move(f.users[0], { x: ring.x, y: ring.y });
  const player = f.advance(20000).visitors.find((v) => v.id === f.users[0].id);
  assert.equal(player.teleportId, 1);
  assert.deepEqual({ x: player.x, y: player.y }, twinLanePortals[0].exits[1]);
});

test('arena teleport spends the same twenty energy as the lobby', () => {
  const f = setup({ expandedMap: true });
  f.signup();
  const player = f.users[0];
  f.lobby.arena(player, { action: 'archetype', archetype: 'energy' });
  assert.equal(
    f.start().arena.match.players.find((entry) => entry.id === player.id).archetype,
    'energy',
  );
  f.lobby.move(player, { x: 1, y: 10 });
  const own = (state) => state.visitors.find((visitor) => visitor.id === player.id);
  f.advance(15000);
  f.lobby.move(player, { x: 90, y: 90 });
  const before = own(f.advance(15000));
  assert.ok(before.energy >= 20);
  assert.equal(before.energyMaximum, 150);
  const after = own(f.lobby.teleport(player));
  assert.equal(after.energy, before.energy - 20);
  assert.equal(after.teleportId, before.teleportId + 1);
});

test('arena starts keep a full roster apart even when initial lobby positions coincide', () => {
  for (const [mapId, durationSeconds, gap] of [
    [1, 60, 12],
    [3, 120, 6],
  ]) {
    const lobby = createLobby(
      () => 1000,
      undefined,
      () => 0.5,
      undefined,
      {
        expandedMap: true,
        requireReady: true,
      },
    );
    const users = Array.from({ length: 16 }, (_, index) => ({
      id: 'a'.repeat(index) + 'b' + 'a'.repeat(15 - index),
      display_name: 'Player ' + index,
    }));
    for (const [index, user] of users.entries()) {
      lobby.view(user);
      lobby.arena(user, { action: 'team', team: index < 8 ? 'red' : 'blue' });
      lobby.arena(user, { action: 'ready', ready: true });
    }
    const state = lobby.arena(users[0], { action: 'start', mode: 'team', mapId, durationSeconds });
    assert.equal(state.visitors.length, 16);
    for (const [i, visitor] of state.visitors.entries())
      for (const previous of state.visitors.slice(0, i))
        assert.ok(Math.hypot(visitor.x - previous.x, visitor.y - previous.y) >= gap);
  }
});
