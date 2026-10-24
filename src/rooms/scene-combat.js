const { HttpError } = require('../http/errors');
const rules = require('../../public/shared/scene-rules.json');

// Radius as a percentage of the scene's longer edge, independent of aspect ratio.
function sceneDistance(from, to, aspectRatio) {
  return Math.hypot((to.x - from.x) * aspectRatio, to.y - from.y) / Math.max(1, aspectRatio);
}

// Decorative scene combat has no connection to board-game scores or player lives.
function createSceneCombat(random = Math.random, authorBonus = () => false) {
  const healthFactor = (actor) => (actor.authorBonus ? rules.authorBonus.healthMultiplier : 1);
  function reset(actor, time) {
    actor.baseMaxHealth =
      (rules.health.min + Math.floor(random() * (rules.health.max - rules.health.min + 1))) *
      rules.unitScale;
    actor.maxHealth = actor.health = Math.round(actor.baseMaxHealth * healthFactor(actor));
    actor.respawnAt = 0;
    actor.shieldUntil = 0;
    actor.regenAt = time;
    actor.lastHitAt = time;
  }
  function advance(actor, time) {
    const entitled = !!authorBonus(actor.id, actor);
    if (actor.health === undefined) {
      actor.authorBonus = entitled;
      reset(actor, time);
    }
    if (actor.respawnAt && time >= actor.respawnAt) {
      const oldX = actor.x;
      actor.authorBonus = entitled;
      reset(actor, time);
      actor.x = actor.targetX = (oldX + 20 + random() * 60) % 100;
      actor.y = actor.targetY = 15 + random() * 75;
      actor.teleportId = (actor.teleportId || 0) + 1;
    }
    if (actor.health > 0) {
      const start = Math.max(actor.regenAt, actor.lastHitAt + rules.regeneration.delayMs);
      const ticks = Math.max(0, Math.floor((time - start) / 1000));
      if (ticks) {
        actor.health = Math.min(
          actor.maxHealth,
          actor.health +
            ticks *
              rules.regeneration.perSecond *
              rules.unitScale *
              (actor.authorBonus ? rules.authorBonus.regenerationMultiplier : 1),
        );
        actor.regenAt = start + ticks * 1000;
      }
    }
    // Live redemption changes scale the current health ratio, never refill a
    // wounded player or stack another multiplier on repeated polls/redemptions.
    if (actor.authorBonus !== entitled) {
      const fraction = actor.health / actor.maxHealth;
      actor.authorBonus = entitled;
      actor.maxHealth = Math.round(actor.baseMaxHealth * healthFactor(actor));
      actor.health = Math.round(actor.maxHealth * fraction);
    }
  }
  function alive(actor) {
    if (actor.health === 0) throw new HttpError(409, 'SCENE_RESPAWNING', '正在重生，請稍候');
  }
  function protect(actor, time) {
    alive(actor);
    actor.shieldUntil = time + rules.shield.durationMs;
    return { damage: 0, critical: false };
  }
  function hit(from, to, time) {
    alive(from);
    const minimum = rules.damage.min * rules.unitScale;
    const base =
      minimum +
      Math.floor(random() * ((rules.damage.max - rules.damage.min) * rules.unitScale + 1));
    const critical = random() < rules.damage.criticalChance;
    const incoming = Math.round(
      base *
        (critical ? rules.damage.criticalMultiplier : 1) *
        (from.authorBonus ? rules.authorBonus.damageMultiplier : 1),
    );
    let blockedPercent = 0;
    if (time < (to.shieldUntil || 0)) {
      const min = to.authorBonus ? rules.shield.authorMinimumPercent : rules.shield.minimumPercent;
      const max = to.authorBonus ? rules.shield.authorMaximumPercent : rules.shield.maximumPercent;
      blockedPercent = min + Math.floor(random() * (max - min + 1));
    }
    const damage = Math.round(incoming * (1 - blockedPercent / 100));
    to.health = Math.max(0, to.health - damage);
    to.lastHitAt = to.regenAt = time;
    if (!to.health) {
      to.shieldUntil = 0;
      to.respawnAt = time + rules.respawnMs;
      to.targetX = to.x;
      to.targetY = to.y;
    }
    return { damage, critical };
  }
  function view(actor) {
    return { health: actor.health, maxHealth: actor.maxHealth, respawnAt: actor.respawnAt };
  }
  return { advance, alive, protect, hit, view };
}
module.exports = { createSceneCombat, sceneDistance };
