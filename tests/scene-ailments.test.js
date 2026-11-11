const { chargeScene } = require('./helpers/scene-charge.cjs');
('use strict');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const { createLobby } = require('../src/rooms/lobby');
const { createRoomSpace } = require('../src/rooms/space');
function fixture(effect) {
  let rolls = [];
  const combat = createSceneCombat(() => rolls.shift() ?? 0.9),
    timeline = createAttackTimeline(combat);
  const actors = ['a', 'b', 'c'].map((id, i) => ({ id, name: id, x: 20 + i * 20, y: 50 }));
  actors.forEach((a) => combat.advance(a, 0));
  const event = {
    id: 'ailment',
    effect,
    at: 0,
    fromId: 'a',
    fromX: 20,
    fromY: 50,
    toId: 'b',
    toX: 40,
    toY: 50,
    aspectRatio: 1,
  };
  timeline.prepare(event, actors[0], actors.slice(1));
  return {
    combat,
    actors,
    event,
    rolls: (values) => {
      rolls = values;
    },
    advance: (time) => timeline.advance([event], actors, time, (a, t) => combat.advance(a, t)),
  };
}
test('bijuu rolls independently at real impact with exclusive 30% root and 20% slow boundaries, without re-rolling on repeat', () => {
  const f = fixture('bijuu_beam'),
    [, b, c] = f.actors;
  f.rolls([0.5, 0.9, 0.299999, 0.199999, 0.5, 0.9, 0.3, 0.2]);
  f.advance(2459);
  assert.equal(b.immobileUntil, 0);
  assert.equal(c.immobileUntil, 0);
  f.advance(2460);
  assert.equal(b.immobileUntil, 3460);
  assert.equal(c.immobileUntil, 0);
  assert.throws(() => f.combat.canMove(b, 3459), { code: 'SCENE_IMMOBILIZED' });
  assert.doesNotThrow(() => f.combat.canMove(c, 2460));
  f.advance(2460);
  assert.equal(b.immobileUntil, 3460);
  assert.doesNotThrow(() => f.combat.canMove(b, 3460));
  assert.equal(f.combat.view(b).slowMs, 0);
  f.advance(3460);
  assert.equal(f.combat.view(b).slowMs, 1000);
  assert.equal(f.combat.view(b).slowMultiplier, 0.7);
  assert.equal(f.combat.view(c).slowMs, 0);
});
test('dodging bijuu cannot apply its immobilization and old hits cannot freeze a new life', () => {
  const f = fixture('bijuu_beam'),
    [, b, c] = f.actors;
  b.y = 90;
  c.lifeId++;
  f.rolls([0, 0, 0, 0, 0, 0]);
  f.advance(2460);
  assert.ok(f.event.hits.every((h) => h.missed));
  assert.equal(b.immobileUntil, 0);
  assert.equal(c.immobileUntil, 0);
});
test('phoenix only burn ticks block healing; repeated burns refresh five seconds, then one tick resumes without banked healing', () => {
  const f = fixture('solar_phoenix'),
    [, b] = f.actors;
  f.advance(2900);
  assert.equal(b.regenBlockedUntil, 0);
  f.advance(3000);
  assert.equal(b.regenBlockedUntil, 8000);
  f.advance(3900);
  assert.equal(b.regenBlockedUntil, 8900);
  const health = b.health;
  f.advance(8899);
  assert.equal(b.health, health);
  let state = f.combat.view(b, true).combatStatus;
  assert.equal(state.regenerating, false);
  assert.equal(state.regenBlockedMs, 1);
  assert.equal(state.regenWaitMs, 1);
  f.advance(8900);
  assert.equal(b.health, health + 40000);
  state = f.combat.view(b, true).combatStatus;
  assert.equal(state.regenerating, true);
  assert.equal(state.regenBlockedMs, 0);
  f.advance(8900);
  assert.equal(b.health, health + 40000);
  const late = fixture('solar_phoenix');
  late.advance(3900);
  const old = late.actors[1].health;
  late.advance(10900);
  assert.equal(late.actors[1].health, old + 120000);
});
test('healing block also covers author and Guanyin rates; later damage respects ordinary recovery delay; death and respawn clear it', () => {
  const combat = createSceneCombat(
      () => 0.9,
      (id) => id === 'b',
    ),
    a = { id: 'a', x: 20, y: 50 },
    b = { id: 'b', x: 40, y: 50 };
  combat.advance(a, 0);
  combat.advance(b, 0);
  b.health = 600000;
  combat.hit(a, b, 0, 'solar_phoenix', 0.1);
  combat.applyEffect(a, b, 0, 'solar_phoenix', a, 1, 'burn1');
  const health = b.health;
  combat.hit({ ...b, energyActor: b, energyLifeId: b.lifeId }, a, 1000, 'guanyin_barrage', 0.2);
  combat.advance(b, 2999);
  assert.equal(b.health, Math.round(health * 1.1));
  combat.advance(b, 4999);
  assert.equal(b.health, health);
  combat.advance(b, 5000);
  assert.equal(b.health, health + 60000);
  combat.hit(a, b, 6000, 'solar_phoenix', 0.1);
  combat.applyEffect(a, b, 6000, 'solar_phoenix', a, 1, 'burn2');
  combat.hit(a, b, 10500, 'beam');
  const wounded = b.health;
  combat.advance(b, 11000);
  assert.equal(b.health, wounded);
  combat.advance(b, 13499);
  assert.equal(b.health, wounded);
  combat.advance(b, 13500);
  assert.equal(b.health, wounded + 60000);
  combat.applyEffect(a, b, 13500, 'solar_phoenix', a, 1, 'burn1');
  assert.equal(b.regenBlockedUntil, 18500);
  b.health = 1;
  combat.hit(a, b, 13501, 'beam');
  assert.equal(b.regenBlockedUntil, 0);
  combat.advance(b, 16501);
  assert.equal(b.regenBlockedUntil, 0);
  assert.equal(b.immobileUntil, 0);
  assert.equal(b.health, b.maxHealth);
});
test('lobby and shared rooms enforce successful bijuu movement and teleport locks on both clients, then expire them', () => {
  for (const inRoom of [false, true]) {
    let now = 1000;
    const a = { id: 'a', name: 'A', display_name: 'A' },
      b = { id: 'b', name: 'B', display_name: 'B' },
      room = { players: [a, b] };
    const scene = inRoom
      ? createRoomSpace(
          () => now,
          () => 0.1,
        )
      : createLobby(
          () => now,
          undefined,
          () => 0.1,
        );
    const view = (user) => (inRoom ? scene.view(room, user.id) : scene.view(user));
    const move = (user, data) =>
      inRoom ? scene.move(room, user.id, data) : scene.move(user, data);
    view(a);
    view(b);
    move(a, { x: 20, y: 50 });
    move(b, { x: 40, y: 50 });
    now += 10000;
    view(a);
    chargeScene(scene, inRoom ? room : null, [a, b], 'a', (ms) => (now += ms));
    const input = { slot: 'r', aspectRatio: 1, requestId: 'bijuu-lock-once' };
    if (inRoom) scene.move(room, 'a', { action: 'attack', ...input }, 'bijuu_beam');
    else scene.attack(a, { ...input, effect: 'bijuu_beam' });
    now += 2460;
    const snapshot = view(b);
    assert.equal(snapshot.visitors.find((v) => v.id === 'b').immobileUntil, now + 1000);
    assert.throws(() => move(b, { x: 60, y: 60 }), { code: 'SCENE_IMMOBILIZED' });
    assert.throws(
      () => (inRoom ? scene.move(room, 'b', { action: 'teleport' }) : scene.teleport(b)),
      { code: 'SCENE_IMMOBILIZED' },
    );
    now += 1000;
    assert.doesNotThrow(() => move(b, { x: 60, y: 60 }));
  }
});

