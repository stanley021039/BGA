const { test } = require('node:test');
test('formal arena round-stats rules', () => {
  const assert = require('node:assert/strict');
  const { createLobbyArena } = require('../src/rooms/lobby-arena');
  const { createSceneCombat } = require('../src/rooms/scene-combat');
  let time = 1000;
  const arena = createLobbyArena(() => time),
    combat = createSceneCombat(
      () => 0.5,
      () => false,
      arena,
    ),
    actors = new Map();
  for (const id of ['red-one', 'red-two', 'blue-one']) {
    const actor = { id, x: 8, y: 20, targetX: 8, targetY: 20 };
    combat.advance(actor, time);
    actors.set(id, actor);
    arena.command(
      { id },
      { action: 'team', team: id.startsWith('red') ? 'red' : 'blue' },
      actors,
      combat.reset,
    );
  }
  function start(matchId = null) {
    arena.command(
      { id: 'red-one' },
      { action: 'start', mode: 'team', matchId },
      actors,
      combat.reset,
    );
  }
  function stats(id) {
    return arena.view(actors).match.players.find((p) => p.id === id);
  }
  start();
  const from = { ...actors.get('red-one'), originX: 8, originY: 20, castId: 'one' },
    ally = actors.get('red-two'),
    target = actors.get('blue-one');
  const old = target.health;
  combat.hit(from, target, time, 'beam');
  const first = old - target.health;
  assert(first > 0);
  assert.equal(stats(from.id).damageDealt, first);
  assert.equal(stats(target.id).damageTaken, first);
  const before = stats(from.id).damageDealt;
  combat.hit(from, ally, time, 'explosion');
  assert.equal(stats(from.id).damageDealt, before);
  assert.equal(stats(ally.id).damageTaken, 0);
  target.health = 7;
  combat.hit(from, target, time, 'explosion');
  assert.equal(stats(from.id).damageDealt, first + 7, 'no overkill');
  assert.equal(
    stats(from.id).score,
    1,
    'same-cast score dedup does not suppress real damage totals',
  );
  const hp = ally.health;
  combat.environmentDamage(ally, time, 0.05);
  assert.equal(stats(ally.id).damageTaken, hp - ally.health);
  assert.equal(stats(ally.id).trapDamageTaken, hp - ally.health);
  assert.equal(stats(ally.id).damageDealt, 0);
  const frozen = JSON.stringify(arena.view(actors).match.players);
  time = 61000;
  combat.environmentDamage(ally, time, 0.05);
  arena.onDamage(from, ally, time, 123);
  arena.finish(time, actors);
  assert.equal(
    JSON.stringify(arena.view(actors).match.players),
    frozen,
    'cutoff excludes damage at 60s',
  );
  const prior = arena.view(actors).match.id;
  start(prior);
  for (const p of arena.view(actors).match.players) {
    assert.equal(p.damageDealt, 0);
    assert.equal(p.damageTaken, 0);
  }
  console.log(
    'PASS real damage totals, friendly fire exclusion, overkill cap, multi-hit totals, traps, exact cutoff and new round reset',
  );
});
