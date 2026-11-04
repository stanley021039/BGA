const { test } = require('node:test');
test('formal arena sword rules', () => {
  const assert = require('node:assert/strict');
  const { createLobbyPickups, clearEffects, kinds } = require('../src/rooms/lobby-pickups');
  const { createSceneCombat } = require('../src/rooms/scene-combat');
  const { createAttackTimeline } = require('../src/rooms/attack-timeline');
  assert(kinds.includes('sword'));
  let time = 0,
    scope = null;
  const rolls = [0, 0, 0, 0.5, 0.5, 0.99, 0, 0.45, 0.5, 0.5, 0.99];
  const arena = { pickupScope: () => scope, canCollect: () => true },
    pickups = createLobbyPickups(
      () => time,
      () => rolls.shift() ?? 0.99,
      arena,
      [],
    ),
    actor = { id: 'player', health: 100, maxHealth: 100, x: 50, y: 50, seenAt: 0 };
  function advance(at) {
    time = at;
    actor.seenAt = time;
    pickups.advance([actor], time);
  }
  advance(8000);
  advance(16000);
  const items = pickups.view().pickups;
  assert.equal(items.length, 2);
  assert(items.every((i) => i.kind === 'sword'));
  Object.assign(actor, { x: items[0].x, y: items[0].y });
  advance(16001);
  assert.equal(actor.pickupAttackUntil, 22001);
  assert.equal(actor.lastPickup.kind, 'sword');
  Object.assign(actor, { x: items[1].x, y: items[1].y });
  advance(17000);
  assert.equal(actor.pickupAttackUntil, 23000, 'refresh duration');
  assert.equal(pickups.effects(actor, 22999).pickupEffects.attackUntil, 23000);
  assert.equal(pickups.effects(actor, 23000).pickupEffects, undefined, 'exact expiry');
  scope = 'new-round';
  advance(18000);
  assert.equal(actor.pickupAttackUntil, 0, 'round cleanup');
  actor.pickupAttackUntil = 99999;
  clearEffects(actor);
  assert.equal(actor.pickupAttackUntil, 0);
  function body(id, type) {
    const a = { id, archetype: type, x: 8, y: 20 };
    createSceneCombat(() => 0.5).advance(a, 1000);
    return a;
  }
  function damage(type, buff, time = 1000) {
    const c = createSceneCombat(() => 0.5),
      from = body('from', type),
      to = body('target');
    from.pickupAttackUntil = buff ? 6000 : 0;
    return c.hit(from, to, time, 'beam').damage;
  }
  const base = damage(null, false);
  assert.equal(damage(null, true), Math.round(base * 1.2));
  assert.equal(damage('attack', true), Math.round(base * 1.4));
  assert.equal(damage(null, true, 6000), base);
  function projectile(active, late = false) {
    const c = createSceneCombat(() => 0.5),
      timeline = createAttackTimeline(c),
      from = body('from'),
      target = body('target');
    from.pickupAttackUntil = active ? 5500 : 0;
    const e = { id: 'sword-cast', effect: 'beam', at: 5000, fromX: 8, fromY: 20, aspectRatio: 1 };
    timeline.prepare(e, from, [target]);
    if (late) from.pickupAttackUntil = 10000;
    const hp = target.health;
    timeline.advance([e], [from, target], 7000, (a, t) => c.advance(a, t));
    return hp - target.health;
  }
  assert(projectile(false) > 0);
  assert.equal(
    projectile(true),
    Math.round(projectile(false) * 1.2),
    'cast keeps bonus after expiry',
  );
  assert.equal(
    projectile(false, true),
    projectile(false),
    'late pickup does not alter in-flight cast',
  );
  const combat = createSceneCombat(() => 0.5),
    victim = body('victim');
  victim.pickupAttackUntil = 90000;
  combat.environmentDamage(victim, 2000, 2);
  assert.equal(victim.pickupAttackUntil, 0, 'death cleanup');
  combat.advance(victim, victim.respawnAt);
  assert.equal(victim.pickupAttackUntil, 0, 'respawn cleanup');
  console.log(
    'PASS random sword spawn/pickup, six-second expiry, refresh, round/death cleanup, +20% damage, +40% attack archetype and cast snapshot',
  );
});
