const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLobby } = require('../src/rooms/lobby');
const { bosses, driveBoss } = require('../src/rooms/scene-bosses');
const { createBotDriver } = require('../src/rooms/scene-bots');
const characters = require('../src/profiles/appearance').builtinCharacters.map((c) => ({
  id: c.id,
  name: c.name,
  image: c.expressions.neutral,
}));
const alice = { id: 'boss-owner', display_name: 'Alice' },
  bob = { id: 'boss-guest', display_name: 'Bob' };
function fixture(options = {}) {
  let time = 1000;
  return {
    lobby: createLobby(
      () => time,
      () => '/test',
      () => 0.25,
      () => false,
      { botCharacters: characters, ...options },
    ),
    advance: (ms) => (time += ms),
  };
}
test('boss capacity is global and independent of three bots; ownership, input and scope are enforced', () => {
  const { lobby, advance } = fixture();
  for (let i = 0; i < 3; i++) lobby.bots(alice, { action: 'add', mode: 'stationary' });
  for (const spec of bosses.slice(0, 2)) lobby.bosses(alice, { action: 'add', bossId: spec.id });
  assert.equal(lobby.bots(alice).bots.length, 3);
  assert.equal(lobby.bosses(bob).bosses.length, 2);
  assert.throws(() => lobby.bosses(bob, { action: 'add', bossId: 'arkveld' }), {
    code: 'BOSSES_FULL',
  });
  const boss = lobby.bosses(alice).bosses[0];
  assert.throws(() => lobby.bosses(bob, { action: 'remove', id: boss.id }), {
    code: 'BOSS_NOT_OWNED',
  });
  assert.throws(() => lobby.bots(alice, { action: 'remove', id: boss.id }), {
    code: 'BOT_NOT_OWNED',
  });
  assert.throws(() => lobby.bosses(alice, { action: 'add', bossId: 'hacked', health: 99999 }), {
    code: 'INVALID_BOSS',
  });
  const actor = lobby.view(alice).visitors.find((v) => v.id === boss.id);
  assert.ok(actor.bossId);
  assert.ok(actor.maxHealth >= 8000000);
  assert.match(actor.image, /\?v=/);
  lobby.bosses(alice, { action: 'reset', id: boss.id });
  assert.equal(lobby.view(alice).visitors.find((v) => v.id === boss.id).maxHealth, actor.maxHealth);
  advance(16000);
  assert.equal(lobby.bosses(bob).bosses.length, 0);
  assert.throws(() => fixture({ training: true }).lobby.bosses(alice), { code: 'LOBBY_BOSS_ONLY' });
  assert.throws(() => fixture({ expandedMap: true }).lobby.bosses(alice), {
    code: 'LOBBY_BOSS_ONLY',
  });
});
test('all ten boss patterns wind up before casting, cycle their attacks and stay in bounds', () => {
  const valid = new Set(require('../public/shared/attack-effects.json').map((e) => e.id));
  assert.equal(new Set(bosses.map((b) => b.movement)).size, 10);
  for (const spec of bosses) {
    assert.ok(
      spec.sequence.every((e) => valid.has(e)),
      spec.id,
    );
    // Bosses spawn at Y=65 in the lobby; pure driver tests retain that same origin.
    const actor = { x: 50, y: 65, targetX: 50, targetY: 65, moveId: 0, teleportId: 0 },
      target = { x: 60, y: 65 };
    const state = { moveAt: 0, attackAt: 0 };
    const bot = { bossId: spec.id };
    assert.equal(driveBoss(bot, actor, target, 0, state), null);
    assert.equal(actor.bossIntent.until, 1000);
    assert.equal(driveBoss(bot, actor, target, 999, state), null);
    assert.equal(driveBoss(bot, actor, target, 1000, state), spec.sequence[0]);
    assert.equal(actor.bossIntent, null);
    for (let n = 1; n < 3; n++) {
      const at = state.attackAt;
      driveBoss(bot, actor, target, at, state);
      assert.equal(driveBoss(bot, actor, target, at + 1000, state), spec.sequence[n]);
    }
    assert.ok(actor.targetX >= 12 && actor.targetX <= 88);
    assert.ok(actor.targetY >= 65 && actor.targetY <= 88);
    if (spec.movement === 'blink') assert.ok(actor.teleportId > 0);
  }
});
test('paralysis cancels a boss windup and blink; respawn requires a fresh windup', () => {
  const actor = { x: 50, y: 50, targetX: 50, targetY: 50, moveId: 0, teleportId: 0, lifeId: 1 };
  const state = { attackAt: 0, moveAt: 0 },
    bot = { bossId: 'greeza' },
    target = { x: 60, y: 65 };
  driveBoss(bot, actor, target, 0, state);
  driveBoss(bot, actor, target, 1200, state);
  assert.ok(state.pending);
  const before = actor.teleportId;
  actor.immobileUntil = 3000;
  assert.equal(driveBoss(bot, actor, target, 2400, state), null);
  assert.equal(actor.teleportId, before);
  assert.equal(state.pending, null);
  actor.lifeId = 2;
  actor.immobileUntil = 0;
  assert.equal(driveBoss(bot, actor, target, 4000, state), null);
  assert.equal(state.attackAt, 5200);
  assert.equal(driveBoss(bot, actor, target, 5200, state), null);
  assert.equal(driveBoss(bot, actor, target, 6200, state), 'refracting_prism');
});
test('boss driver uses a bounded shared clock, excludes other NPCs and stops for dead bosses', () => {
  const driver = createBotDriver(() => 0.5),
    cast = [];
  const bots = bosses.slice(0, 2).map((b, i) => ({ id: 'b' + i, bossId: b.id }));
  const positions = new Map(
    bots.map((b) => [b.id, { id: b.id, x: 50, y: 50, health: 100, moveId: 0 }]),
  );
  positions.set('human', { id: 'human', x: 55, y: 55, health: 100 });
  for (let time = 0; time < 9000; time += 400) {
    const count = cast.length;
    driver.drive({ time, bots, positions, events: [], cast: (b) => cast.push(b.id) });
    assert.ok(cast.length - count <= 1);
  }
  assert.ok(bots.every((b) => cast.includes(b.id)));
  positions.delete('human');
  const count = cast.length;
  for (let time = 10000; time < 15000; time += 400)
    driver.drive({ time, bots, positions, events: [], cast: (b) => cast.push(b.id) });
  assert.equal(cast.length, count);
  driver.clear();
  positions.set('human', { id: 'human', x: 55, y: 55, health: 100 });
  for (const b of bots) positions.get(b.id).health = 0;
  driver.drive({ time: 20000, bots, positions, events: [], cast: (b) => cast.push(b.id) });
  assert.equal(cast.length, count);
});
