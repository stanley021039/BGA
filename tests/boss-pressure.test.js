const { test } = require('node:test');
const assert = require('node:assert/strict');
const abilities = require('../public/shared/boss-abilities.json');
const rules = require('../public/shared/boss-rules.json');
const {
  bossStageSpec,
  bossAttackPlan,
  inBossZones,
} = require('../frontend/src/engines/boss-geometry.js');
const { createSceneCombat, authorSpeed } = require('../src/rooms/scene-combat');
const { createBossCombat } = require('../src/rooms/boss-combat');
const { driveBoss } = require('../src/rooms/scene-bosses');
const ailments = require('../src/rooms/boss-ailments');

function fixture(base, phase) {
  const combat = createSceneCombat(() => 0.99);
  const boss = { id: 'boss', name: 'Boss', bossId: base.boss, x: 35, y: 70 };
  combat.reset(boss, 0);
  boss.bossPhase = phase;
  boss.health = (boss.maxHealth * (4 - phase)) / 3;
  const positions = new Map([[boss.id, boss]]);
  function add(id, point) {
    const actor = { id, name: id, ...point };
    combat.reset(actor, 0);
    actor.health = actor.maxHealth = 1000000000;
    actor.energy = 100;
    positions.set(id, actor);
    return actor;
  }
  return { combat, boss, positions, add, system: createBossCombat(combat) };
}

test('all 117 Boss casts hit two separated players in one strike while a reachable safe player takes no damage', () => {
  for (const base of abilities)
    for (const phase of [1, 2, 3]) {
      const f = fixture(base, phase),
        spec = bossStageSpec(base, phase);
      const aim = { id: 'aim', x: 60, y: 70 };
      const plan = bossAttackPlan(spec, f.boss, aim);
      const first = plan[0];
      let a, b, safe;
      for (let x = 6; x <= 94; x += 2)
        for (let y = 14; y <= 96; y += 2) {
          const p = { x, y };
          if (inBossZones(first.zones, p)) {
            a ||= p;
            if (Math.hypot(x - a.x, y - a.y) >= 10) b ||= p;
          }
          if (
            !inBossZones(
              plan.flatMap((s) => s.zones),
              p,
            )
          )
            safe ||= p;
        }
      const label = `${base.id}/${phase}`;
      assert.ok(a && b && safe, label + ' multi-player coverage and escape');
      const p1 = f.add('p1', a),
        p2 = f.add('p2', b),
        p3 = f.add('safe', safe);
      const event = f.system.prepare({ bossId: base.boss }, f.boss, base.id, aim, 0);
      const at = first.at / rules.phases[phase - 1].attackRate;
      f.system.advance([event], f.positions, at - 1, () => {});
      assert.equal(p1.health, 1000000000, label + ' respects telegraph');
      f.system.advance([event], f.positions, at, () => {});
      assert.ok(p1.health < 1000000000 && p2.health < 1000000000, label + ' same strike hits both');
      f.system.advance([event], f.positions, 4400, () => {});
      assert.equal(p3.health, 1000000000, label + ' safe corridor is real');
      assert.ok(event.hits.some((h) => h.toId === 'p1') && event.hits.some((h) => h.toId === 'p2'));
    }
});

test('every Boss ultimate applies its special effects only on hit, with bounded expiry and one energy drain per cast', () => {
  for (const base of abilities.filter((s) => s.slot === 'r'))
    for (const phase of [1, 2, 3]) {
      const f = fixture(base, phase),
        spec = bossStageSpec(base, phase),
        aim = { id: 'aim', x: 60, y: 70 };
      const plan = bossAttackPlan(spec, f.boss, aim),
        strike = plan[0];
      let inside, outside;
      for (let x = 6; x <= 94; x += 2)
        for (let y = 14; y <= 96; y += 2) {
          const p = { x, y };
          if (inBossZones(strike.zones, p)) inside ||= p;
          if (
            !inBossZones(
              plan.flatMap((s) => s.zones),
              p,
            )
          )
            outside ||= p;
        }
      const victim = f.add('hit', inside),
        safe = f.add('miss', outside);
      const event = f.system.prepare({ bossId: base.boss }, f.boss, base.id, aim, 0);
      const at = strike.at / rules.phases[phase - 1].attackRate;
      const fx = strike.effects,
        label = `${base.id}/${phase}`;
      f.system.advance([event], f.positions, at, () => {});
      assert.equal(safe.energy, 100, label + ' misses do not drain');
      assert.equal(safe.bossAilments?.armor?.percent || 0, 0);
      for (const kind of ['armor', 'healing', 'recovery'])
        if (fx[kind]) {
          assert.equal(ailments.percent(victim, kind, at), fx[kind], label + '/' + kind);
          assert.equal(ailments.percent(victim, kind, at + fx.ms + 1), 0, label + ' expiry');
        }
      if (fx.slow === 20) assert.equal(victim.slowUntil, at + fx.ms, label + ' slow');
      else if (fx.slow) {
        assert.equal(victim.bossSlowPercent, fx.slow, label + ' slow');
        assert.equal(victim.bossSlowUntil, at + fx.ms);
      }
      if (fx.drain) {
        assert.equal(victim.energy, 100 - fx.drain, label + ' drain');
        f.system.advance([event], f.positions, 4400, () => {});
        assert.ok(
          victim.energy >= 100 - fx.drain &&
            victim.energy <= 100 - fx.drain + (plan.length - 1) * 5,
          label + ' drain is not repeated; received hits still grant energy',
        );
      }
      if (fx.pull)
        assert.ok(Math.hypot(victim.x - inside.x, victim.y - inside.y) > 0, label + ' pull');
      assert.ok(
        Object.keys(fx).some((k) => !['root', 'ms', 'slow', 'pull', 'drain'].includes(k)) ||
          fx.slow ||
          fx.pull ||
          fx.drain,
        label,
      );
    }
});

test('AI Boss recovery is shorter in every phase, movement is faster and final stage remains the fastest', () => {
  for (const phase of [1, 2, 3]) {
    const f = fixture(abilities[0], phase),
      rate = rules.phases[phase - 1].attackRate;
    assert.ok(authorSpeed(f.boss) > 1.3 * rules.phases[phase - 1].speed);
    for (const step of [0, 2]) {
      const state = {
        lifeId: f.boss.lifeId,
        step,
        pending: { until: 100 },
        rate,
        moveAt: 1000000000,
      };
      driveBoss({ bossId: f.boss.bossId }, f.boss, { x: 60, y: 70 }, 100, state);
      const old = ((step === 2 ? 4200 : 2600) * (phase === 3 ? 0.55 : 0.8)) / rate;
      assert.ok(state.attackAt - 100 <= old * 0.7);
    }
  }
});
