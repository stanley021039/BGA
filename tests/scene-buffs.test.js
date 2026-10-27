const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const timing = require('../public/shared/attack-timing.json');
const { createLobby } = require('../src/rooms/lobby');
const { createRoomSpace } = require('../src/rooms/space');
function setup(author = false) {
  const combat = createSceneCombat(
      () => 0.5,
      (id) => author && id === 'a',
    ),
    a = { id: 'a', x: 20, y: 50 },
    b = { id: 'b', x: 40, y: 50 };
  combat.advance(a, 0);
  combat.advance(b, 0);
  return { combat, a, b };
}
test('Guanyin health scales proportionally, refreshes without healing, and expires exactly at two seconds', () => {
  for (const author of [false, true]) {
    const { combat, a, b } = setup(author),
      max = a.maxHealth;
    a.health = max / 2;
    combat.cast(a, 'guanyin_barrage', 1000);
    assert.equal(a.maxHealth, Math.round(max * 1.1));
    assert.equal(a.health, a.maxHealth / 2);
    combat.cast(a, 'guanyin_barrage', 1500);
    assert.equal(a.health, a.maxHealth / 2);
    assert.equal(combat.hit(a, b, 3499, 'beam').damage, author ? 253000 : 220000);
    assert.equal(combat.hit(a, b, 3500, 'beam').damage, author ? 230000 : 200000);
    // Keep wounded with no eligible regeneration ticks during the expiry check.
    a.lastHitAt = a.regenAt = 2000;
    combat.advance(a, 3500);
    assert.equal(a.maxHealth, max);
    assert.equal(a.health, max / 2);
  }
});
test('Guanyin regen bonus is ten percent, stacks with author proportionally, and late polls match regular polls', () => {
  for (const author of [false, true]) {
    const early = setup(author),
      late = setup(author);
    for (const { combat, a } of [early, late]) {
      a.health = 400000;
      combat.cast(a, 'guanyin_barrage', 2500);
    }
    for (const t of [3000, 4000, 4500, 5000, 6000]) early.combat.advance(early.a, t);
    late.combat.advance(late.a, 6000);
    assert.equal(late.a.health, early.a.health);
    assert.ok(Number.isInteger(late.a.health));
    assert.equal(late.a.maxHealth, author ? 1800000 : 1200000);
    const healedAtExpiry = Math.round((440000 + (author ? 66000 : 44000) * 2) / 1.1);
    assert.equal(late.a.health, healedAtExpiry + (author ? 60000 : 40000) * 2);
  }
});
test('Excalibur has twenty percent guard only during its cast and composes with full/residual shields', () => {
  const { combat, a, b } = setup();
  combat.cast(b, 'excalibur', 1000);
  assert.equal(combat.hit(a, b, 1000, 'beam').damage, 160000);
  combat.protect(b, 1100);
  assert.equal(combat.hit(a, b, 1200, 'beam').damage, 104000);
  assert.equal(combat.hit(a, b, 3100, 'beam').damage, 132000);
  assert.equal(combat.hit(a, b, 5099, 'beam').damage, 132000);
  assert.equal(combat.hit(a, b, 5100, 'beam').damage, 165000);
  b.health = 1;
  combat.hit(a, b, 5101, 'beam');
  assert.equal(b.excaliburUntil, 0);
  assert.equal(b.shieldResidualUntil, 0);
});
test('Explosion recovery starts after VFX and never carries over to a respawned life', () => {
  for (const reborn of [false, true]) {
    const { combat, a, b } = setup(),
      timeline = createAttackTimeline(combat);
    const event = {
      id: 'explosion',
      effect: 'explosion',
      at: 0,
      fromId: 'a',
      toId: 'b',
      fromX: 20,
      fromY: 50,
      toX: 40,
      toY: 50,
      aspectRatio: 1,
    };
    timeline.prepare(event, a, [b]);
    const advance = (t) => timeline.advance([event], [a, b], t, (p, at) => combat.advance(p, at));
    advance(4099);
    assert.doesNotThrow(() => combat.canMove(a, 4099));
    if (reborn) {
      a.lifeId++;
      a.immobileUntil = 0;
    }
    advance(4100);
    if (reborn) assert.doesNotThrow(() => combat.canMove(a, 4100));
    else {
      assert.throws(() => combat.canMove(a, 5099), { code: 'SCENE_IMMOBILIZED' });
      assert.doesNotThrow(() => combat.canMove(a, 5100));
    }
  }
});
test('staged attacks divide a fixed total, with explicit Ea and phoenix extra phases and bounded payloads', () => {
  for (const [effect, phases] of Object.entries(timing)) {
    assert.ok(phases.length <= 5);
    assert.equal(new Set(phases.map((p) => p[2])).size, phases.length);
    assert.ok(phases.every(([at, w]) => at >= 0 && at <= 4100 && w > 0));
    const total = phases.reduce((sum, p) => sum + p[1], 0);
    assert.ok(
      Math.abs(total - (effect === 'gate_of_babylon' ? 3 : effect === 'solar_phoenix' ? 1.2 : 1)) <
        1e-9,
      effect,
    );
  }
  const { combat, a } = setup(),
    timeline = createAttackTimeline(combat);
  const victims = Array.from({ length: 40 }, (_, i) => ({
    id: 'v' + i,
    x: 40,
    y: 50,
    health: 1200000,
    lifeId: 1,
  }));
  const event = { effect: 'guanyin_barrage', at: 0 };
  timeline.prepare(event, a, victims);
  assert.equal(event.hits.length, 160);
  assert.equal(new Set(event.hits.map((h) => h.toId)).size, 32);
});
test('self-only status reports real shield phases, temporary buffs and the two-second regeneration boundary', () => {
  const { combat, a, b } = setup(true);
  assert.equal(combat.view(a).combatStatus, undefined);
  combat.protect(a, 0);
  combat.cast(a, 'guanyin_barrage', 0);
  combat.cast(a, 'excalibur', 0);
  combat.advance(a, 1500);
  let status = combat.view(a, true).combatStatus;
  assert.equal(status.guanyin, true);
  assert.equal(status.excalibur, true);
  assert.equal(status.shield, 'full');
  assert.equal(status.regenPerSecond, 66000);
  assert.equal(status.regenerating, false);
  combat.hit(b, a, 1500, 'beam');
  combat.advance(a, 3499);
  status = combat.view(a, true).combatStatus;
  assert.equal(status.guanyin, false);
  assert.equal(status.shield, 'residual');
  assert.equal(status.regenWaitMs, 1);
  assert.equal(status.regenerating, false);
  combat.advance(a, 3500);
  assert.equal(combat.view(a, true).combatStatus.regenerating, true);
  combat.advance(a, 5000);
  status = combat.view(a, true).combatStatus;
  assert.equal(status.shield, 'none');
  assert.equal(status.excalibur, false);
  assert.equal(status.regenPerSecond, 60000);
  a.health = 1;
  combat.hit(b, a, 5001, 'beam');
  assert.equal(combat.view(a, true).combatStatus.regenerating, false);
});
test('lobby and room snapshots disclose combat bonuses only to the owning player', () => {
  const users = ['a', 'b'].map((id) => ({ id, name: id, display_name: id }));
  const lobby = createLobby(
      () => 1000,
      undefined,
      () => 0.5,
    ),
    space = createRoomSpace(
      () => 1000,
      () => 0.5,
    ),
    room = { players: users };
  users.forEach((user) => lobby.view(user));
  for (const user of users) {
    for (const snapshot of [lobby.view(user), space.view(room, user.id)]) {
      assert.ok(snapshot.visitors.find((v) => v.id === user.id).combatStatus);
      assert.equal(snapshot.visitors.find((v) => v.id !== user.id).combatStatus, undefined);
    }
  }
});
