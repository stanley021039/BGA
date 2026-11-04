const { test } = require('node:test');
test('formal arena hazards rules', () => {
  const assert = require('node:assert/strict');
  const hazards = require('../src/rooms/hazards');
  const { createSceneCombat } = require('../src/rooms/scene-combat');
  assert.equal(hazards.speed({ x: 10, y: 55 }), 0.5);
  assert.equal(hazards.speed({ x: 50, y: 40 }), 1);
  const actor = { x: 75, y: 58, health: 100, maxHealth: 100 };
  let damage = 0;
  const hit = (a, t, f) => (damage += f);
  hazards.advance(actor, 0, hit);
  hazards.advance(actor, 999, hit);
  assert.equal(damage, 0);
  hazards.advance(actor, 1000, hit);
  assert.equal(damage, 0.05);
  hazards.advance(actor, 1000, hit);
  assert.equal(damage, 0.05);
  hazards.advance(actor, 3000, hit);
  assert(Math.abs(damage - 0.15) < 1e-9);
  actor.x = 60;
  hazards.advance(actor, 4000, hit);
  assert.equal(actor.hazardKind, null);
  assert(Math.abs(damage - 0.15) < 1e-9);
  actor.x = 75;
  hazards.advance(actor, 5000, hit);
  hazards.advance(actor, 5999, hit);
  assert(Math.abs(damage - 0.15) < 1e-9);
  const combat = createSceneCombat(
    () => 0.5,
    () => false,
  );
  const victim = { id: 'victim', x: 75, y: 58, targetX: 75, targetY: 58 };
  combat.advance(victim, 0);
  const max = victim.maxHealth;
  combat.environmentDamage(victim, 1000, 0.05);
  assert.equal(victim.health, max - Math.round(max * 0.05));
  victim.pickupShieldUntil = 4000;
  const old = victim.health;
  combat.environmentDamage(victim, 2000, 0.05);
  assert.equal(victim.health, old - Math.round(max * 0.05 * 0.7));
  combat.environmentDamage(victim, 5000, 2);
  assert.equal(victim.health, 0);
  assert(victim.respawnAt > 5000);
  assert.equal(victim.pickupShieldUntil, 0);
  combat.advance(victim, victim.respawnAt);
  assert.equal(victim.health, victim.maxHealth);
  console.log(
    'PASS mud multiplier; burn entry grace, cadence, dedupe, exit/re-entry; actual shield damage/death/respawn',
  );
});
