const { test } = require('node:test');
test('formal arena hazards rules', () => {
  const assert = require('node:assert/strict');
  const hazards = require('../src/rooms/hazards');
  const { createSceneCombat } = require('../src/rooms/scene-combat');
  assert.equal(hazards.speed({ x: 10, y: 55 }), 0.5);
  assert.equal(hazards.speed({ x: 50, y: 40 }), 1);
  const actor = { x: 73.5, y: 55.5, health: 100, maxHealth: 100 };
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
  actor.x = 73.5;
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

test('each match layout has compact, distinct hazard zones clear of walls', () => {
  const assert = require('node:assert/strict');
  const { createHazards } = require('../src/rooms/hazards');
  const { createWalls, layoutCount } = require('../src/rooms/walls');
  const signatures = new Set();
  for (let layout = 1; layout < layoutCount; layout++) {
    const { zones } = createHazards(layout);
    const { covers } = createWalls(layout);
    for (const z of zones) {
      assert.ok(z.width <= 11 && z.height <= 7);
      assert.ok(
        !covers.some(
          (w) =>
            z.x < w.x + w.width &&
            z.x + z.width > w.x &&
            z.y < w.y + w.height &&
            z.y + z.height > w.y,
        ),
      );
    }
    signatures.add(JSON.stringify(zones));
  }
  assert.equal(signatures.size, layoutCount - 1);
});

test('expanded embers deal half-second ticks and two seconds of weaker afterburn', () => {
  const assert = require('node:assert/strict');
  const { createHazards } = require('../src/rooms/hazards');
  const hazards = createHazards(0, true, undefined, () => 0.5);
  const zone = hazards.zones.find((item) => item.kind === 'embers');
  const actor = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2, health: 100 };
  const hits = [];
  const damage = (_actor, time, ratio) => hits.push([time, ratio]);
  for (const time of [0, 499, 500, 1000]) hazards.advance(actor, time, damage);
  assert.deepEqual(
    hits.map(([time]) => time),
    [500, 1000],
  );
  assert.ok(hits.every(([, ratio]) => Math.abs(ratio - 0.05) < 1e-9));
  actor.x = 1;
  for (const time of [1100, 1599, 1600, 3100, 3600]) hazards.advance(actor, time, damage);
  assert.deepEqual(
    hits.slice(2).map(([time]) => time),
    [1600, 2100, 2600, 3100],
  );
  assert.ok(Math.abs(hits.slice(2).reduce((sum, [, ratio]) => sum + ratio, 0) - 0.02) < 1e-9);
});

test('expanded terrain rolls positions for walls, traps and bushes while keeping portals clear', () => {
  const assert = require('node:assert/strict');
  const { rollArenaRegions, portals } = require('../src/rooms/arena-expanded-map');
  const { createWalls } = require('../src/rooms/walls');
  const { createHazards } = require('../src/rooms/hazards');
  const { createBushes } = require('../src/rooms/lobby-bushes');
  const low = rollArenaRegions(() => 0);
  const high = rollArenaRegions(() => 0.99);
  for (const layout of [1, 2, 3]) {
    for (const offsets of [low, high]) {
      const walls = createWalls(layout, true, offsets);
      const hazards = createHazards(layout, true, offsets);
      const bushes = createBushes(layout, [...walls.covers, ...hazards.zones], true, offsets);
      for (const portal of portals) {
        assert.deepEqual(walls.safePoint(portal), { x: portal.x, y: portal.y });
        assert.equal(hazards.at(portal), undefined);
      }
      assert.equal(bushes.filter((b) => b.id.startsWith('wing-')).length, 4);
    }
  }
  for (const build of [
    (offsets) => createWalls(1, true, offsets).covers,
    (offsets) => createHazards(1, true, offsets).zones,
    (offsets) => createBushes(1, [], true, offsets),
  ])
    assert.notDeepEqual(build(low), build(high));
});
