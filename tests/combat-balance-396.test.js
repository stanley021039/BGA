'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const energy = require('../src/rooms/scene-energy');
function fixture() {
  const c = createSceneCombat(() => 0.5),
    a = { id: 'a', x: 10, y: 50, energyMaximum: 150, ordinaryHitEnergy: 12 },
    b = { id: 'b', x: 30, y: 50, energyMaximum: 150, ordinaryHitEnergy: 12 };
  c.advance(a, 0);
  c.advance(b, 0);
  return { c, a, b };
}
test('ordinary cast energy diminishes across effective hits and return flight grants none', () => {
  const { a, b } = fixture(),
    source = { health: 1, energyActor: a, energyLifeId: a.lifeId };
  a.energy = 0;
  for (let i = 0; i < 5; i++) energy.hit(source, b, 'barrage', 1);
  assert.equal(a.energy, 24);
  a.energy = 0;
  energy.hit(
    { health: 1, energyActor: a, energyLifeId: a.lifeId },
    b,
    'returning_moon',
    1,
    'return',
  );
  assert.equal(a.energy, 0);
  a.archetype = 'energy';
  const second = { health: 1, energyActor: a, energyLifeId: a.lifeId };
  for (let i = 0; i < 5; i++) energy.hit(second, b, 'barrage', 1);
  assert.equal(a.energy, 28);
});
test('shield first guard grants fifteen once, and beam grants ten percent additional energy', () => {
  const { c, a, b } = fixture();
  a.energy = 0;
  c.hit(a, b, 0, 'beam');
  assert.equal(a.energy, 13.2);
  b.energy = 0;
  c.protect(b, 0, 'shield');
  c.hit(a, b, 1, 'beam');
  assert.equal(b.energy, 20);
  c.hit(a, b, 2, 'beam');
  assert.equal(b.energy, 25);
});
test('direct heals are capped per cast and Guanyin starts at first impact', () => {
  const { c, a, b } = fixture();
  a.health = a.maxHealth / 2;
  const source = { health: 1, energyActor: a, energyLifeId: a.lifeId, id: a.id };
  for (let i = 0; i < 4; i++) c.hit(source, b, i, 'refracting_prism', 0.1);
  assert.equal(a.health, a.maxHealth * 0.53);
  c.cast(a, 'guanyin_barrage', 100);
  assert.equal(a.guanyinUntil, 0);
  c.hit(source, b, 200, 'guanyin_barrage', 0.2);
  assert.equal(a.guanyinUntil, 3200);
});
test('paralysis permits attacks while time stop blocks them; Ea costs current health twenty percent', () => {
  const { c, a } = fixture();
  c.freeze(a, 0, 1500);
  assert.doesNotThrow(() => c.canCast(a, 100));
  assert.throws(() => c.canMove(a, 100));
  a.stasisUntil = 1400;
  assert.throws(() => c.canCast(a, 100), { code: 'SCENE_TIME_STOPPED' });
  const hp = a.health;
  c.cast(a, 'gate_of_babylon', 2000);
  assert.equal(a.health, hp * 0.8);
});

test('independent slows, paralysis and timed buffs clear on death and respawn', () => {
  const { c, a, b } = fixture();
  c.applyEffect(a, b, 100, 'giant_orange_cat', a);
  assert.equal(b.orangeSlowUntil, 3100);
  b.strongSlowUntil = 1600;
  b.slowUntil = 4100;
  c.advance(b, 1599);
  assert.equal(c.view(b).slowMultiplier, 0.5);
  c.advance(b, 1600);
  assert.equal(c.view(b).slowMultiplier, 0.6);
  c.advance(b, 3100);
  assert.equal(c.view(b).slowMultiplier, 0.8);
  b.regenBuffUntil = b.regenDebuffUntil = b.energyDebuffUntil = b.critBuffUntil = 9000;
  b.health = 1;
  c.hit(a, b, 3200, 'beam');
  for (const key of [
    'orangeSlowUntil',
    'strongSlowUntil',
    'slowUntil',
    'regenBuffUntil',
    'regenDebuffUntil',
    'energyDebuffUntil',
    'critBuffUntil',
    'stasisUntil',
  ])
    assert.equal(b[key], 0, key);
  c.advance(b, 6200);
  assert.equal(b.health, b.maxHealth);
});
test('paper energy reduction excludes pickup gains, and reflection shares its cast cap', () => {
  const { a, b } = fixture();
  a.energyDebuffUntil = 2000;
  a.combatAt = 100;
  a.energy = 0;
  energy.gain(a, 10);
  assert.equal(a.energy, 9);
  energy.gain(a, 10, undefined, false);
  assert.equal(a.energy, 19);
  a.energy = 0;
  a.energyDebuffUntil = 0;
  const budget = { ordinaryEnergyRemaining: 12 };
  for (let i = 0; i < 4; i++)
    energy.hit(
      { health: 1, energyActor: a, energyLifeId: a.lifeId, reflectionBudget: budget },
      b,
      'barrage',
      1,
      'reflection',
    );
  assert.equal(a.energy, 12);
});
test('regeneration modifiers expire exactly and late polling equals regular polling', () => {
  const early = fixture(),
    late = fixture();
  for (const { a } of [early, late]) {
    a.health = 100000;
    a.regenBuffUntil = 4500;
    a.regenDebuffUntil = 3500;
  }
  for (const t of [3000, 3500, 4000, 4500, 5000, 6000]) early.c.advance(early.a, t);
  late.c.advance(late.a, 6000);
  assert.equal(late.a.health, early.a.health);
  assert.equal(late.a.health, 100000 + 39600 + 44000 + 40000 + 40000);
});

test('Bijuu thirty-percent slow never inherits the expiry of an existing weaker slow', () => {
  const c = createSceneCombat(() => 0),
    a = { id: 'a' },
    b = { id: 'b' };
  c.advance(a, 0);
  c.advance(b, 0);
  b.slowUntil = 9000;
  c.applyEffect(a, b, 100, 'bijuu_beam', a);
  assert.equal(b.bijuuSlowUntil, 2100);
  c.advance(b, 2099);
  assert.equal(c.view(b).slowMultiplier, 0.7);
  c.advance(b, 2100);
  assert.equal(c.view(b).slowMultiplier, 0.8);
});
