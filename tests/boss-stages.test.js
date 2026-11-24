const { test } = require('node:test');
const assert = require('node:assert/strict');
const abilities = require('../public/shared/boss-abilities.json');
const {
  bossStageSpec,
  bossAttackPlan,
  inBossZones,
  bossZonePath,
} = require('../frontend/src/engines/boss-geometry.js');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createBossCombat } = require('../src/rooms/boss-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const ailments = require('../src/rooms/boss-ailments');
const energy = require('../src/rooms/scene-energy');
function setup(boss = 'cthulhu', phase = 2) {
  const combat = createSceneCombat(() => 0.99),
    from = { id: 'boss', name: 'Boss', bossId: boss, x: 20, y: 65 },
    to = { id: 'target', name: 'Target', x: 55, y: 65 };
  combat.reset(from, 0);
  combat.reset(to, 0);
  from.bossPhase = phase;
  from.health = (from.maxHealth * (4 - phase)) / 3;
  to.energy = 100;
  to.energyMaximum = 150;
  const positions = new Map([
      [from.id, from],
      [to.id, to],
    ]),
    timeline = createAttackTimeline(combat),
    system = createBossCombat(combat, timeline.interceptBoss);
  return { combat, from, to, positions, system, timeline };
}
function pointIn(zones, inside = true) {
  for (let x = 2; x <= 98; x += 2)
    for (let y = 14; y <= 96; y += 2) {
      const p = { x, y };
      if (inBossZones(zones, p) === inside) return p;
    }
  throw Error('no reachable ' + inside + ' point');
}
test('all 117 phase abilities keep bounded telegraphs, reachable safe areas, original total damage and at least 550ms ordinary warning', () => {
  for (const base of abilities)
    for (const phase of [1, 2, 3]) {
      assert.ok(base.stages?.[2] && base.stages?.[3], base.id);
      const spec = bossStageSpec(base, phase),
        plan = bossAttackPlan(spec, { x: 20, y: 65 }, { x: 55, y: 65 }),
        rate = [1, 1.15, 1.3][phase - 1];
      assert.ok(plan.length >= 1 && plan.length <= 3, base.id);
      assert.ok(spec.windup / rate >= (base.slot === 'r' ? 1400 : 550));
      assert.ok(plan.at(-1).at + 500 <= 4200);
      assert.ok(
        Math.abs(plan.reduce((n, p) => n + p.damage, 0) - base.damage * base.pulses) < 1e-9,
      );
      for (const strike of plan) {
        pointIn(strike.zones);
        pointIn(strike.zones, false);
        assert.ok(strike.zones.length <= 6);
        for (const z of strike.zones) {
          assert.ok(!/NaN|Infinity|undefined/.test(bossZonePath(z)));
          for (const v of Object.values(z))
            if (typeof v === 'number') assert.ok(Number.isFinite(v));
        }
      }
    }
});
test('each phase variant settles only its warned locked zones and preserves the captured phase after the caster changes', () => {
  for (const base of abilities)
    for (const phase of [2, 3]) {
      const f = setup(base.boss, phase),
        event = f.system.prepare({ bossId: base.boss }, f.from, base.id, f.to, 1000);
      const spec = bossStageSpec(base, phase),
        strike = bossAttackPlan(spec, f.from, f.to)[0];
      const p = pointIn(strike.zones);
      Object.assign(f.to, p);
      const at = 1000 + strike.at / [1, 1.15, 1.3][phase - 1];
      f.system.advance([event], f.positions, at - 0.01, () => {});
      assert.equal(f.to.health, f.to.maxHealth, base.id);
      f.from.bossPhase = 3;
      f.system.advance([event], f.positions, at, () => {});
      assert.ok(f.to.health < f.to.maxHealth, base.id);
      assert.equal(event.bossPhase, phase);
      const miss = setup(base.boss, phase),
        e = miss.system.prepare({ bossId: base.boss }, miss.from, base.id, miss.to, 1000);
      Object.assign(miss.to, pointIn(strike.zones, false));
      miss.system.advance([e], miss.positions, at, () => {});
      assert.equal(miss.to.health, miss.to.maxHealth, base.id);
    }
});
test('Zagi second-phase punch applies exactly 15 percent slow for 800ms and respects stronger slows', () => {
  const f = setup('dark-zagi', 2),
    base = abilities.find((a) => a.id === 'boss_dark_zagi_q');
  const event = f.system.prepare({ bossId: 'dark-zagi' }, f.from, base.id, f.to, 1000);
  const strike = bossAttackPlan(bossStageSpec(base, 2), f.from, f.to)[0];
  Object.assign(f.to, pointIn(strike.zones));
  const at = 1000 + strike.at / 1.15;
  f.system.advance([event], f.positions, at, () => {});
  f.combat.advance(f.to, at);
  assert.equal(f.combat.view(f.to).slowMultiplier, 0.85);
  assert.ok(Math.abs(f.combat.view(f.to).slowMs - 800) < 1e-6);
  f.to.strongSlowUntil = at + 500;
  f.combat.advance(f.to, at + 100);
  assert.equal(f.combat.view(f.to).slowMultiplier, 0.5);
  f.combat.advance(f.to, at + 800);
  assert.equal(f.combat.view(f.to).slowMs, 0);
  f.combat.reset(f.to, at + 200);
  assert.equal(f.to.bossSlowUntil, 0);
  assert.equal(bossStageSpec(base, 1).effects?.slow, undefined);
  assert.equal(bossStageSpec(base, 3).effects?.slow, undefined);
});
test('gap corridors and fork centre are safe while neighboring attack paths hit', () => {
  for (const id of [
    'boss_mutalith_r',
    'boss_cthulhu_r',
    'boss_hyper_zetton_r',
    'boss_colossal_r',
  ]) {
    const s = bossStageSpec(
      abilities.find((a) => a.id === id),
      3,
    );
    for (const strike of bossAttackPlan(s, { x: 25, y: 65 }, { x: 55, y: 65 })) {
      const z = strike.zones[0],
        r = (z.r + z.inner) / 2;
      assert.equal(
        inBossZones([z], {
          x: z.x + Math.cos(z.direction) * r,
          y: (z.y + Math.sin(z.direction) * r) * 1.6,
        }),
        false,
      );
      assert.equal(
        inBossZones([z], {
          x: z.x - Math.cos(z.direction) * r,
          y: (z.y - Math.sin(z.direction) * r) * 1.6,
        }),
        true,
      );
    }
  }
  const s = bossStageSpec(
      abilities.find((a) => a.id === 'boss_gyo_e'),
      3,
    ),
    zones = bossAttackPlan(s, { x: 20, y: 65 }, { x: 55, y: 65 })[0].zones;
  assert.equal(inBossZones(zones, { x: 50, y: 65 }), false);
});
test('dimension mark grants exactly one extra drain per cast, not one drain per eye', () => {
  const f = setup('prismatic-void', 3);
  ailments.mark(f.to, 'dimension', 1, 0, 3000);
  const e = f.system.prepare(
    { bossId: 'prismatic-void' },
    f.from,
    'boss_prismatic_void_e',
    f.to,
    0,
  );
  const p = bossAttackPlan(
    bossStageSpec(
      abilities.find((a) => a.id === e.effect),
      3,
    ),
    f.from,
    f.to,
  );
  for (const strike of p) {
    Object.assign(f.to, pointIn(strike.zones));
    f.system.advance([e], f.positions, strike.at / 1.3, () => {});
  }
  assert.equal(f.to.energy, 107);
  assert.equal(ailments.percent(f.to, 'dimension', 100), 0);
});
test('healing and recovery suppression use strongest reduction, expire on time and reset on death', () => {
  const f = setup();
  f.to.health -= 200000;
  f.to.lastHitAt = 0;
  f.to.regenAt = 2000;
  f.to.regenDebuffUntil = 4500;
  ailments.mark(f.to, 'healing', 15, 2500, 2000);
  const health = f.to.health;
  f.combat.advance(f.to, 5000);
  assert.equal(f.to.health - health, 108000);
  f.to.combatAt = 1000;
  f.to.energy = 0;
  f.to.energyDebuffUntil = 2000;
  ailments.mark(f.to, 'recovery', 15, 0, 2000);
  energy.gain(f.to, 12);
  assert.equal(f.to.energy, 10.2);
  f.combat.reset(f.to, 6000);
  assert.deepEqual(f.to.bossAilments, {});
  ailments.mark(f.to, 'armor', 10, 6000, 2000);
  f.combat.hit(f.from, f.to, 6001, 'boss_cthulhu_q', 100);
  assert.equal(f.to.health, 0);
  assert.deepEqual(f.to.bossAilments, {});
});
test('multiple bosses cannot chain their final-pulse controls during shared player protection', () => {
  const f = setup('gatanozoa', 2);
  // Keep this control-protection case alive through both stronger ultimate casts.
  f.to.health = f.to.maxHealth *= 4;
  const e = f.system.prepare({ bossId: 'gatanozoa' }, f.from, 'boss_gatanozoa_r', f.to, 0);
  const other = { id: 'other', bossId: 'greeza', x: 20, y: 65 };
  f.combat.reset(other, 0);
  other.bossPhase = 2;
  other.health = (other.maxHealth * 2) / 3;
  f.positions.set(other.id, other);
  const second = f.system.prepare({ bossId: 'greeza' }, other, 'boss_greeza_r', f.to, 100);
  f.system.advance([e], f.positions, 3700 / 1.15, () => {});
  const until = f.to.immobileUntil;
  assert.ok(until > 3700 / 1.15);
  f.system.advance([second], f.positions, 100 + 3700 / 1.15, () => {});
  assert.equal(f.to.immobileUntil, until);
});
test('staged ordinary reflection carries the exact phase and strike; respawn cancels later waves', () => {
  const f = setup('arkveld', 3),
    guard = {
      id: 'guard',
      effect: 'crystal_reflection',
      at: 0,
      until: 2800,
      fromId: f.to.id,
      fromX: f.to.x,
      fromY: f.to.y,
      toId: f.from.id,
      toX: f.from.x,
      toY: f.from.y,
    };
  f.timeline.armReflection(guard, f.to);
  const e = f.system.prepare({ bossId: 'arkveld' }, f.from, 'boss_arkveld_q', f.to, 0);
  f.system.advance([e], f.positions, 550, () => {});
  assert.equal(guard.hits[0].reflectedBossPhase, 3);
  assert.equal(guard.hits[0].reflectedBossStrike, 0);
  const count = e.hits.length;
  f.combat.reset(f.from, 600);
  f.system.advance([e], f.positions, 3000, () => {});
  assert.equal(e.cancelled, true);
  assert.equal(e.hits.length, count);
});
