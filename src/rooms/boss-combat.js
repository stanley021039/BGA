const { randomBytes } = require('node:crypto');
const abilities = require('../../public/shared/boss-abilities.json');
const {
  bossStageSpec,
  bossAttackPlan,
  inBossZones,
} = require('../../frontend/src/engines/boss-geometry.js');
const abilityFor = (id) => abilities.find((s) => s.id === id);
const { phaseStats, bossPhase } = require('./boss-phases');
const ailments = require('./boss-ailments');
const { drainBossCharge } = require('./boss-interactions');
function createBossCombat(combat, intercept = () => false) {
  const runtime = new WeakMap();
  function prepare(bot, actor, abilityId, aim, time) {
    const phase = actor.bossId ? bossPhase(actor) : 1;
    const spec = bossStageSpec(abilityFor(abilityId), phase);
    if (!spec || spec.boss !== bot.bossId) return null;
    const rate = actor.bossId ? phaseStats(actor).attackRate : 1;
    const event = {
      id: randomBytes(12).toString('hex'),
      effect: spec.id,
      ...(phase > 1 ? { bossPhase: phase } : {}),
      slot: spec.slot,
      fromId: actor.id,
      toId: aim.id,
      fromName: actor.name,
      toName: aim.name,
      fromX: actor.x,
      fromY: actor.y,
      toX: aim.x,
      toY: aim.y,
      at: time,
      until: time + Math.ceil(4400 / rate),
      ...(rate !== 1 ? { bossAttackRate: rate } : {}),
      aspectRatio: 1.6,
      hits: [],
      damage: 0,
      critical: false,
    };
    runtime.set(event, {
      actor,
      lifeId: actor.lifeId,
      epoch: actor.combatEpoch || 0,
      next: 0,
      rate,
      plan: bossAttackPlan(spec, actor, aim),
      phase,
      drained: new Set(),
      victims: new Map(),
      bossBarBudget: {},
    });
    return event;
  }
  function advance(events, positions, time, moveActor) {
    for (const event of events) {
      const state = runtime.get(event),
        spec = abilityFor(event.effect);
      if (!state || !spec || event.cancelled) continue;
      const caster = state.actor;
      if (
        positions.get(caster.id) !== caster ||
        !caster.health ||
        caster.lifeId !== state.lifeId ||
        (caster.combatEpoch || 0) !== state.epoch ||
        caster.immobileUntil > event.at ||
        (caster.bossInterruptedAt || 0) > event.at
      ) {
        event.cancelled = true;
        continue;
      }
      while (state.next < state.plan.length) {
        const strike = state.plan[state.next];
        const at = event.at + strike.at / state.rate;
        if (at > time) break;
        state.next++;
        for (const victim of [...positions.values()]
          .filter((v) => v.id !== caster.id && v.health > 0)
          .slice(0, 80)) {
          moveActor(victim, at);
          if (!inBossZones(strike.zones, victim) || !combat.canHit(caster, victim, at, spec.id))
            continue;
          if (!state.victims.has(victim.id) && state.victims.size >= 32) continue;
          const source = {
            ...caster,
            bossPhase: state.phase,
            energyActor: caster,
            energyLifeId: caster.lifeId,
            originX: event.fromX,
            originY: event.fromY,
            slot: spec.slot,
            ordinaryEnergyRemaining: 0,
            bossBarBudget: state.bossBarBudget,
            bossAbilityId: spec.id,
            bossStrikeIndex: strike.index,
          };
          if (spec.slot !== 'r' && intercept(source, victim, at, strike.damage, positions))
            continue;
          const hit = combat.hit(source, victim, at, spec.id, strike.damage);
          if (hit.damage > 0 && victim.health > 0) {
            const fx = strike.effects;
            if (fx.slow && combat.canControl(victim, at)) {
              if (fx.slow === 20) victim.slowUntil = Math.max(victim.slowUntil || 0, at + fx.ms);
              else {
                victim.bossSlowPercent = fx.slow;
                victim.bossSlowUntil = Math.max(victim.bossSlowUntil || 0, at + fx.ms);
              }
            }
            for (const type of ['armor', 'healing', 'recovery', 'dimension', 'stone'])
              if (fx[type])
                ailments.mark(victim, type, fx[type] === true ? 1 : fx[type], at, fx.ms || 2000);
            if (fx.root && at >= (victim.bossControlProtectUntil || 0)) {
              const duration = combat.freeze(victim, at, fx.root);
              if (duration) victim.bossControlProtectUntil = at + duration + 1000;
            }
            if (fx.drain && !state.drained.has(victim.id)) {
              const extra =
                fx.markedDrain && ailments.percent(victim, 'dimension', at) ? fx.markedDrain : 0;
              if (extra) delete victim.bossAilments.dimension;
              if (victim.bossId) drainBossCharge(victim, fx.drain + extra);
              else victim.energy = Math.max(0, (victim.energy || 0) - fx.drain - extra);
              state.drained.add(victim.id);
            }
            if (fx.pull && combat.canControl(victim, at)) {
              const zone = strike.zones[0],
                d = 1.6;
              const point =
                zone.shape === 'line'
                  ? { x: event.toX, y: event.toY }
                  : { x: zone.x, y: zone.y * d };
              const dx = point.x - victim.x,
                dy = point.y - victim.y,
                length = Math.hypot(dx, dy) || 1;
              victim.x = Math.max(
                0,
                Math.min(100, victim.x + (dx / length) * Math.min(length, fx.pull)),
              );
              victim.y = Math.max(
                12,
                Math.min(97, victim.y + (dy / length) * Math.min(length, fx.pull)),
              );
              victim.targetX = victim.x;
              victim.targetY = victim.y;
              victim.moveId = (victim.moveId || 0) + 1;
            }
          }
          let record = state.victims.get(victim.id);
          if (!record) {
            record = { toId: victim.id, toX: victim.x, toY: victim.y, damage: 0, critical: false };
            state.victims.set(victim.id, record);
            event.hits.push(record);
          }
          record.damage += hit.damage;
          record.critical ||= hit.critical;
        }
      }
    }
  }
  return { prepare, advance };
}
module.exports = { abilities, abilityFor, createBossCombat };
