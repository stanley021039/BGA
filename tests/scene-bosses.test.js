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
test('boss capacity is global and independent of five bots; ownership, input and scope are enforced', () => {
  const { lobby, advance } = fixture();
  for (let i = 0; i < 5; i++) lobby.bots(alice, { action: 'add', mode: 'idle' });
  for (const spec of bosses.slice(0, 5)) lobby.bosses(alice, { action: 'add', bossId: spec.id });
  assert.equal(lobby.bots(alice).bots.length, 5);
  assert.equal(lobby.bosses(bob).bosses.length, 5);
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
  advance(5000);
  const actor = lobby.view(alice).visitors.find((v) => v.id === boss.id);
  assert.ok(actor.bossId);
  assert.ok(actor.maxHealth >= 8000000);
  assert.match(actor.image, /\?v=/);
  lobby.bosses(alice, { action: 'reset', id: boss.id });
  assert.equal(lobby.view(alice).visitors.find((v) => v.id === boss.id).maxHealth, actor.maxHealth);
  advance(16000);
  assert.equal(lobby.bosses(bob).bosses.length, 0);
  assert.throws(() => fixture({ training: true }).lobby.bosses(alice), { code: 'LOBBY_BOSS_ONLY' });
  assert.equal(fixture({ expandedMap: true }).lobby.bosses(alice).limit, 1);
});
test('all eleven boss patterns wind up before casting, cycle their attacks and stay in bounds', () => {
  const definitions = require('../public/shared/boss-abilities.json');
  const valid = new Set(definitions.map((e) => e.id));
  assert.equal(valid.size, 33);
  assert.equal(new Set(bosses.map((b) => b.movement)).size, 11);
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
    for (let n = 0; n < 3; n++) {
      const at = state.attackAt;
      const ability = definitions.find((a) => a.id === spec.sequence[n]);
      assert.equal(driveBoss(bot, actor, target, at, state), ability.id);
      assert.equal(actor.bossIntent.until, at + ability.windup);
      assert.equal(actor.bossIntent.ultimate, n === 2);
      assert.equal(driveBoss(bot, actor, target, at + ability.windup - 1, state), null);
      assert.equal(
        driveBoss(bot, actor, target, at + ability.windup + ability.duration, state),
        null,
      );
      assert.equal(actor.bossIntent, null);
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
  assert.equal(driveBoss(bot, actor, target, 5200, state), 'boss_greeza_q');
  assert.equal(driveBoss(bot, actor, target, 6200, state), null);
});
test('boss driver uses a bounded shared clock, targets other NPCs and stops for dead bosses', () => {
  const driver = createBotDriver(() => 0.5),
    cast = [];
  const bots = bosses.slice(0, 2).map((b, i) => ({ id: 'b' + i, bossId: b.id }));
  const positions = new Map(
    bots.map((b) => [b.id, { id: b.id, x: 50, y: 50, health: 100, moveId: 0 }]),
  );
  positions.set('human', { id: 'human', x: 55, y: 55, health: 100 });
  for (let time = 0; time < 9000; time += 400) {
    const count = cast.length;
    driver.drive({ time, bots, positions, events: [], castBoss: (b) => cast.push(b.id) });
    assert.ok(cast.length - count <= 1);
  }
  assert.ok(bots.every((b) => cast.includes(b.id)));
  positions.delete('human');
  const count = cast.length;
  for (let time = 10000; time < 15000; time += 400)
    driver.drive({ time, bots, positions, events: [], castBoss: (b) => cast.push(b.id) });
  assert.ok(cast.length > count, 'bosses can target one another without a human target');
  const afterDuel = cast.length;
  driver.clear();
  positions.set('human', { id: 'human', x: 55, y: 55, health: 100 });
  for (const b of bots) positions.get(b.id).health = 0;
  driver.drive({ time: 20000, bots, positions, events: [], castBoss: (b) => cast.push(b.id) });
  assert.equal(cast.length, afterDuel);
});
