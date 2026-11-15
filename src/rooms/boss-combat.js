const { randomBytes } = require('node:crypto');
const abilities = require('../../public/shared/boss-abilities.json');
const { bossZones, inBossZones } = require('../../frontend/src/engines/boss-geometry.js');
const abilityFor = (id) => abilities.find((s) => s.id === id);
const { phaseStats } = require('./boss-phases');
function createBossCombat(combat, intercept = () => false) {
  const runtime = new WeakMap();
  function prepare(bot, actor, abilityId, aim, time) {
    const spec = abilityFor(abilityId);
    if (!spec || spec.boss !== bot.bossId) return null;
    const rate = actor.bossId ? phaseStats(actor).attackRate : 1;
    const event = {
      id: randomBytes(12).toString('hex'),
      effect: spec.id,
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
      zones: bossZones(spec, actor, aim),
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
      while (state.next < spec.pulses) {
        const at =
          event.at +
          (spec.windup + state.next * (spec.duration / Math.max(1, spec.pulses - 1))) / state.rate;
        if (at > time) break;
        state.next++;
        for (const victim of [...positions.values()]
          .filter((v) => v.id !== caster.id && v.health > 0)
          .slice(0, 80)) {
          moveActor(victim, at);
          if (!inBossZones(state.zones, victim) || !combat.canHit(caster, victim, at, spec.id))
            continue;
          if (!state.victims.has(victim.id) && state.victims.size >= 32) continue;
          const source = {
            ...caster,
            energyActor: caster,
            energyLifeId: caster.lifeId,
            originX: event.fromX,
            originY: event.fromY,
            slot: spec.slot,
            ordinaryEnergyRemaining: 0,
            bossBarBudget: state.bossBarBudget,
            bossAbilityId: spec.id,
          };
          if (spec.slot !== 'r' && intercept(source, victim, at, spec.damage, positions)) continue;
          const hit = combat.hit(source, victim, at, spec.id, spec.damage);
          if (hit.damage > 0 && victim.health > 0) {
            if (spec.slow && combat.canControl(victim, at))
              victim.slowUntil = Math.max(victim.slowUntil || 0, at + spec.slow);
            if (spec.root && state.next === spec.pulses) combat.freeze(victim, at, spec.root);
            if (spec.drain) victim.energy = Math.max(0, (victim.energy || 0) - spec.drain);
            if (spec.pull && combat.canControl(victim, at)) {
              const dx = event.toX - victim.x,
                dy = event.toY - victim.y,
                L = Math.hypot(dx, dy) || 1;
              victim.x = Math.max(0, Math.min(100, victim.x + (dx / L) * Math.min(L, spec.pull)));
              victim.y = Math.max(12, Math.min(97, victim.y + (dy / L) * Math.min(L, spec.pull)));
              victim.targetX = victim.x;
              victim.targetY = victim.y;
              victim.moveId++;
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
