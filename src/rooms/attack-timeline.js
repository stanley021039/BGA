const { attackKind } = require('./attack-kind');
const { rules: pickupRules } = require('./lobby-pickups');
const timing = require('../../public/shared/attack-timing.json');
const rules = require('../../public/shared/scene-rules.json');
const { inAttackArea, selectBijuuDirections } = require('./attack-targets');
const { sceneDistance } = require('./scene-combat');
const {
  prepareSpecial,
  advanceSpecial,
  queueHomingSteps,
  failHoming,
} = require('./special-attacks');

// Include a final room update after the effect expires.
const statusSettleMs = 500;
const {
  windowMs: reflectionWindow,
  travelMs: reflectionTravelMs,
  settleMs: reflectionSettleMs,
  maximumReturns,
} = rules.crystalReflection;
const reflectable = new Set(rules.crystalReflection.projectiles);

// No per-projectile timers. Polls/commands advance this bounded scene clock.
// Actor references remain private, never in serialized snapshots.
function createAttackTimeline(combat, afterAdvance = () => {}, wallsFor = () => null) {
  const runtime = new WeakMap();
  const homingByCaster = new WeakMap();
  const reflections = new WeakMap();
  function armReflection(event, actor) {
    event.hits = [];
    event.until = event.at + reflectionWindow + reflectionTravelMs + reflectionSettleMs;
    const state = {
      jobs: [],
      lifeId: actor.lifeId,
      energyBudget: {
        ordinaryEnergyRemaining: actor.ordinaryHitEnergy ?? rules.energy.ordinaryHit,
      },
    };
    runtime.set(event, state);
    reflections.set(actor, { event, state });
  }

  function intercept(originalEffect, source, actor, job, activeActors) {
    const effect = attackKind(originalEffect);
    const guard = reflections.get(actor);
    if (
      !reflectable.has(effect) ||
      !guard ||
      guard.state.lifeId !== actor.lifeId ||
      job.at < guard.event.at ||
      job.at >= guard.event.at + reflectionWindow
    )
      return null;
    const attacker = source.energyActor;
    guard.state.returnToId ??= attacker.id;
    if (guard.state.returnToId !== attacker.id || guard.event.hits.length >= maximumReturns)
      return guard;
    const hit = {
      toId: attacker.id,
      toX: attacker.x,
      toY: attacker.y,
      aimX: actor.x,
      aimY: actor.y,
      damage: 0,
      critical: false,
      phase: 'reflection',
      reflectionIndex: guard.event.hits.length,
      reflectedEffect: originalEffect,
      reflectedPhase: job.phase,
      delayMs: job.at + reflectionTravelMs - guard.event.at,
      pending: true,
    };
    const returned = {
      at: job.at + reflectionTravelMs,
      actor: attacker,
      lifeId: source.energyLifeId,
      hit,
      effect,
      weight: job.weight,
      source: {
        id: actor.id,
        health: 1,
        energyActor: actor,
        energyLifeId: actor.lifeId,
        reflectionBudget: guard.state.energyBudget,
        authorBonus: actor.authorBonus,
        guanyinUntil: actor.guanyinUntil,
        kda: actor.kda,
      },
      reflected: true,
      done: false,
    };
    guard.event.hits.push(hit);
    guard.state.jobs.push(returned);
    if (
      activeActors.get(attacker.id) !== attacker ||
      attacker.health <= 0 ||
      attacker.lifeId !== returned.lifeId
    ) {
      returned.done = true;
      hit.pending = false;
      hit.missed = true;
    }
    return { ...guard, job: returned };
  }
  function prepare(event, self, targets, actors = targets) {
    const effect = attackKind(event.effect);
    if (effect === 'bijuu_beam')
      event.rays = selectBijuuDirections(self, actors, event.aspectRatio);
    const source = {
      energyActor: self,
      energyLifeId: self.lifeId,
      ordinaryHitIndex: 0,
      id: self.id,
      combatEpoch: self.combatEpoch || 0,
      matchId: self.matchId || null,
      castId: event.id,
      slot: event.slot,
      originX: event.fromX,
      originY: event.fromY,
      health: 1,
      authorBonus: self.authorBonus,
      archetype: self.archetype,
      pickupAttackBonus: event.at < (self.pickupAttackUntil || 0) ? pickupRules.attackBonus : 0,
      guanyinUntil: self.guanyinUntil,
      kda: self.kda,
      ...(effect === 'gate_of_babylon' ? { comboDamage: combat.rollBabylonDamage(self) } : {}),
    };
    const special = prepareSpecial(event, self, targets[0], source);
    if (special) {
      if (event.head) {
        const previous = homingByCaster.get(self);
        if (previous?.head && !previous.head.finished && !previous.head.cancelled) {
          const previousLife = runtime.get(previous)?.special.lifeId;
          failHoming(previous, previousLife === self.lifeId ? self : null, event.at);
        }
        homingByCaster.set(self, event);
      }
      runtime.set(event, special);
      return;
    }
    const jobs = [];
    const targetLimit = ['starburst_stream', 'rainbow_bear', 'zero_equation'].includes(effect)
      ? 1
      : rules.maximumAreaTargets;
    event.hits = [];
    const phases = [...timing[effect]];
    if (['quicksand_trap', 'venom_thorn'].includes(effect) && combat.rollChance(0.15))
      phases.push([phases.at(-1)[0] + 300, 0.5, 'extra']);
    for (const [delay, weight, phase] of phases) {
      const radius =
        effect === 'susanoo'
          ? rules.susanoo.radius
          : phase === 'detonation'
            ? rules.humanMalice.detonationRadius
            : 0;
      if (radius) {
        jobs.push({ at: event.at + delay, phase, weight, casterBurstRadius: radius, done: false });
        continue;
      }
      if (phase.startsWith('burn')) {
        jobs.push({ at: event.at + delay, phase, weight, burn: true, done: false });
        continue;
      }
      for (const actor of targets.slice(0, targetLimit)) {
        const delayMs =
          effect === 'solar_phoenix'
            ? Math.round(
                700 +
                  3400 *
                    Math.max(
                      0.2,
                      Math.min(
                        0.9,
                        0.2 +
                          (((sceneDistance(self, actor, event.aspectRatio) /
                            rules.areaAttackRange) *
                            760 -
                            100) *
                            0.6) /
                            580,
                      ),
                    ),
              )
            : delay;
        const hit = {
          toId: actor.id,
          toX: actor.x,
          toY: actor.y,
          damage: 0,
          critical: false,
          phase,
          delayMs,
          pending: true,
        };
        if (effect === 'bijuu_beam') {
          const ray = event.rays.find((ray) =>
            inAttackArea(self, ray, actor, effect, event.aspectRatio, {
              shape: 'rectangle',
              width: 7,
              range: rules.areaAttackRange,
            }),
          );
          hit.aimX = ray.x;
          hit.aimY = ray.y;
        }
        event.hits.push(hit);
        jobs.push({
          at: event.at + delayMs,
          phase,
          weight,
          actor,
          lifeId: actor.lifeId,
          hit,
          done: false,
        });
      }
    }
    if (effect === 'explosion')
      jobs.push({
        at: event.at + rules.explosionRecovery.delayMs,
        actor: self,
        lifeId: self.lifeId,
        recovery: true,
        done: false,
      });
    const lastJob = jobs.at(-1);
    const movement =
      lastJob &&
      (effect === 'frost_spikes' || effect === 'blade_aura' || effect === 'blade_aura_crimson')
        ? {
            frost: effect === 'frost_spikes',
            applied: false,
            updateUntil: lastJob.at + Math.max(rules.frost.durationMs, rules.bladeHaste.durationMs),
          }
        : null;
    runtime.set(event, { source, jobs, movement });
    event.damage = 0;
    event.critical = false;
    event.until = event.at + (effect === 'susanoo' ? rules.susanoo.durationMs : 4400);
    if (effect === 'susanoo') self.summon = { effect: event.effect, until: event.until };
  }
  function settleCasterBurst(event, source, job, actors, effect) {
    const caster = source.energyActor;
    if (
      actors.get(caster.id) !== caster ||
      caster.health <= 0 ||
      caster.lifeId !== source.energyLifeId ||
      (effect === 'susanoo' && caster.summon?.until !== event.until)
    )
      return;
    const area = { shape: 'selfBurst', radius: job.casterBurstRadius };
    const included = new Set(event.hits.map((hit) => hit.toId));
    for (const actor of actors.values()) {
      if (
        actor === caster ||
        actor.ownerId === caster.id ||
        actor.health <= 0 ||
        (!included.has(actor.id) && included.size >= rules.maximumAreaTargets) ||
        !inAttackArea(caster, caster, actor, effect, event.aspectRatio, area)
      )
        continue;
      included.add(actor.id);
      event.hits.push({
        toId: actor.id,
        toX: actor.x,
        toY: actor.y,
        aimX: caster.x,
        aimY: caster.y,
        phase: job.phase,
        delayMs: job.at - event.at,
        pending: false,
        ...combat.hit(source, actor, job.at, effect, job.weight, job.phase),
      });
    }
  }
  function advance(events, actors, time, moveActor) {
    const bodies = [...actors];
    const due = [];
    const returning = [];
    for (const event of events) {
      const state = runtime.get(event);
      if (!state) continue;
      queueHomingSteps(event, state, time);
      for (const job of state.jobs) {
        if (job.done) continue;
        if (job.at <= time) due.push({ event, state, job });
        else if (job.reflected) returning.push(job);
      }
    }
    due.sort((a, b) => a.job.at - b.job.at);
    let advancedAt;
    for (let index = 0; index < due.length; index++) {
      const { event, state, job } = due[index];
      const effect = attackKind(event.effect);
      job.done = true;
      if (advancedAt !== job.at) {
        for (const actor of bodies) moveActor(actor, job.at);
        afterAdvance(bodies, job.at);
        advancedAt = job.at;
      }
      const map = new Map(combat.targets(bodies).map((actor) => [actor.id, actor]));
      if (job.casterBurstRadius) {
        settleCasterBurst(event, state.source, job, map, effect);
        continue;
      }
      if (job.reflected) {
        const { actor, hit, at } = job;
        hit.pending = false;
        hit.toX = actor.x;
        hit.toY = actor.y;
        if (map.get(actor.id) !== actor || actor.health <= 0 || actor.lifeId !== job.lifeId) {
          hit.missed = true;
        } else {
          // A reflected projectile settles here and never re-enters intercept().
          Object.assign(
            hit,
            combat.hit(job.source, actor, at, job.effect, job.weight, 'reflection'),
          );
        }
        continue;
      }
      if (job.special) {
        advanceSpecial(combat, event, state, job, bodies, map, wallsFor(state.source));
        continue;
      }
      if (job.recovery) {
        if (
          map.get(job.actor.id) === job.actor &&
          job.actor.health > 0 &&
          job.actor.lifeId === job.lifeId
        )
          combat.freeze(job.actor, job.at, rules.explosionRecovery.durationMs);
        continue;
      }
      const included = new Set(event.hits.map((hit) => hit.toId));
      const origin = { x: event.fromX, y: event.fromY, facing: 'right' };
      const aim = { x: job.hit?.aimX ?? event.toX, y: job.hit?.aimY ?? event.toY };
      const victims = job.burn
        ? [...map.values()]
            .filter((actor) => {
              const progress = (job.at - event.at - 700) / 3400;
              const passed = Math.max(
                0,
                Math.min(65, ((100 + ((progress - 0.2) / 0.6) * 580) / 760) * 65),
              );
              return (
                actor.id !== event.fromId &&
                actor.ownerId !== event.fromId &&
                (included.has(actor.id) || included.size < rules.maximumAreaTargets) &&
                actor.health > 0 &&
                inAttackArea(origin, aim, actor, effect, event.aspectRatio, {
                  shape: 'rectangle',
                  width: 10,
                  range: passed,
                })
              );
            })
            .slice(0, rules.maximumAreaTargets)
        : [job.actor];
      for (const actor of victims) {
        if (job.burn && !included.has(actor.id) && included.size >= rules.maximumAreaTargets)
          continue;
        const hit = job.burn
          ? {
              toId: actor.id,
              toX: actor.x,
              toY: actor.y,
              damage: 0,
              critical: false,
              phase: job.phase,
              delayMs: job.at - event.at,
              pending: false,
            }
          : job.hit;
        hit.pending = false;
        const present =
          map.get(actor.id) === actor &&
          actor.health > 0 &&
          (actor.kind !== 'fragment' || actor.owner.fragment === actor);
        const sameLife = job.burn || actor.lifeId === job.lifeId;
        const wasFrozen =
          effect !== 'world_stasis' ||
          job.phase !== 'release' ||
          event.hits.some(
            (stage) =>
              stage.toId === actor.id &&
              stage.phase === 'stasis' &&
              !stage.pending &&
              !stage.missed,
          );
        const attached = state.lockedTarget === actor;
        const inRange =
          job.burn ||
          attached ||
          inAttackArea(
            origin,
            aim,
            actor,
            effect,
            event.aspectRatio,
            effect === 'bijuu_beam'
              ? {
                  shape: 'rectangle',
                  width: 7,
                  range: rules.areaAttackRange,
                }
              : undefined,
          );
        if (
          !present ||
          !sameLife ||
          !inRange ||
          !wasFrozen ||
          (effect === 'zero_equation' && actor.equation) ||
          (effect === 'rainbow_bear' && job.phase !== 'hug' && !attached)
        ) {
          hit.missed = true;
          continue;
        }
        if (effect === 'world_stasis' && job.phase === 'stasis') {
          const duration = timing.world_stasis[1][0] - timing.world_stasis[0][0];
          hit.toX = actor.x;
          hit.toY = actor.y;
          if (actor.kind !== 'fragment') {
            combat.freeze(actor, job.at, duration);
            actor.stasisUntil = job.at + duration;
            actor.sealedUntil = Math.max(actor.sealedUntil || 0, job.at + duration);
          }
          continue;
        }
        const reflection = intercept(event.effect, state.source, actor, job, map);
        if (reflection) {
          hit.toX = actor.x;
          hit.toY = actor.y;
          if (reflection.job && !reflection.job.done && reflection.job.at <= time) {
            const next = due.findIndex(
              (entry, position) => position > index && entry.job.at > reflection.job.at,
            );
            due.splice(next < 0 ? due.length : next, 0, reflection);
          } else if (reflection.job && !reflection.job.done) {
            returning.push(reflection.job);
          }
          continue;
        }
        const energyBefore = actor.energy || 0;
        Object.assign(hit, combat.hit(state.source, actor, job.at, effect, job.weight, job.phase));
        if (actor.health > 0 && actor.kind !== 'fragment') {
          if (effect === 'starburst_stream' && !attached && hit.damage > 0) {
            state.lockedTarget = actor;
            actor.energy = Math.floor(energyBefore / 2);
          }
          if (effect === 'rainbow_bear' && job.phase === 'hug' && hit.damage > 0) {
            state.lockedTarget = actor;
            actor.kissedUntil = Math.max(
              actor.kissedUntil || 0,
              job.at + rules.rainbowBear.durationMs,
            );
          }
          if (effect === 'zero_equation') combat.trapEquation(actor, event.id);
        }
        if (
          effect === 'black_coffin' &&
          hit.damage > 0 &&
          actor.kind !== 'fragment' &&
          !event.hits.some((stage) => stage !== hit && stage.toId === actor.id && stage.damage > 0)
        )
          actor.blackoutUntil = Math.max(actor.blackoutUntil || 0, job.at + 2000);
        const movement = state.movement;
        if (movement && !movement.applied && hit.damage > 0 && actor.kind !== 'fragment') {
          movement.applied = true;
          movement.updateUntil =
            job.at + (movement.frost ? rules.frost.durationMs : rules.bladeHaste.durationMs);
          if (movement.frost) {
            if (actor.health > 0 && (actor.slowUntil || 0) <= job.at)
              actor.slowUntil = job.at + rules.frost.durationMs;
          } else {
            const owner = state.source.energyActor;
            if (owner.health > 0 && owner.lifeId === state.source.energyLifeId)
              owner.hasteUntil = job.at + rules.bladeHaste.durationMs;
          }
        }
        hit.toX = actor.x;
        hit.toY = actor.y;
        if (hit.blocked) {
          hit.missed = true;
          continue;
        }
        const firstContact =
          !state.firstContact && hit.damage > 0 && actor.health > 0 && actor.kind !== 'fragment';
        if (firstContact) state.firstContact = true;
        if (effect !== 'dimension_cleave' || job.phase === 'finish')
          combat.applyEffect(
            state.source,
            actor,
            job.at,
            effect,
            origin,
            event.aspectRatio,
            job.phase,
            firstContact,
          );
        if (
          job.burn &&
          event.hits.length < 128 &&
          (included.has(actor.id) || included.size < rules.maximumAreaTargets)
        ) {
          event.hits.push(hit);
          included.add(actor.id);
        }
        if (actor.id === event.toId && event.damage === 0) {
          event.damage = hit.damage;
          event.critical = hit.critical;
        }
      }
    }
    for (const actor of bodies) moveActor(actor, time);
    for (const { actor, hit, lifeId } of returning) {
      if (actor.lifeId !== lifeId || actor.health <= 0) continue;
      hit.toX = actor.x;
      hit.toY = actor.y;
    }
    afterAdvance(bodies, time);
  }
  function needsFastUpdates(events, time) {
    return events.some((event) => {
      const effect = attackKind(event.effect);
      if (effect === 'singularity')
        return time <= event.at + timing.singularity.at(-1)[0] + statusSettleMs;
      if (
        [
          'giant_orange_cat',
          'chains',
          'bijuu_beam',
          'orbital',
          'arrow_volley',
          'flame_vortex',
          'shaohua_devour',
          'crystal_reflection',
          'world_stasis',
          'human_malice',
          'susanoo',
          'starburst_stream',
          'rainbow_bear',
          'zero_equation',
        ].includes(effect)
      )
        return time <= event.until + statusSettleMs;
      const movement = runtime.get(event)?.movement;
      return movement && movement.updateUntil + statusSettleMs >= time;
    });
  }
  return { prepare, armReflection, advance, needsFastUpdates };
}
module.exports = { createAttackTimeline };
