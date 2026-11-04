'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLobby } = require('../src/rooms/lobby');
const { behindCover, covers } = require('../src/rooms/lobby-arena');
const { createLobbyPractice } = require('../src/tutorials/lobby-arena');
function fixture(count = 3) {
  let time = 1000;
  const lobby = createLobby(
    () => time,
    undefined,
    () => 0.5,
  );
  const users = Array.from({ length: count }, (_, i) => ({
    id: 'arena-' + i,
    display_name: '玩家' + i,
  }));
  const refresh = () => {
    for (const u of users) lobby.view(u);
    return lobby.view(users[0]);
  };
  function advance(ms) {
    const end = time + ms;
    while (time < end) {
      time = Math.min(end, time + 5000);
      refresh();
    }
    return refresh();
  }
  const team = (i, value) => lobby.arena(users[i], { action: 'team', team: value });
  const start = (mode = 'pk', matchId = null) =>
    lobby.arena(users[0], { action: 'start', mode, matchId });
  const attack = (i = 0, id = 'arena-cast-one', effect = 'barrage') =>
    lobby.attack(users[i], { requestId: id, slot: 'q', aspectRatio: 1, effect });
  function place(i, x, y) {
    lobby.move(users[i], { x, y });
  }
  refresh();
  return {
    lobby,
    users,
    refresh,
    advance,
    team,
    start,
    attack,
    place,
    get time() {
      return time;
    },
    set time(v) {
      time = v;
    },
  };
}
const code = (expected) => (error) => error.code === expected;
test('arena validates teams, signup, PK headcount, both teams, and concurrent starts', () => {
  const f = fixture();
  assert.throws(() => f.start(), code('ARENA_JOIN_REQUIRED'));
  assert.throws(() => f.team(0, 'green'), code('INVALID_TEAM'));
  f.team(0, 'red');
  assert.throws(() => f.start(), code('ARENA_PLAYERS'));
  f.team(1, 'red');
  assert.throws(() => f.start('team'), code('ARENA_PLAYERS'));
  const m = f.start().arena.match;
  assert.equal(m.players.length, 2);
  assert.equal(m.endsAt - m.startedAt, 60000);
  assert.throws(() => f.start(), code('ARENA_RUNNING'));
  assert.throws(() => f.team(0, 'blue'), code('ARENA_LOCKED'));
});
test('signup enforces eight per team and can cancel or change teams', () => {
  const f = fixture(10);
  for (let i = 0; i < 8; i++) f.team(i, 'red');
  assert.throws(() => f.team(8, 'red'), code('TEAM_FULL'));
  f.team(0, 'blue');
  f.team(8, 'red');
  f.team(8, null);
  assert.equal(f.refresh().arena.teams.length, 8);
});
test('multi-hit cast scores once per victim and duplicate requests do not score again', () => {
  const f = fixture(2);
  f.place(0, 40, 50);
  f.place(1, 45, 50);
  f.advance(7000);
  f.team(0, 'red');
  f.team(1, 'blue');
  f.start();
  f.attack();
  let s = f.advance(3000);
  assert.ok(s.attacks[0].hits.filter((h) => h.damage > 0).length > 1);
  assert.equal(s.arena.match.players[0].score, 1);
  f.attack();
  s = f.advance(1000);
  assert.equal(s.arena.match.players[0].score, 1);
});
test('team targeting excludes closer teammates and spectators, including area rays', () => {
  const f = fixture(4);
  for (let i = 0; i < 4; i++) f.place(i, 40 + i * 2, 50);
  f.advance(7000);
  f.team(0, 'red');
  f.team(1, 'red');
  f.team(2, 'blue');
  f.start('team');
  const event = f.attack(0, 'arena-area-cast', 'bijuu_beam').attacks[0];
  assert.deepEqual([...new Set(event.hits.map((h) => h.toId))], [f.users[2].id]);
  assert.throws(() => f.attack(3), code('NO_ATTACK_TARGET'));
  const result = f.advance(4400);
  assert.equal(result.arena.match.players[0].score, 1);
});
test('cover stops delayed direct hits, bypass effects still damage, no movement collision', () => {
  const f = fixture(2);
  f.place(0, 14, 85);
  f.place(1, 27, 85);
  f.advance(7000);
  const initial = f.refresh().visitors.find((p) => p.id === f.users[1].id).health;
  f.attack();
  let s = f.advance(2000);
  assert.ok(s.attacks[0].hits.every((h) => h.blocked && h.missed && h.damage === 0));
  assert.equal(s.visitors.find((p) => p.id === f.users[1].id).health, initial);
  f.attack(0, 'arena-orbit-cast', 'orbital');
  s = f.advance(2000);
  assert.ok(s.attacks.find((a) => a.effect === 'orbital').hits.some((h) => h.damage > 0));
  f.place(0, 21, 86);
  f.advance(3000);
  assert.equal(f.refresh().visitors[0].x, 21);
});
test('cover is checked at impact after target moves into shelter', () => {
  const f = fixture(2);
  f.place(0, 14, 85);
  f.place(1, 17.5, 85);
  f.advance(7000);
  f.attack(0, 'moving-cover-cast', 'beam');
  f.place(1, 20, 85);
  const s = f.advance(4000);
  assert.ok(s.attacks[0].hits.every((h) => h.blocked || h.missed));
});
test('geometry includes tangent, inside and zero-length paths and ignores other effects', () => {
  assert.equal(covers.length, 3);
  assert.ok(behindCover({ x: 14, y: 83 }, { x: 27, y: 83 }, 'beam'));
  assert.ok(behindCover({ x: 20, y: 85 }, { x: 20, y: 85 }, 'beam'));
  assert.equal(behindCover({ x: 14, y: 82.9 }, { x: 27, y: 82.9 }, 'beam'), false);
  assert.equal(behindCover({ x: 14, y: 85 }, { x: 27, y: 85 }, 'explosion'), false);
});
test('pre-match projectiles cannot damage new contestants', () => {
  const f = fixture(2);
  f.place(0, 40, 50);
  f.place(1, 45, 50);
  f.advance(7000);
  f.attack();
  f.team(0, 'red');
  f.team(1, 'blue');
  f.start();
  const s = f.advance(2200);
  assert.ok(s.attacks[0].hits.every((h) => h.missed && h.damage === 0));
  assert.deepEqual(
    s.arena.match.players.map((p) => p.score),
    [0, 0],
  );
});
test('deadline rejects late hits and DOT; final result is stable on future reads', () => {
  const f = fixture(2);
  f.place(0, 40, 50);
  f.place(1, 45, 50);
  f.advance(7000);
  f.team(0, 'red');
  f.team(1, 'blue');
  const match = f.start().arena.match;
  f.advance(59999);
  f.attack(0, 'deadline-cast', 'giga_drill');
  let s = f.advance(1000);
  assert.equal(s.arena.match.phase, 'finished');
  assert.deepEqual(
    s.arena.match.players.map((p) => p.score),
    [0, 0],
  );
  const frozen = s.arena.match;
  f.advance(6000);
  s = f.refresh();
  assert.deepEqual(s.arena.match, frozen);
  assert.deepEqual(
    s.arena.match.winners,
    f.users.map((u) => u.id),
  );
  assert.throws(() => f.start(), code('ARENA_CHANGED'));
  assert.equal(f.start('pk', match.id).arena.match.phase, 'running');
});
test('forfeit isolates queued attacks, releases team and awards eligible player', () => {
  const f = fixture(2);
  f.place(0, 40, 50);
  f.place(1, 45, 50);
  f.advance(7000);
  f.team(0, 'red');
  f.team(1, 'blue');
  const m = f.start().arena.match;
  f.attack();
  f.lobby.arena(f.users[0], { action: 'leave', matchId: m.id });
  assert.throws(
    () => f.lobby.arena(f.users[0], { action: 'leave', matchId: m.id }),
    code('ARENA_CHANGED'),
  );
  assert.throws(() => f.attack(1), code('NO_ATTACK_TARGET'));
  const s = f.advance(60001);
  assert.equal(s.arena.match.players[0].forfeited, true);
  assert.deepEqual(s.arena.match.winners, [f.users[1].id]);
  assert.deepEqual(
    s.arena.match.players.map((p) => p.score),
    [0, 0],
  );
});
test('disconnected participant reattaches same membership without duplicate score rows', () => {
  const f = fixture(2);
  f.team(0, 'red');
  f.team(1, 'blue');
  f.start();
  f.time += 16000;
  f.lobby.view(f.users[1]);
  const s = f.lobby.view(f.users[0]);
  assert.equal(s.arena.match.players.length, 2);
  assert.equal(s.arena.match.players[0].forfeited, false);
  assert.throws(() => f.team(0, 'blue'), code('ARENA_LOCKED'));
});
test('practice drives real blocked hit, movement, deduplicated score and final outcome in isolated state', () => {
  const p = createLobbyPractice(),
    a = { id: 'a' },
    b = { id: 'b' };
  let s = p.command(a, { action: 'start' });
  assert.equal(s.step, 0);
  for (let step = 0; step < 5; step++) {
    s = p.command(a, { action: 'next', step });
    if (step === 1) assert.equal(s.arena.match.players[0].score, 0);
    if (step === 3) assert.equal(s.arena.match.players[0].score, 1);
  }
  assert.equal(s.arena.match.phase, 'finished');
  assert.deepEqual(s.arena.match.winners, ['practice-self']);
  assert.throws(() => p.command(b, { action: 'next', step: 0 }), code('PRACTICE_EXPIRED'));
  assert.equal(p.command(a, { action: 'start' }).step, 0);
  p.command(a, { action: 'next', step: 0 });
  assert.throws(() => p.command(a, { action: 'next', step: 0 }), code('PRACTICE_CHANGED'));
  p.command(a, { action: 'close' });
  assert.throws(() => p.command(a, { action: 'next', step: 1 }), code('PRACTICE_EXPIRED'));
});
test('a team with all players forfeited cannot share a zero-score win', () => {
  const f = fixture(2);
  f.team(0, 'red');
  f.team(1, 'blue');
  const m = f.start('team').arena.match;
  f.lobby.arena(f.users[0], { action: 'leave', matchId: m.id });
  assert.deepEqual(f.advance(60001).arena.match.winners, ['blue']);
});
test('a hit one millisecond before the deadline counts; a hit exactly at it does not', () => {
  for (const lead of [450, 451]) {
    const f = fixture(2);
    f.place(0, 40, 50);
    f.place(1, 45, 50);
    f.advance(7000);
    f.team(0, 'red');
    f.team(1, 'blue');
    f.start();
    f.advance(60000 - lead);
    f.attack();
    const s = f.advance(2000);
    assert.equal(s.arena.match.players[0].score, lead === 451 ? 1 : 0);
    assert.equal(s.arena.match.phase, 'finished');
  }
});
