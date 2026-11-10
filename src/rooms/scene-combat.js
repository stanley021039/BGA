const { rules: pickupRules } = require('./lobby-pickups');
const { profile } = require('./archetypes');
const { HttpError } = require('../http/errors');
const { attackKind } = require('./attack-kind');
const rules = require('../../public/shared/scene-rules.json');
const energy = require('./scene-energy');
const { passageTarget } = require('../../frontend/src/engines/scene-path.js');
const attackEffects = require('../../public/shared/attack-effects.json');
const areaEffects = new Set(
  attackEffects.filter((effect) => effect.area).map((effect) => effect.id),
);
const damageMultipliers = new Map(
  attackEffects.map((effect) => [effect.id, effect.damageMultiplier ?? 1]),
);

function authorSpeed(actor) {
  return actor.authorBonus ? rules.authorBonus.speedMultiplier : 1;
}
// Radius as a percentage of the scene's longer edge, independent of aspect ratio.
function sceneDistance(from, to, aspectRatio) {
  return Math.hypot((to.x - from.x) * aspectRatio, to.y - from.y) / Math.max(1, aspectRatio);
}

// Decorative scene combat has no connection to board-game scores or player lives.
function createSceneCombat(random = Math.random, authorBonus = () => false, policy = {}) {
  const contributions = new WeakMap();
  const stats = (actor) => (actor.kda ||= { kills: 0, deaths: 0, assists: 0 });
  const healthFactor = (actor) =>
    (actor.authorBonus ? rules.authorBonus.healthMultiplier : 1) *
    (actor.guanyinActive ? rules.guanyinBonus.multiplier : 1) *
    profile(actor).health;
  function reset(actor, time) {
    actor.energy ||= 0;
    actor.energyWalkMs = 0;
    actor.lifeId = (actor.lifeId || 0) + 1;
    stats(actor);
    contributions.delete(actor);
    actor.guanyinUntil = 0;
    actor.guanyinActive = false;
    actor.excaliburUntil = 0;
    actor.baseMaxHealth =
      (rules.health.min + Math.floor(random() * (rules.health.max - rules.health.min + 1))) *
      rules.unitScale;
    actor.maxHealth = actor.health = Math.round(actor.baseMaxHealth * healthFactor(actor));
    actor.respawnAt = 0;
    actor.shieldUntil = 0;
    actor.shieldResidualUntil = 0;
    actor.guardEnergyReady = false;
    actor.guardEnergy = null;
    actor.slowUntil = 0;
    actor.teleportBlockedUntil = 0;
    actor.hasteUntil = 0;
    actor.immobileUntil = 0;
    actor.heroFlightUntil = 0;
    actor.sealedUntil = 0;
    actor.summon = null;
    actor.blackoutUntil = 0;
    actor.kissedUntil = 0;
    actor.equation = null;
    actor.regenBlockedUntil = 0;
    actor.fragment = null;
    actor.hazardId = actor.hazardKind = null;
    actor.hazardTickAt = actor.emberTrailUntil = 0;
    actor.severed = false;
    actor.drillDot = null;
    actor.ordinaryDot = null;
    actor.dotPulse = null;
    actor.knockback = null;
    actor.pickupSpeedAt =
      actor.pickupSpeedUntil =
      actor.pickupShieldUntil =
      actor.pickupAttackUntil =
        0;
    actor.lastPickup = null;
    actor.regenAt = time;
    actor.lastHitAt = time;
  }
  function advance(actor, time) {
    if (actor.kind === 'fragment') return;
    // Settle an expiring health modifier at its real boundary, even after a late poll.
    if (actor.guanyinActive && time > actor.guanyinUntil) advance(actor, actor.guanyinUntil);
    actor.combatAt = time;
    const entitled = !!authorBonus(actor.id, actor);
    if (actor.health === undefined) {
      actor.authorBonus = entitled;
      reset(actor, time);
    }
    while (actor.health > 0) {
      const { drillDot, ordinaryDot } = actor;
      const ordinary = (ordinaryDot?.nextAt ?? Infinity) < (drillDot?.nextAt ?? Infinity);
      const dot = ordinary ? ordinaryDot : drillDot;
      if (!dot || dot.nextAt > time) break;
      const at = dot.nextAt;
      dot.nextAt += ordinary ? rules.ordinaryDot.intervalMs : 1000;
      if (--dot.remaining === 0) actor[ordinary ? 'ordinaryDot' : 'drillDot'] = null;
      const result = ordinary
        ? hit(dot.from, actor, at, dot.effect, rules.ordinaryDot.damageWeight, 'ordinary-dot')
        : hit(dot.from, actor, at, 'giga_drill', 0.1);
      actor.dotPulse = { id: `${actor.lifeId}:${at}`, at, ...result };
    }
    collect(actor);
    if (actor.respawnAt && time >= actor.respawnAt) {
      const oldX = actor.x;
      actor.authorBonus = entitled;
      reset(actor, time);
      actor.x = actor.targetX = (oldX + 20 + random() * 60) % 100;
      actor.y = actor.targetY = 15 + random() * 75;
      actor.teleportId = (actor.teleportId || 0) + 1;
    }
    if (actor.health > 0) {
      // The first tick may occur exactly when the burn lock expires. Do not
      // bank healing ticks from the five seconds in which healing was blocked.
      const blockedUntil = actor.regenBlockedUntil || 0;
      const start = Math.max(
        actor.regenAt,
        actor.lastHitAt + rules.regeneration.delayMs,
        blockedUntil - 1000,
      );
      const ticks = time < blockedUntil ? 0 : Math.max(0, Math.floor((time - start) / 1000));
      if (ticks) {
        const boostedTicks = Math.max(
          0,
          Math.min(ticks, Math.ceil(((actor.guanyinUntil || 0) - start) / 1000) - 1),
        );
        actor.health = Math.min(
          actor.maxHealth,
          actor.health +
            Math.round(
              (ticks + boostedTicks * (rules.guanyinBonus.multiplier - 1)) *
                rules.regeneration.perSecond *
                rules.unitScale *
                (actor.authorBonus ? rules.authorBonus.regenerationMultiplier : 1),
            ),
        );
        actor.regenAt = start + ticks * 1000;
      }
    }
    // Live redemption changes scale the current health ratio, never refill a
    // wounded player or stack another multiplier on repeated polls/redemptions.
    syncScale(actor, time, entitled);
  }
  function syncScale(actor, time, entitled = actor.authorBonus) {
    const active = actor.health > 0 && time < (actor.guanyinUntil || 0);
    if (actor.authorBonus !== entitled || actor.guanyinActive !== active) {
      const fraction = actor.health / actor.maxHealth;
      actor.authorBonus = entitled;
      actor.guanyinActive = active;
      actor.maxHealth = Math.round(actor.baseMaxHealth * healthFactor(actor));
      actor.health = Math.round(actor.maxHealth * fraction);
    }
  }
  function alive(actor) {
    if (actor.health === 0) throw new HttpError(409, 'SCENE_RESPAWNING', '正在重生，請稍候');
  }
  function protect(actor, time, effect) {
    alive(actor);
    const kind = attackKind(effect);
    actor.shieldUntil = time + rules.shield.durationMs;
    actor.guardEnergyReady = kind === 'shield' || kind === 'sphere';
    actor.shieldResidualUntil =
      actor.shieldUntil +
      (kind === 'shield' ? rules.shield.guardResidualDurationMs : rules.shield.residualDurationMs);
    return { damage: 0, critical: false };
  }
  function cast(actor, effect, time) {
    effect = attackKind(effect);
    if (effect === 'gate_of_heroes') {
      actor.heroFlightUntil = time + rules.heroLanding.delayMs;
      freeze(actor, time, rules.heroLanding.delayMs);
      protect(actor, time);
    }
    if (effect === 'reaper_seal') {
      actor.health = Math.max(
        1,
        actor.health - Math.ceil(actor.health * rules.reaperSeal.currentHealthCost),
      );
      actor.lastHitAt = actor.regenAt = time;
    }
    if (effect === 'gate_of_babylon') {
      actor.health = Math.max(
        1,
        actor.health - Math.ceil(actor.health * rules.babylon.currentHealthCost),
      );
      actor.lastHitAt = actor.regenAt = time;
    }
    if (effect === 'guanyin_barrage') {
      actor.guanyinUntil = time + rules.guanyinBonus.durationMs;
      syncScale(actor, time);
    }
    if (effect === 'excalibur') actor.excaliburUntil = time + rules.excaliburGuard.durationMs;
  }
  function freeze(actor, time, duration = 1000) {
    actor.immobileUntil = Math.max(actor.immobileUntil || 0, time + duration);
    actor.targetX = actor.x;
    actor.targetY = actor.y;
  }
  function trapEquation(actor, id) {
    const digit = () => 2 + Math.floor(random() * 7);
    const a = digit(),
      b = digit(),
      c = digit(),
      d = digit(),
      e = digit();
    const flat = random() < 0.5;
    const prompt = flat
      ? `${a} + ${b} × ${c} − ${d * e} ÷ ${e}`
      : `${a} × (${b + c} − ${c}) + ${d * e} ÷ ${e}`;
    const answer = flat ? a + b * c - d : a * b + d;
    const offsets = [-9, -6, -3, -1, 1, 4, 7, 10];
    const options = [answer];
    while (options.length < 5) {
      const [offset] = offsets.splice(Math.floor(random() * offsets.length), 1);
      options.push(answer + offset);
    }
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    actor.equation = { id, prompt, answer, options, rejectedOptions: [] };
    actor.targetX = actor.x;
    actor.targetY = actor.y;
    actor.knockback = null;
  }
  function solveEquation(actor, id, answer, time) {
    alive(actor);
    if (typeof id !== 'string' || !id || id.length > 80 || !Number.isSafeInteger(answer))
      throw new HttpError(400, 'INVALID_EQUATION_ANSWER', '請輸入整數答案');
    if (!actor.equation || actor.equation.id !== id)
      throw new HttpError(409, 'SCENE_EQUATION_EXPIRED', '這道題已經解除');
    if (!actor.equation.options.includes(answer))
      throw new HttpError(400, 'INVALID_EQUATION_ANSWER', '請選擇題目提供的答案');
    if (actor.equation.answer !== answer) {
      if (!actor.equation.rejectedOptions.includes(answer)) {
        actor.equation.rejectedOptions.push(answer);
        const damage = Math.min(
          actor.health - 1,
          Math.ceil(actor.maxHealth * rules.zeroEquation.wrongAnswerHpFraction),
        );
        if (damage > 0) {
          actor.health -= damage;
          actor.lastHitAt = actor.regenAt = time;
          actor.dotPulse = {
            id: 'equation:' + id + ':' + answer,
            at: time,
            damage,
            critical: false,
          };
        }
      }
      throw new HttpError(409, 'SCENE_EQUATION_WRONG', '答錯會扣 5% 最大 HP，請再試一次');
    }
    actor.equation = null;
  }
  function canMove(actor, time) {
    alive(actor);
    if (actor.equation) throw new HttpError(409, 'SCENE_EQUATION_LOCKED', '答對方程式後才能移動');
    if (time < (actor.immobileUntil || 0))
      throw new HttpError(409, 'SCENE_IMMOBILIZED', '暫時無法移動');
  }
  function canCast(actor, time) {
    alive(actor);
    if (time < (actor.heroFlightUntil || 0))
      throw new HttpError(409, 'SCENE_FLYING', '降臨途中暫時無法施法');
    if (time < (actor.sealedUntil || 0))
      throw new HttpError(409, 'SCENE_SEALED', '封印中暫時無法攻擊或瞬移');
  }
  function canTeleport(actor, time) {
    canMove(actor, time);
    canCast(actor, time);
    if (time < (actor.teleportBlockedUntil || 0))
      throw new HttpError(409, 'SCENE_TELEPORT_BLOCKED', '光柱封鎖中，暫時無法瞬移');
  }
  function touchesFragment(actor, from, part) {
    let closest = actor;
    if (from) {
      const dx = (actor.x - from.x) * part.aspect,
        dy = actor.y - from.y;
      const length = dx * dx + dy * dy;
      const t = length
        ? Math.max(
            0,
            Math.min(1, ((part.x - from.x) * part.aspect * dx + (part.y - from.y) * dy) / length),
          )
        : 1;
      closest = { x: from.x + (actor.x - from.x) * t, y: from.y + (actor.y - from.y) * t };
    }
    return sceneDistance(closest, part, part.aspect) <= 3;
  }
  function collect(actor, from, actors = [], time = actor.combatAt, fromAt = time) {
    if (!actor.health) return;
    if (actor.fragment && touchesFragment(actor, from, actor.fragment)) {
      actor.fragment = null;
      actor.severed = false;
    }
    for (const owner of actors) {
      const part = owner.fragment;
      if (
        owner === actor ||
        !owner.health ||
        !part?.health ||
        time < part.stealableAt ||
        (actor.combatEpoch || 0) !== (owner.combatEpoch || 0)
      )
        continue;
      let eligibleFrom = from;
      if (from && fromAt < part.stealableAt && time > fromAt) {
        const progress = (part.stealableAt - fromAt) / (time - fromAt);
        eligibleFrom = {
          x: from.x + (actor.x - from.x) * progress,
          y: from.y + (actor.y - from.y) * progress,
        };
      }
      if (!touchesFragment(actor, eligibleFrom, part)) continue;
      owner.fragment = null;
      energy.gain(actor, rules.fragment.stealEnergy);
    }
  }
  function applyEffect(
    from,
    actor,
    time,
    effect,
    origin,
    aspect = 1,
    phase = '',
    firstContact = false,
  ) {
    effect = attackKind(effect);
    if (!actor.health || actor.kind === 'fragment') return;
    if (effect === 'reaper_seal')
      actor.sealedUntil = Math.max(actor.sealedUntil || 0, time + rules.reaperSeal.durationMs);
    if (effect === 'gate_of_heroes') {
      freeze(actor, time, rules.heroLanding.knockupMs);
      actor.knockback = {
        id: `${actor.lifeId}:${time}`,
        fromX: actor.x,
        fromY: actor.y,
        at: time,
        durationMs: rules.heroLanding.knockupMs,
        vertical: true,
      };
    }
    if (effect === 'bijuu_beam' || (firstContact && effect === 'chains')) {
      const config = effect === 'chains' ? rules.chains : rules.bijuuImmobilize;
      if (random() < (config.immobilizeChance ?? config.chance))
        freeze(actor, time, config.immobilizeMs ?? config.durationMs);
      if (random() < config.slowChance)
        actor.slowUntil = Math.max(
          actor.slowUntil || 0,
          Math.max(time, actor.immobileUntil || 0) + rules.frost.durationMs,
        );
    }
    if (firstContact && effect === 'orbital' && random() < rules.orbitalTeleportBlock.chance)
      actor.teleportBlockedUntil = Math.max(
        actor.teleportBlockedUntil || 0,
        time + rules.orbitalTeleportBlock.durationMs,
      );
    if (
      firstContact &&
      (effect === 'arrow_volley' || effect === 'flame_vortex') &&
      random() < rules.ordinaryDot.chance
    )
      actor.ordinaryDot = {
        from,
        effect,
        nextAt: time + rules.ordinaryDot.intervalMs,
        remaining: rules.ordinaryDot.ticks,
      };
    if (effect === 'solar_phoenix' && phase.startsWith('burn'))
      actor.regenBlockedUntil = Math.max(
        actor.regenBlockedUntil || 0,
        time + rules.phoenixHealingBlockMs,
      );
    if (effect === 'giant_orange_cat') {
      freeze(actor, time, rules.orangeCat.immobilizeMs);
      actor.slowUntil = Math.max(
        actor.slowUntil || 0,
        actor.immobileUntil + rules.orangeCat.slowMs,
      );
    }
    if (effect === 'dimension_cleave' && !actor.severed) {
      const angle = random() * Math.PI * 2;
      let point = {
        x: Math.max(
          8,
          Math.min(92, actor.x + ((Math.cos(angle) * 9) / aspect) * Math.max(1, aspect)),
        ),
        y: Math.max(16, Math.min(94, actor.y + Math.sin(angle) * 9 * Math.max(1, aspect))),
      };
      if (sceneDistance(actor, point, aspect) < 4)
        point = {
          x: actor.x < 50 ? Math.min(92, actor.x + 10) : Math.max(8, actor.x - 10),
          y: Math.max(16, Math.min(94, actor.y)),
        };
      point = passageTarget(actor, point, actor.passage);
      actor.severed = true;
      actor.fragment = {
        id: `${actor.id}:lower:${actor.lifeId}:${time}`,
        kind: 'fragment',
        owner: actor,
        ownerId: actor.id,
        lifeId: actor.lifeId,
        name: (actor.name || actor.id) + '的下半身',
        ...point,
        maxHealth: Math.round(actor.maxHealth / 2),
        health: Math.round(actor.maxHealth / 2),
        aspect,
        stealableAt: time + rules.fragment.ownerOnlyMs,
      };
    }
    if (effect === 'singularity' && phase === 'finish') {
      const distance = sceneDistance(actor, origin, aspect);
      if (distance > 0) {
        const fraction = Math.min(1, rules.singularityPull / distance);
        const point = passageTarget(
          actor,
          {
            x: actor.x + (origin.x - actor.x) * fraction,
            y: actor.y + (origin.y - actor.y) * fraction,
          },
          actor.passage,
        );
        // A short pull should never send the target through the central panel.
        if (sceneDistance(actor, point, aspect) <= rules.singularityPull + 1e-8) {
          const stationary = actor.x === actor.targetX && actor.y === actor.targetY;
          actor.x = point.x;
          actor.y = point.y;
          if (stationary) {
            actor.targetX = actor.x;
            actor.targetY = actor.y;
          }
          actor.moveId = (actor.moveId || 0) + 1;
        }
      }
    }
    if (effect === 'giga_drill') {
      const dx = (actor.x - origin.x) * aspect,
        dy = actor.y - origin.y;
      const distance = Math.hypot(dx, dy) || 1;
      const fromX = actor.x,
        fromY = actor.y;
      actor.x = Math.max(
        1,
        Math.min(99, actor.x + ((dx / distance) * 12 * Math.max(1, aspect)) / aspect),
      );
      actor.y = Math.max(1, Math.min(99, actor.y + (dy / distance) * 12 * Math.max(1, aspect)));
      Object.assign(actor, passageTarget({ x: fromX, y: fromY }, actor, actor.passage));
      freeze(actor, time, 450);
      actor.moveId = (actor.moveId || 0) + 1;
      actor.knockback = { id: `${actor.lifeId}:${time}`, fromX, fromY, at: time };
      actor.drillDot = { from, nextAt: time + 1000, remaining: 3 };
    }
  }
  function targets(actors) {
    return [...actors].flatMap((actor) =>
      actor.fragment && actor.health > 0 ? [actor, actor.fragment] : [actor],
    );
  }
  function rollBabylonDamage(actor) {
    const reference =
      rules.babylon.authorComboMin +
      Math.floor(random() * (rules.babylon.authorComboMax - rules.babylon.authorComboMin + 1));
    return Math.round(reference / (actor.authorBonus ? 1 : rules.authorBonus.damageMultiplier));
  }
  function canHit(from, to, time, effect) {
    return policy.canHit?.(from, to, time, attackKind(effect)) ?? true;
  }
  function canContinueCast(source, actor, time) {
    return policy.canContinueCast?.(source, actor, time) ?? true;
  }
  function hit(from, to, time, effect, weight = 1, phase = '') {
    effect = attackKind(effect);
    if (!canHit(from, to, time, effect)) {
      const coverImpact = policy.coverImpact?.(from, to, time, effect);
      return { damage: 0, critical: false, blocked: true, ...(coverImpact && { coverImpact }) };
    }
    alive(from);
    // A downed actor cannot award another kill, even through a repeated event.
    if (to.health === 0 || from === to) return { damage: 0, critical: false };
    if (to.kind === 'fragment' && (to.ownerId === from.id || to.owner.fragment !== to))
      return { damage: 0, critical: false };
    const minimum = rules.damage.min * rules.unitScale;
    const babylon = effect === 'gate_of_babylon';
    const base = babylon
      ? (from.comboDamage ?? rollBabylonDamage(from))
      : minimum +
        Math.floor(random() * ((rules.damage.max - rules.damage.min) * rules.unitScale + 1));
    const critical =
      effect !== 'shaohua_devour' &&
      phase !== 'ordinary-dot' &&
      random() < rules.damage.criticalChance;
    // A whole-cast budget preserves the requested author range. Integer partitions
    // sum exactly; Ea takes two thirds, the four weapon salvos share one third.
    const weapons = Math.round(base / 3);
    const salvo = /^volley[1-4]$/.test(phase) ? Number(phase.slice(-1)) : 0;
    const portion =
      phase === 'ea'
        ? base - weapons
        : salvo
          ? Math.round((weapons * salvo) / 4) - Math.round((weapons * (salvo - 1)) / 4)
          : (base * weight) / 3;
    const incoming = Math.round(
      babylon
        ? portion *
            (critical ? rules.damage.criticalMultiplier : 1) *
            (time < (from.guanyinUntil || 0) ? rules.guanyinBonus.multiplier : 1)
        : base *
            weight *
            (damageMultipliers.get(effect) ?? 1) *
            (effect === 'explosion' ? 1.5 : 1) *
            (areaEffects.has(effect) ? rules.areaDamageMultiplier : 1) *
            (critical ? rules.damage.criticalMultiplier : 1) *
            (from.authorBonus ? rules.authorBonus.damageMultiplier : 1) *
            (time < (from.guanyinUntil || 0) ? rules.guanyinBonus.multiplier : 1),
    );
    let blockedPercent = 0;
    if (time < (to.shieldResidualUntil || to.shieldUntil || 0)) {
      const min = to.authorBonus ? rules.shield.authorMinimumPercent : rules.shield.minimumPercent;
      const max = to.authorBonus ? rules.shield.authorMaximumPercent : rules.shield.maximumPercent;
      blockedPercent = min + Math.floor(random() * (max - min + 1));
      if (time >= to.shieldUntil) blockedPercent *= rules.shield.residualMultiplier;
    }
    const cover = policy.damageThroughCover?.(from, to, effect) ?? 1;
    const owner = from.energyActor;
    const outgoing =
      (!owner || owner.lifeId === from.energyLifeId) && time < ((owner ?? from).kissedUntil || 0)
        ? rules.rainbowBear.outgoingMultiplier
        : 1;
    const rawDamage =
      effect === 'shaohua_devour'
        ? Math.round(Math.max(0, to.health - 1) * cover)
        : Math.round(
            incoming *
              cover *
              (profile(from).damage +
                (from.pickupAttackBonus ??
                  (time < (from.pickupAttackUntil || 0) ? pickupRules.attackBonus : 0))) *
              profile(to).defense *
              outgoing *
              (1 - blockedPercent / 100) *
              (time < (to.pickupShieldUntil || 0) ? 0.7 : 1) *
              (time < (to.excaliburUntil || 0)
                ? 1 - rules.excaliburGuard.reductionPercent / 100
                : 1),
          );
    const damage =
      effect === 'zero_equation'
        ? Math.min(rawDamage, Math.max(0, to.health - 1))
        : effect === 'shaohua_devour'
          ? Math.round(rawDamage * outgoing)
          : rawDamage;
    const weakened =
      damage > 0 &&
      (cover < 1 ||
        (effect !== 'shaohua_devour' &&
          (blockedPercent > 0 ||
            profile(to).defense < 1 ||
            time < (to.pickupShieldUntil || 0) ||
            time < (to.excaliburUntil || 0))));
    if (to.kind === 'fragment') {
      to.health = Math.max(0, to.health - damage);
      if (!to.health && to.owner.fragment === to && to.owner.health > 0) {
        to.owner.health = Math.ceil(to.owner.health / 2);
        to.owner.lastHitAt = to.owner.regenAt = time;
        to.owner.fragment = null;
      }
      return { damage, critical, ...(weakened && { weakened }) };
    }
    let helpers = contributions.get(to);
    if (!helpers) contributions.set(to, (helpers = new Map()));
    for (const [id, entry] of helpers) if (time - entry.at > 10000) helpers.delete(id);
    if (damage > 0 && from.id && from.id !== to.id) {
      helpers.set(from.id, { actor: from, at: time });
    }
    if (phase !== 'ordinary-dot' && !(effect === 'starburst_stream' && phase !== 'slash1'))
      energy.hit(from, to, effect, damage);
    if (
      to.guardEnergyReady &&
      time < to.shieldUntil &&
      blockedPercent > 0 &&
      damage > 0 &&
      damage < incoming &&
      effect !== 'shaohua_devour'
    ) {
      to.guardEnergyReady = false;
      const before = to.energy || 0;
      energy.gain(to, rules.shield.guardEnergy);
      to.guardEnergy = { at: time, amount: Math.round((to.energy - before) * 10) / 10 };
    }
    policy.onDamage?.(from, to, time, Math.min(to.health, damage));
    to.health = Math.max(0, to.health - damage);
    to.lastHitAt = to.regenAt = time;
    if (!to.health) {
      stats(to).deaths++;
      if (from.id && from.id !== to.id) stats(from).kills++;
      for (const [id, entry] of helpers)
        if (id !== from.id && id !== to.id) stats(entry.actor).assists++;
      contributions.delete(to);
      clearDeath(to, time);
    }
    policy.onHit?.(from, to, time, damage);
    return { damage, critical, ...(weakened && { weakened }) };
  }
  function clearDeath(actor, time) {
    actor.summon = null;
    actor.kissedUntil = 0;
    actor.equation = null;
    actor.blackoutUntil = 0;
    actor.shieldUntil = 0;
    actor.shieldResidualUntil = 0;
    actor.guardEnergyReady = false;
    actor.guardEnergy = null;
    actor.slowUntil = 0;
    actor.teleportBlockedUntil = 0;
    actor.hasteUntil = 0;
    actor.heroFlightUntil = 0;
    actor.sealedUntil = 0;
    actor.ordinaryDot = null;
    actor.guanyinUntil = 0;
    actor.excaliburUntil = 0;
    actor.regenBlockedUntil = 0;
    actor.fragment = null;
    actor.drillDot = null;
    actor.pickupSpeedAt =
      actor.pickupSpeedUntil =
      actor.pickupShieldUntil =
      actor.pickupAttackUntil =
        0;
    actor.lastPickup = null;
    actor.respawnAt = time + rules.respawnMs;
    actor.targetX = actor.x;
    actor.targetY = actor.y;
    actor.wallRoute = [];
  }
  function environmentDamage(actor, time, fraction) {
    if (!actor.health) return;
    const reduction = time < (actor.pickupShieldUntil || 0) ? 0.7 : 1;
    const damage = Math.min(
      actor.health,
      Math.max(1, Math.round(actor.maxHealth * fraction * reduction * profile(actor).defense)),
    );
    policy.onEnvironmentDamage?.(actor, time, damage);
    actor.health -= damage;
    actor.dotPulse = { id: `terrain:${actor.lifeId}:${time}`, at: time, damage, critical: false };
    actor.lastHitAt = actor.regenAt = time;
    if (!actor.health) {
      stats(actor).deaths++;
      contributions.delete(actor);
      clearDeath(actor, time);
    }
  }
  function view(actor, includeStatus = false) {
    const time = actor.combatAt || 0;
    const living = actor.health > 0;
    const guanyin = living && time < (actor.guanyinUntil || 0);
    const guardFullUntil = Math.max(actor.shieldUntil || 0, actor.excaliburUntil || 0);
    const guardUntil = Math.max(guardFullUntil, actor.shieldResidualUntil || 0);
    return {
      ...(includeStatus
        ? {
            combatStatus: {
              authorBonus: !!actor.authorBonus,
              guardEnergy:
                living &&
                actor.guardEnergy &&
                time < actor.guardEnergy.at + rules.shield.guardNoticeMs
                  ? actor.guardEnergy.amount
                  : 0,
              guanyin,
              excalibur: living && time < (actor.excaliburUntil || 0),
              shield:
                !living || time >= (actor.shieldResidualUntil || 0)
                  ? 'none'
                  : time < actor.shieldUntil
                    ? 'full'
                    : 'residual',
              regenerating:
                living &&
                actor.health < actor.maxHealth &&
                time >= (actor.regenBlockedUntil || 0) &&
                time >= actor.lastHitAt + rules.regeneration.delayMs,
              regenWaitMs: living
                ? Math.max(
                    0,
                    actor.lastHitAt + rules.regeneration.delayMs - time,
                    (actor.regenBlockedUntil || 0) - time,
                  )
                : 0,
              regenBlockedMs: living ? Math.max(0, (actor.regenBlockedUntil || 0) - time) : 0,
              sealedMs: living ? Math.max(0, (actor.sealedUntil || 0) - time) : 0,
              teleportBlockedMs: living ? Math.max(0, (actor.teleportBlockedUntil || 0) - time) : 0,
              ordinaryDotMs:
                living && actor.ordinaryDot
                  ? Math.max(
                      0,
                      actor.ordinaryDot.nextAt +
                        (actor.ordinaryDot.remaining - 1) * rules.ordinaryDot.intervalMs -
                        time,
                    )
                  : 0,
              regenPerSecond: Math.round(
                rules.regeneration.perSecond *
                  rules.unitScale *
                  (actor.authorBonus ? rules.authorBonus.regenerationMultiplier : 1) *
                  (guanyin ? rules.guanyinBonus.multiplier : 1),
              ),
            },
          }
        : {}),
      energy: actor.energy || 0,
      energyMaximum: energy.maximum(actor),
      health: actor.health,
      maxHealth: actor.maxHealth,
      respawnAt: actor.respawnAt,
      kda: { ...stats(actor) },
      immobileUntil: actor.immobileUntil || 0,
      guardFullMs: living ? Math.max(0, guardFullUntil - time) : 0,
      guardMs: living ? Math.max(0, guardUntil - time) : 0,
      slowMs:
        living && time >= (actor.immobileUntil || 0)
          ? Math.max(0, (actor.slowUntil || 0) - time)
          : 0,
      teleportBlockedUntil: actor.teleportBlockedUntil || 0,
      hasteMs: living ? Math.max(0, (actor.hasteUntil || 0) - time) : 0,
      heroFlightUntil: actor.heroFlightUntil || 0,
      sealedUntil: actor.sealedUntil || 0,
      ...(living && actor.kissedUntil > time ? { kissedUntil: actor.kissedUntil } : {}),
      ...(living && actor.equation ? { equationLocked: true } : {}),
      ...(living && includeStatus && actor.equation
        ? {
            equation: {
              id: actor.equation.id,
              prompt: actor.equation.prompt,
              options: [...actor.equation.options],
              rejectedOptions: [...actor.equation.rejectedOptions],
            },
          }
        : {}),
      ...(includeStatus && actor.blackoutUntil > time
        ? { blackoutUntil: actor.blackoutUntil }
        : {}),
      ...(living && actor.summon?.until > time
        ? { summon: { ...actor.summon, remainingMs: actor.summon.until - time } }
        : {}),
      knockback:
        actor.knockback && actor.combatAt - actor.knockback.at < 1200
          ? { ...actor.knockback }
          : null,
      dotPulse:
        actor.dotPulse && actor.combatAt - actor.dotPulse.at < 1000 ? { ...actor.dotPulse } : null,
      fragment: actor.fragment
        ? {
            id: actor.fragment.id,
            x: actor.fragment.x,
            y: actor.fragment.y,
            health: actor.fragment.health,
            maxHealth: actor.fragment.maxHealth,
            stealable: time >= actor.fragment.stealableAt,
          }
        : null,
      severed: actor.severed === true,
    };
  }
  return {
    reset,
    environmentDamage,
    advance,
    alive,
    protect,
    hit,
    canHit,
    canContinueCast,
    view,
    freeze,
    canMove,
    trapEquation,
    solveEquation,
    canCast,
    canTeleport,
    applyEffect,
    targets,
    collect,
    cast,
    rollBabylonDamage,
  };
}
module.exports = { createSceneCombat, sceneDistance, authorSpeed };
