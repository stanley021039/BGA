const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abilities, createBossCombat } = require('../src/rooms/boss-combat');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const { bossZones, inBossZones } = require('../frontend/src/engines/boss-geometry.js');
function fixture() {
  const combat = createSceneCombat(() => 0.99),
    boss = { id: 'boss', name: 'Boss', x: 20, y: 70 },
    player = { id: 'player', name: 'Player', x: 50, y: 70 };
  combat.reset(boss, 0);
  combat.reset(player, 0);
  const positions = new Map([
      [boss.id, boss],
      [player.id, player],
    ]),
    timeline = createAttackTimeline(combat);
  return {
    combat,
    boss,
    player,
    positions,
    timeline,
    system: createBossCombat(combat, timeline.interceptBoss),
  };
}
test('all thirty three abilities have distinct IDs, two normals and one longer charged ultimate per boss; player loadouts reject them', () => {
  assert.equal(abilities.length, 33);
  assert.equal(new Set(abilities.map((a) => a.id)).size, 33);
  assert.equal(new Set(abilities.map((a) => a.name)).size, 33);
  const playerIds = new Set(require('../public/shared/attack-effects.json').map((a) => a.id));
  for (const id of new Set(abilities.map((a) => a.boss))) {
    const set = abilities.filter((a) => a.boss === id);
    assert.deepEqual(
      set.map((a) => a.slot),
      ['q', 'e', 'r'],
    );
    assert.ok(set[2].windup > set[0].windup);
    assert.ok(set.every((a) => !playerIds.has(a.id)));
  }
  const { botSettings } = require('../src/rooms/scene-bots');
  assert.throws(() => botSettings({ q: abilities[0].id }, [{ id: 'x' }]), {
    code: 'INVALID_SCENE_BOT',
  });
});
test('all authoritative warning shapes delay damage and hit only inside their locked zones', () => {
  for (const spec of abilities) {
    const f = fixture(),
      original = f.player.health;
    const event = f.system.prepare({ bossId: spec.boss }, f.boss, spec.id, f.player, 0);
    const zones = bossZones(spec, f.boss, f.player);
    let inside, outside;
    for (let x = 3; x <= 96; x += 3)
      for (let y = 15; y <= 96; y += 3) {
        const p = { x, y };
        if (inBossZones(zones, p)) inside ||= p;
        else outside ||= p;
      }
    assert.ok(inside && outside, spec.id);
    Object.assign(f.player, inside);
    f.system.advance(
      [event],
      f.positions,
      spec.windup - 1,
      () => {},
      (id) => id === 'boss',
    );
    assert.equal(f.player.health, original, spec.id);
    f.system.advance(
      [event],
      f.positions,
      spec.windup,
      () => {},
      (id) => id === 'boss',
    );
    assert.ok(f.player.health < original, spec.id);
    const g = fixture(),
      miss = g.system.prepare({ bossId: spec.boss }, g.boss, spec.id, g.player, 0);
    Object.assign(g.player, outside);
    g.system.advance(
      [miss],
      g.positions,
      4200,
      () => {},
      (id) => id === 'boss',
    );
    assert.equal(g.player.health, g.player.maxHealth, spec.id);
  }
});
test('casts keep their aim, stop on respawn, and damage NPC opponents without self hits', () => {
  const f = fixture(),
    spec = abilities[0],
    event = f.system.prepare({ bossId: spec.boss }, f.boss, spec.id, f.player, 0);
  f.player.x = 90;
  f.player.y = 15;
  f.system.advance(
    [event],
    f.positions,
    800,
    () => {},
    (id) => id === 'boss',
  );
  assert.equal(f.player.health, f.player.maxHealth);
  const g = fixture(),
    cast = g.system.prepare({ bossId: spec.boss }, g.boss, spec.id, g.player, 0);
  g.combat.reset(g.boss, 200);
  g.system.advance(
    [cast],
    g.positions,
    900,
    () => {},
    (id) => id === 'boss',
  );
  assert.equal(cast.cancelled, true);
  assert.equal(g.player.health, g.player.maxHealth);
  const h = fixture(),
    another = { id: 'npc', name: 'NPC', x: 50, y: 70 };
  h.combat.reset(another, 0);
  h.positions.set(another.id, another);
  const spell = h.system.prepare({ bossId: spec.boss }, h.boss, spec.id, h.player, 0);
  h.system.advance(
    [spell],
    h.positions,
    800,
    () => {},
    (id) => id !== 'player',
  );
  assert.ok(another.health < another.maxHealth);
  assert.equal(h.boss.health, h.boss.maxHealth);
});
test('crystal guard returns boss ordinary damage through its existing budget; ultimates remain unreflected', () => {
  const f = fixture(),
    guard = { id: 'guard', at: 0, fromId: f.player.id, hits: [] };
  f.timeline.armReflection(guard, f.player);
  const spec = abilities[0],
    event = f.system.prepare({ bossId: spec.boss }, f.boss, spec.id, f.player, 0);
  f.system.advance(
    [event],
    f.positions,
    700,
    () => {},
    (id) => id === 'boss',
  );
  assert.equal(f.player.health, f.player.maxHealth);
  assert.equal(guard.hits.length, 1);
  assert.equal(guard.hits[0].reflectedBossEffect, spec.id);
  f.timeline.advance([guard], f.positions.values(), 2200, () => {});
  assert.ok(f.boss.health < f.boss.maxHealth);
  const g = fixture(),
    ultimate = abilities.find((a) => a.boss === 'gatanozoa' && a.slot === 'r'),
    r = g.system.prepare({ bossId: ultimate.boss }, g.boss, ultimate.id, g.player, 0),
    shield = { id: 'guard2', at: 2500, fromId: g.player.id, hits: [] };
  g.timeline.armReflection(shield, g.player);
  g.system.advance(
    [r],
    g.positions,
    2600,
    () => {},
    (id) => id === 'boss',
  );
  assert.ok(g.player.health < g.player.maxHealth);
  assert.equal(shield.hits.length, 0);
});
test('every custom renderer shares the stage clock and disposes within the existing 4.2 second budget', async () => {
  const { createBossArtwork } = await import('../frontend/src/services/boss-artwork.js');
  let operations = 0;
  const ctx = new Proxy(
    {},
    {
      get: (_t, key) =>
        key === 'canvas'
          ? {}
          : () => {
              operations++;
            },
      set: () => true,
    },
  );
  for (const spec of abilities) {
    const scene = createBossArtwork(ctx, {
      effect: spec.id,
      width: 600,
      height: 400,
      aspectRatio: 1.6,
      bossFrom: { x: 20, y: 70 },
      bossAim: { x: 50, y: 70 },
    });
    const start = performance.now();
    assert.equal(scene.draw(start), true);
    assert.equal(scene.draw(start + 3000), true);
    assert.equal(scene.draw(start + 4300), false);
    scene.dispose();
    assert.equal(scene.draw(start), false);
  }
  assert.ok(operations < 30000);
});
