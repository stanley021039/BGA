const { HttpError } = require('../http/errors');
const rules = require('../../public/shared/scene-rules.json').energy;
const effects = require('../../public/shared/attack-effects.json');
const multi = new Set(effects.filter((effect) => effect.area).map((effect) => effect.id));
const ordinary = new Set(effects.filter((effect) => !effect.area).map((effect) => effect.id));

function fitsSlot(slot, effect) {
  return slot === 'r' ? multi.has(effect) : ['q', 'e'].includes(slot) && ordinary.has(effect);
}
function gain(actor, amount) {
  actor.energy = Math.min(rules.maximum, (actor.energy || 0) + amount);
}
function walk(actor, durationMs) {
  if (!actor.health || durationMs <= 0) return;
  if ((actor.energy || 0) >= rules.maximum) {
    actor.energyWalkMs = 0;
    return;
  }
  const elapsed = (actor.energyWalkMs || 0) + durationMs;
  const seconds = Math.floor((elapsed + 1e-7) / 1000);
  actor.energyWalkMs = elapsed - seconds * 1000;
  gain(actor, seconds * rules.movementPerSecond);
  if (actor.energy === rules.maximum) actor.energyWalkMs = 0;
}
function check(actor, slot, effect) {
  if (!fitsSlot(slot, effect))
    throw new HttpError(400, 'INVALID_ATTACK_SLOT', 'Q、E 請配裝普通招式，R 請配裝多人招式');
  if (slot === 'r' && (actor.energy || 0) < rules.maximum)
    throw new HttpError(
      409,
      'INSUFFICIENT_SCENE_ENERGY',
      `多人招式能量不足（${actor.energy || 0}／${rules.maximum}）`,
    );
}
function spend(actor, slot) {
  if (slot === 'r') {
    actor.energy = 0;
    actor.energyWalkMs = 0;
  }
}
function hit(from, to, effect, damage) {
  if (damage <= 0 || to.kind === 'fragment') return;
  gain(to, rules.receivedHit);
  const owner = from.energyActor || from;
  if (
    !multi.has(effect) &&
    owner.health > 0 &&
    (!from.energyActor || owner.lifeId === from.energyLifeId)
  )
    gain(owner, rules.ordinaryHit);
}
module.exports = { fitsSlot, gain, walk, check, spend, hit };
