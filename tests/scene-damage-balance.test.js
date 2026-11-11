const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const { attackKind } = require('../src/rooms/attack-kind');
const effects = require('../public/shared/attack-effects.json');
// Approved whole-cast damage at the midpoint of the 18–22 range, without criticals.
const totals = {
  barrage: 160000,
  beam: 200000,
  chains: 180000,
  orbital: 180000,
  funnel: 180000,
  singularity: 180000,
  blade_aura: 180000,
  blade_aura_crimson: 180000,
  chain_lightning: 160000,
  frost_spikes: 160000,
  arrow_volley: 150000,
  flame_vortex: 150000,
  railgun: 210000,
  plasma_pulse: 180000,
  micro_missiles: 140000,
  photon_sniper: 210000,
  returning_moon: 300000,
  tidal_blades: 180000,
  magnetic_disc: 180000,
  venom_thorn: 180000,
  quicksand_trap: 180000,
  refracting_prism: 160000,
  bell_shockwave: 180000,
  shadow_lunge: 200000,
  seeking_talismans: 160000,
  sakura_swarm: 160000,
};
for (const definition of effects.filter((e) => totals[attackKind(e.id)]))
  test(definition.id + ' whole-cast damage, diminishing energy and idempotent settlement', () => {
    const combat = createSceneCombat(() => 0.5),
      timeline = createAttackTimeline(combat);
    const a = { id: 'a', x: 20, y: 50, ordinaryHitEnergy: 12, energyMaximum: 150 },
      b = { id: 'b', x: 40, y: 50 };
    [a, b].forEach((actor) => combat.advance(actor, 0));
    b.health = b.maxHealth = 100000000;
    const event = {
      id: 'cast',
      effect: definition.id,
      at: 0,
      fromId: 'a',
      fromX: 20,
      fromY: 50,
      toId: 'b',
      toX: 40,
      toY: 50,
      aspectRatio: 1,
    };
    timeline.prepare(event, a, [b]);
    timeline.advance([event], [a, b], 2400, combat.advance);
    const damage = event.hits.reduce((n, h) => n + h.damage, 0);
    assert.equal(damage, totals[attackKind(definition.id)]);
    const id = attackKind(definition.id),
      hits = event.hits.filter((h) => h.damage > 0).length;
    const expected =
      id === 'beam' ? 13.2 : id === 'returning_moon' ? 12 : hits === 1 ? 12 : hits === 2 ? 18 : 24;
    assert.equal(a.energy, expected);
    timeline.advance([event], [a, b], 2400, combat.advance);
    assert.equal(a.energy, expected);
    assert.equal(
      event.hits.reduce((n, h) => n + h.damage, 0),
      damage,
    );
  });