test('orange cat immobilizes for one second before its two-second slow', () => {
  const f = fixture('giant_orange_cat');
  const [, target] = f.actors;
  f.advance(2570);
  assert.throws(() => f.combat.canMove(target, 3569), { code: 'SCENE_IMMOBILIZED' });
  f.advance(3569);
  assert.equal(f.combat.view(target).slowMs, 0);
  f.advance(3570);
  assert.doesNotThrow(() => f.combat.canMove(target, 3570));
  assert.equal(f.combat.view(target).slowMs, 2000);
  f.advance(5569);
  assert.equal(f.combat.view(target).slowMs, 1);
  f.advance(5570);
  assert.equal(f.combat.view(target).slowMs, 0);
});

test('chains can proc slow without root and only roll once per cast', () => {
  const f = fixture('chains');
  const [, target] = f.actors;
  f.rolls([0.5, 0.9, 0.2, 0.299999, 0.5, 0.9, 0, 0]);
  f.advance(420);
  assert.equal(target.immobileUntil, 0);
  assert.equal(f.combat.view(target).slowMs, 1500);
  f.advance(1000);
  assert.equal(target.immobileUntil, 0);
  assert.equal(f.combat.view(target).slowMs, 920);
});

test('orbital can block only teleport for one second without rerolling on its second hit', () => {
  const f = fixture('orbital');
  const [, target] = f.actors;
  f.rolls([0.5, 0.9, 0.299999, 0.5, 0.9, 0]);
  f.advance(1000);
  assert.throws(() => f.combat.canTeleport(target, 1999), { code: 'SCENE_TELEPORT_BLOCKED' });
  assert.doesNotThrow(() => f.combat.canMove(target, 1500));
  assert.doesNotThrow(() => f.combat.canCast(target, 1500));
  f.advance(1400);
  assert.equal(target.teleportBlockedUntil, 2000);
  assert.doesNotThrow(() => f.combat.canTeleport(target, 2000));
});

test('vortex rolls once and deals two energy-neutral ticks on success', () => {
  for (const [effect, first] of [['flame_vortex', 400]]) {
    const f = fixture(effect);
    const [source, target] = f.actors;
    f.actors.splice(2);
    const before = target.health;
    f.rolls([0.5, 0.9, 0.299999]);
    f.advance(first + 1000);
    const tickOne = target.dotPulse.damage;
    f.advance(first + 2000);
    const dotDamage = tickOne + target.dotPulse.damage;
    assert.ok(dotDamage >= 27000 && dotDamage <= 33000);
    assert.equal(f.event.hits.filter((hit) => hit.damage > 0).length, 3);
    assert.equal(source.energy, 24);
    assert.equal(target.energy, 15);
    const directDamage = f.event.hits.reduce((sum, hit) => sum + hit.damage, 0);
    assert.equal(target.health, before - directDamage - dotDamage);
    assert.equal(target.ordinaryDot, null);
    f.advance(first + 2500);
    assert.equal(target.health, before - directDamage - dotDamage);
  }
});
