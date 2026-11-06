const { attackKind } = require('./attack-kind');
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

// No per-projectile timers. Polls/commands advance this bounded scene clock.
// Actor references remain private, never in serialized snapshots.
function createAttackTimeline(combat) {
  const runtime = new WeakMap();
  const homingByCaster = new WeakMap();
  function prepare(event, self, targets, actors = targets) {
    const effect = attackKind(event.effect);
    if (effect === 'bijuu_beam')
      event.rays = selectBijuuDirections(self, actors, event.aspectRatio);
    const source = {
      energyActor: self,
      energyLifeId: self.lifeId,
      ...(effect === 'micro_missiles'
        ? { ordinaryEnergyRemaining: rules.energy.missileCastCap }
        : {}),
      id: self.id,
      health: 1,
      authorBonus: self.authorBonus,
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
    event.hits = [];
    for (const [delay, weight, phase] of timing[effect]) {
      if (phase.startsWith('burn')) {
        jobs.push({ at: event.at + delay, phase, weight, burn: true, done: false });
        continue;
      }
      for (const actor of targets.slice(0, rules.maximumAreaTargets)) {
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
    event.until = event.at + 4400;
  }
  function advance(events, actors, time, moveActor) {
    const bodies = [...actors];
    const due = [];
    for (const event of events) {
      const state = runtime.get(event);
      if (!state) continue;
      queueHomingSteps(event, state, time);
      for (const job of state.jobs)
        if (!job.done && job.at <= time) due.push({ event, state, job });
    }
    due.sort((a, b) => a.job.at - b.job.at);
    let advancedAt;
    for (const { event, state, job } of due) {
      const effect = attackKind(event.effect);
      job.done = true;
      if (advancedAt !== job.at) {
        for (const actor of bodies) moveActor(actor, job.at);
        advancedAt = job.at;
      }
      const map = new Map(combat.targets(bodies).map((actor) => [actor.id, actor]));
      if (job.special) {
        advanceSpecial(combat, event, state, job, bodies, map);
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
        const inRange =
          job.burn ||
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
        if (!present || !sameLife || !inRange) {
          hit.missed = true;
          continue;
        }
        Object.assign(hit, combat.hit(state.source, actor, job.at, effect, job.weight, job.phase));
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
        ].includes(effect)
      )
        return time <= event.until + statusSettleMs;
      const movement = runtime.get(event)?.movement;
      return movement && movement.updateUntil + statusSettleMs >= time;
    });
  }
  return { prepare, advance, needsFastUpdates };
}
module.exports = { createAttackTimeline };
