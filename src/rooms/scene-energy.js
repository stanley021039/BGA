const { HttpError } = require('../http/errors');
const { attackKind } = require('./attack-kind');
const { profile } = require('./archetypes');
const { energy: rules, authorBonus } = require('../../public/shared/scene-rules.json');
const effects = require('../../public/shared/attack-effects.json');
const multi = new Set(
  effects.filter((effect) => effect.area || effect.ultimate).map((effect) => effect.id),
);
const ordinary = new Set(
  effects.filter((effect) => !effect.area && !effect.ultimate).map((effect) => effect.id),
);

function fitsSlot(slot, effect) {
  return slot === 'r' ? multi.has(effect) : ['q', 'e'].includes(slot) && ordinary.has(effect);
}
function maximum(actor) {
  return actor.energyMaximum ?? rules.maximum;
}
function gain(actor, amount, multiplier = profile(actor).energyGain ?? 1, combatGain = true) {
  const author = actor.authorBonus ? authorBonus.energyMultiplier : 1;
  const time = actor.combatAt || 0;
  const bonus = time < (actor.guanyinUntil || 0) ? 1.1 : 1;
  const debuff = combatGain && time < (actor.energyDebuffUntil || 0) ? 0.9 : 1;
  const next = (actor.energy || 0) + amount * multiplier * author * bonus * debuff;
  actor.energy = Math.min(maximum(actor), Math.round(next * 10) / 10);
}
function walk(actor, durationMs) {
  if (!actor.health || durationMs <= 0) return;
  if ((actor.energy || 0) >= maximum(actor)) {
    actor.energyWalkMs = 0;
    return;
  }
  const elapsed = (actor.energyWalkMs || 0) + durationMs;
  const seconds = Math.floor((elapsed + 1e-7) / 1000);
  actor.energyWalkMs = elapsed - seconds * 1000;
  gain(actor, seconds * rules.movementPerSecond);
  if (actor.energy === maximum(actor)) actor.energyWalkMs = 0;
}
function check(actor, slot, effect) {
  if (!fitsSlot(slot, effect))
    throw new HttpError(400, 'INVALID_ATTACK_SLOT', 'Q、E 請配裝普通招式，R 請配裝大招');
  if (slot === 'r' && (actor.energy || 0) < maximum(actor))
    throw new HttpError(
      409,
      'INSUFFICIENT_SCENE_ENERGY',
      `大招能量不足（${actor.energy || 0}／${maximum(actor)}）`,
    );
}
function spend(actor, slot) {
  if (slot === 'r') {
    actor.energy = 0;
    actor.energyWalkMs = 0;
  }
}
function hit(from, to, effect, damage, phase = '') {
  if (damage <= 0 || to.kind === 'fragment') return;
  gain(to, rules.receivedHit);
  const owner = from.energyActor || from;
  if (
    !multi.has(effect) &&
    owner.health > 0 &&
    (!from.energyActor || owner.lifeId === from.energyLifeId)
  ) {
    if (attackKind(effect) === 'returning_moon' && phase === 'return') return;
    const index = from.energyActor ? from.ordinaryHitIndex || 0 : 0;
    if (from.energyActor) from.ordinaryHitIndex = index + 1;
    const budget = from.reflectionBudget || from;
    const remaining = budget.ordinaryEnergyRemaining;
    const perHit = owner.ordinaryHitEnergy ?? rules.ordinaryHit;
    const base = index === 0 ? perHit : index < 3 ? perHit / 2 : 0;
    const desired = base * (attackKind(effect) === 'beam' ? 1.1 : 1);
    const amount = Math.min(remaining ?? desired, desired);
    if (remaining !== undefined) budget.ordinaryEnergyRemaining -= amount;
    const multiplier = owner.archetype === 'energy' ? rules.energyArchetypeHit / perHit : 1;
    gain(owner, amount, multiplier);
  }
}
module.exports = { fitsSlot, maximum, gain, walk, check, spend, hit };
