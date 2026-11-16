const { phases, phaseLockMs } = require('../../public/shared/boss-rules.json');
const { beginPhaseImmunity } = require('./boss-interactions');
// Cast sources carry an inert shared token; mutable budgets stay out of actor state.
const castTargets = new WeakMap();
function bossPhase(actor) {
  if (!actor.bossId || !(actor.maxHealth > 0)) return 1;
  const current =
    actor.health <= Math.ceil(actor.maxHealth / 3)
      ? 3
      : actor.health <= Math.ceil((actor.maxHealth * 2) / 3)
        ? 2
        : 1;
  return Math.max(1, Math.min(3, actor.bossPhase || 1), current);
}
const phaseStats = (actor) => phases[bossPhase(actor) - 1];
function capBossDamage(actor, damage, time = actor.combatAt || 0, budget) {
  if (!actor.bossId || !(actor.maxHealth > 0)) return damage;
  if (time < (actor.bossPhaseLockUntil || 0)) return 0;
  let floor = Math.ceil((actor.maxHealth * (3 - bossPhase(actor))) / 3);
  if (budget && damage > 0) {
    let targets = castTargets.get(budget);
    if (!targets) castTargets.set(budget, (targets = new WeakMap()));
    let entry = targets.get(actor);
    // A cast cannot hit a newly respawned life of the same boss either.
    if (entry && entry.lifeId !== actor.lifeId) return 0;
    if (!entry) targets.set(actor, (entry = { lifeId: actor.lifeId, floor }));
    floor = Math.max(floor, entry.floor);
  }
  return Math.min(damage, Math.max(0, actor.health - floor));
}
function advanceBossPhase(actor, time = actor.combatAt || 0, random = Math.random) {
  if (!actor.bossId) return;
  const previous = actor.bossPhase || 1;
  actor.bossPhase = bossPhase(actor);
  if (actor.health > 0 && actor.bossPhase > previous) {
    actor.bossPhaseLockUntil = time + phaseLockMs;
    beginPhaseImmunity(actor, time, actor.bossPhase, random);
  }
}
function bossHealingCeiling(actor) {
  return actor.bossId ? Math.ceil((actor.maxHealth * (4 - bossPhase(actor))) / 3) : actor.maxHealth;
}
module.exports = { bossPhase, phaseStats, capBossDamage, advanceBossPhase, bossHealingCeiling };
