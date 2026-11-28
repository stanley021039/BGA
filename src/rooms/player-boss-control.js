const { HttpError } = require('../http/errors');
const { bosses, bossFor } = require('./scene-bosses');
const { bossPhase, phaseStats } = require('./boss-phases');
const { bossStageSpec } = require('../../frontend/src/engines/boss-geometry.js');
const { strength } = require('../../public/shared/boss-rules.json');

// Uses the scene clock and existing boss combat; no AI, extra timer or avatar is spawned.
function createPlayerBossControl({
  now,
  enabled,
  training,
  settings,
  combat,
  bossCombat,
  actors,
  events,
  receipts,
  canTarget,
  bossCount = () => [...actors.values()].filter((a) => a.bossId).length,
}) {
  function apply(actor, id) {
    const spec = bossFor(id),
      time = now();
    if (spec && !actor.controlledBoss) actor.normalArchetype = actor.archetype;
    actor.controlledBoss = !!spec;
    actor.bossId = spec?.id;
    actor.bossSpeed = spec?.speed;
    actor.bossHealthMultiplier = spec ? strength.healthMultiplier : undefined;
    actor.archetype = spec ? null : actor.normalArchetype;
    actor.authorBonus = false;
    actor.combatEpoch = (actor.combatEpoch || 0) + 1;
    actor.manualBossCast = null;
    actor.bossCastUntil = actor.bossRDelayMs = actor.bossCharge = 0;
    actor.bossReadyAt = time + 700;
    actor.bossArrivalAt = time;
    actor.targetX = actor.x;
    actor.targetY = actor.y;
    actor.moveId++;
    combat.reset(actor, time);
    combat.advance(actor, time);
  }
  function attach(actor) {
    if (!enabled || training || actor.bossControlLoaded) return;
    actor.bossControlLoaded = true;
    const saved = settings?.read(actor.id);
    if (saved?.unlocked && bossFor(saved.selected) && bossCount() < 5) apply(actor, saved.selected);
  }
  function state(user, actor) {
    const unlocked = settings?.read(user.id)?.unlocked === true;
    return {
      available: enabled,
      unlocked,
      selected: actor.controlledBoss ? actor.bossId : null,
      dead: actor.health === 0,
      catalog:
        enabled && unlocked
          ? bosses.map(({ id, name, abilities }) => ({
              id,
              name,
              abilities: abilities.map(({ id, slot, name }) => ({ id, slot, name })),
            }))
          : [],
    };
  }
  function configure(user, actor, input) {
    if (!enabled) throw new HttpError(403, 'BOSS_CONTROL_SCOPE', 'Boss 操控目前開放大廳與訓練場');
    if (!settings?.read(user.id)?.unlocked)
      throw new HttpError(403, 'BOSS_CONTROL_LOCKED', '請先兌換「野獸前輩」開放 Boss 操控');
    if (
      !input ||
      Object.keys(input).some((k) => !['action', 'bossId'].includes(k)) ||
      !['select', 'reset'].includes(input.action) ||
      (input.action === 'select' && input.bossId !== null && !bossFor(input.bossId))
    )
      throw new HttpError(400, 'INVALID_CONTROLLED_BOSS', '請選擇有效 Boss');
    const id = input.action === 'reset' ? actor.bossId : input.bossId;
    if (input.action === 'reset' && (!actor.controlledBoss || actor.health !== 0))
      throw new HttpError(409, 'BOSS_STILL_ALIVE', 'Boss 倒下後才能重新召喚');
    if (id && !actor.controlledBoss && !training && bossCount() >= 5)
      throw new HttpError(409, 'BOSSES_FULL', '大廳最多同時五隻 Boss，請先移除一隻');
    if (input.action === 'select' && !training) settings.write(user.id, id);
    if (id !== (actor.controlledBoss ? actor.bossId : null) || input.action === 'reset')
      apply(actor, id);
    return state(user, actor);
  }
  function advance(actor, time) {
    const cast = actor.manualBossCast;
    if (!actor.controlledBoss || !cast || time < cast.until) return;
    actor.manualBossCast = null;
    actor.bossIntent = null;
    if (!actor.health || cast.event.cancelled || cast.life !== actor.lifeId) return;
    if (cast.slot !== 'r') {
      const suppressed = time < (actor.energyDebuffUntil || 0);
      actor.bossCharge = Math.min(100, (actor.bossCharge || 0) + (suppressed ? 45 : 50));
    }
  }
  function attack(actor, input) {
    const time = now(),
      spec = bossFor(actor.bossId),
      slot = input.slot || 'q';
    const ability = bossStageSpec(
      spec?.abilities.find((a) => a.slot === slot),
      bossPhase(actor),
    );
    if (!ability) throw new HttpError(400, 'INVALID_ATTACK_SLOT', '請使用 Boss 的 Q、E、R 招式');
    const key = 'attack:' + actor.id + ':' + input.requestId;
    const fingerprint = JSON.stringify(['controlled-boss', actor.bossId, slot, input.aspectRatio]);
    const prior = receipts.get(key);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new HttpError(409, 'REQUEST_CONFLICT', '同一操作內容不一致');
      return;
    }
    combat.alive(actor);
    combat.canCast(actor, time);
    const readyAt = (actor.bossReadyAt || 0) + (slot === 'r' ? actor.bossRDelayMs || 0 : 0);
    if (time < readyAt) throw new HttpError(429, 'ATTACK_COOLDOWN', 'Boss 招式冷卻中，請稍候');
    if (slot === 'r' && (actor.bossCharge || 0) < 100)
      throw new HttpError(409, 'INSUFFICIENT_SCENE_ENERGY', '大招蓄力不足（需要 100）');
    if (events.length >= 40)
      throw new HttpError(429, 'ATTACK_SCENE_BUSY', '場景特效較多，請稍候再試');
    const target = [...actors.values()]
      .filter((a) => a.id !== actor.id && a.health > 0 && canTarget(actor, a, time))
      .sort(
        (a, b) =>
          Math.hypot(a.x - actor.x, a.y - actor.y) - Math.hypot(b.x - actor.x, b.y - actor.y),
      )[0];
    if (!target) throw new HttpError(409, 'NO_ATTACK_TARGET', '目前沒有其他玩家可以互動');
    const event = bossCombat.prepare({ bossId: actor.bossId }, actor, ability.id, target, time);
    if (!event) throw new HttpError(400, 'INVALID_ATTACK_SLOT', 'Boss 招式不正確');
    const rate = phaseStats(actor).attackRate;
    const until = time + (ability.windup + ability.duration) / rate;
    actor.bossCastUntil = until;
    actor.bossReadyAt =
      until +
      ((slot === 'r' ? 4200 : 2600) *
        (bossPhase(actor) === 3 ? strength.finalCooldownMultiplier : strength.cooldownMultiplier)) /
        rate;
    actor.manualBossCast = { event, slot, until, life: actor.lifeId };
    actor.bossIntent = {
      effect: ability.id,
      name: ability.name,
      ultimate: slot === 'r',
      until: time + ability.windup / rate,
      attackRate: rate,
    };
    actor.facing = target.x < actor.x ? 'left' : 'right';
    actor.targetX = actor.x;
    actor.targetY = actor.y;
    actor.lastAttacks ||= {};
    actor.lastAttacks[slot] = time;
    if (slot === 'r') {
      actor.bossCharge = 0;
      actor.bossRDelayMs = 0;
    }
    events.push(event);
    receipts.set(key, { at: time, fingerprint });
  }
  return {
    attach,
    state,
    configure,
    advance,
    attack,
    reset: (actor) => apply(actor, actor.bossId),
  };
}
module.exports = { createPlayerBossControl };
