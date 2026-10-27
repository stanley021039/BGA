const timing = require('../../public/shared/attack-timing.json');
const rules = require('../../public/shared/scene-rules.json');
const { inAttackArea, selectBijuuDirections } = require('./attack-targets');
const { sceneDistance } = require('./scene-combat');

// No per-projectile timers. Polls/commands advance this bounded scene clock.
// Actor references remain private, never in serialized snapshots.
function createAttackTimeline(combat) {
  const runtime = new WeakMap();
  function prepare(event, self, targets, actors = targets) {
    if (event.effect === 'bijuu_beam')
      event.rays = selectBijuuDirections(self, actors, event.aspectRatio);
    const source = {
      id: self.id,
      health: 1,
      authorBonus: self.authorBonus,
      guanyinUntil: self.guanyinUntil,
      kda: self.kda,
      ...(event.effect === 'gate_of_babylon'
        ? { comboDamage: combat.rollBabylonDamage(self) }
        : {}),
    };
    const jobs = [];
    event.hits = [];
    for (const [delay, weight, phase] of timing[event.effect]) {
      if (phase.startsWith('burn')) {
        jobs.push({ at: event.at + delay, phase, weight, burn: true, done: false });
        continue;
      }
      for (const actor of targets.slice(0, rules.maximumAreaTargets)) {
        const delayMs =
          event.effect === 'solar_phoenix'
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
        if (event.effect === 'bijuu_beam') {
          const ray = event.rays.find((ray) =>
            inAttackArea(self, ray, actor, event.effect, event.aspectRatio, {
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
    if (event.effect === 'explosion')
      jobs.push({
        at: event.at + rules.explosionRecovery.delayMs,
        actor: self,
        lifeId: self.lifeId,
        recovery: true,
        done: false,
      });
    runtime.set(event, { source, jobs });
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
      for (const job of state.jobs)
        if (!job.done && job.at <= time) due.push({ event, state, job });
    }
    due.sort((a, b) => a.job.at - b.job.at);
    let advancedAt;
    for (const { event, state, job } of due) {
      job.done = true;
      if (advancedAt !== job.at) {
        for (const actor of bodies) moveActor(actor, job.at);
        advancedAt = job.at;
      }
      const map = new Map(combat.targets(bodies).map((actor) => [actor.id, actor]));
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
                inAttackArea(origin, aim, actor, event.effect, event.aspectRatio, {
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
            event.effect,
            event.aspectRatio,
            event.effect === 'bijuu_beam'
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
        Object.assign(
          hit,
          combat.hit(state.source, actor, job.at, event.effect, job.weight, job.phase),
        );
        hit.toX = actor.x;
        hit.toY = actor.y;
        if (event.effect !== 'dimension_cleave' || job.phase === 'finish')
          combat.applyEffect(
            state.source,
            actor,
            job.at,
            event.effect,
            origin,
            event.aspectRatio,
            job.phase,
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
  return { prepare, advance };
}
module.exports = { createAttackTimeline };
