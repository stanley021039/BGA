'use strict';
const rules = require('../../public/shared/scene-rules.json');
const { attackKind } = require('./attack-kind');
const { sceneDistance } = require('./scene-combat');
const { sceneWalk } = require('../../frontend/src/engines/scene-path.js');
function prepareSpecial(event, self, target, source) {
  const kind = attackKind(event.effect);
  if (!['gate_of_heroes', 'shaohua_devour'].includes(kind)) return null;
  const jobs = [];
  if (kind === 'gate_of_heroes')
    jobs.push({ at: event.at + rules.heroLanding.delayMs, special: true, done: false });
  else {
    event.head = {
      x: self.x,
      y: self.y,
      targetX: target.x,
      targetY: target.y,
      at: 0,
      contactAt: 0,
      biteAt: 0,
      finished: false,
      cancelled: false,
    };
  }
  event.hits = [];
  event.damage = 0;
  event.critical = false;
  event.until = event.at + (event.head ? rules.shaohua.lifetimeMs : 4400);
  return {
    source,
    jobs,
    special: {
      kind,
      self,
      lifeId: self.lifeId,
      target,
      targetLife: target.lifeId,
      lastAt: event.at,
      nextAt: event.at + rules.shaohua.stepMs,
    },
  };
}
function queueHomingSteps(event, state, time) {
  const s = state.special;
  if (s?.kind !== 'shaohua_devour') return;
  state.jobs = [];
  if (event.head.finished || event.head.cancelled) return;
  const end = Math.min(time, event.at + rules.shaohua.lifetimeMs);
  for (; s.nextAt <= end; s.nextAt += rules.shaohua.stepMs)
    state.jobs.push({ at: s.nextAt, special: true, done: false });
}
function failHoming(event, caster, time) {
  event.head.cancelled = true;
  event.head.at = time - event.at;
  event.until = time;
  if (caster?.health > 0) {
    caster.health = Math.ceil(caster.health / 2);
    caster.lastHitAt = caster.regenAt = time;
  }
}
function advanceSpecial(combat, event, state, job, bodies, map) {
  const s = state.special,
    origin = s.self;
  const caster = map.get(origin.id) === origin && origin.lifeId === s.lifeId && origin.health > 0;
  const settle = (actor, phase, delayMs) => {
    const hit = {
      toId: actor.id,
      toX: actor.x,
      toY: actor.y,
      phase,
      delayMs,
      pending: false,
      ...combat.hit(state.source, actor, job.at, event.effect),
    };
    event.hits.push(hit);
    combat.applyEffect(
      state.source,
      actor,
      job.at,
      event.effect,
      { x: event.fromX, y: event.fromY },
      event.aspectRatio,
      phase,
    );
    if (event.damage === 0) {
      event.damage = hit.damage;
      event.critical = hit.critical;
    }
  };
  if (s.kind === 'gate_of_heroes') {
    if (!caster) {
      event.cancelled = true;
      return;
    }
    const point = { x: event.toX, y: event.toY };
    origin.x = origin.targetX = point.x;
    origin.y = origin.targetY = point.y;
    origin.heroFlightUntil = 0;
    origin.moveId = (origin.moveId || 0) + 1;
    origin.updatedAt = origin.at = job.at;
    for (const actor of [...map.values()]
      .filter(
        (a) =>
          a !== origin &&
          a.ownerId !== origin.id &&
          a.health > 0 &&
          sceneDistance(point, a, event.aspectRatio) <= rules.heroLanding.radius,
      )
      .slice(0, rules.maximumAreaTargets))
      settle(actor, 'landing', rules.heroLanding.delayMs);
    return;
  }
  const h = event.head;
  if (h.finished || h.cancelled) return;
  if (!caster) {
    failHoming(event, null, job.at);
    return;
  }
  if (
    !s.target ||
    map.get(s.target.id) !== s.target ||
    s.target.lifeId !== s.targetLife ||
    s.target.health <= 0
  ) {
    s.target = [...map.values()]
      .filter(
        (a) => a !== origin && a.kind !== 'fragment' && a.ownerId !== origin.id && a.health > 0,
      )
      .sort(
        (a, b) => sceneDistance(h, a, event.aspectRatio) - sceneDistance(h, b, event.aspectRatio),
      )[0];
    s.targetLife = s.target?.lifeId;
    h.contactAt = h.biteAt = 0;
  }
  const target = s.target;
  const elapsed = job.at - event.at;
  const biting = target && h.contactAt && elapsed >= h.biteAt;
  if (elapsed >= rules.shaohua.lifetimeMs && !biting) {
    failHoming(event, origin, job.at);
    h.exploded = true;
    event.until += rules.shaohua.burstMs;
    return;
  }
  if (!target) {
    s.lastAt = job.at;
    h.at = job.at - event.at;
    return;
  }
  event.toId = target.id;
  event.toName = target.name || event.toName;
  h.targetX = target.x;
  h.targetY = target.y;
  const dt = (job.at - s.lastAt) / 1000;
  s.lastAt = job.at;
  h.at = elapsed;
  if (h.contactAt) {
    h.x = target.x;
    h.y = target.y;
    if (biting) {
      settle(target, 'bite', h.biteAt);
      h.finished = true;
      event.until = Math.min(event.until, job.at + 1000);
    }
    return;
  }
  // Use the character's movement clock so every direction and aspect stays slower.
  const step = sceneWalk(h, target, dt * 1000 * rules.shaohua.speedMultiplier);
  h.x = step.x;
  h.y = step.y;
  if (sceneDistance(h, target, event.aspectRatio) <= rules.shaohua.contactRadius) {
    h.x = target.x;
    h.y = target.y;
    h.contactAt = elapsed;
    h.biteAt = elapsed + rules.shaohua.biteMs;
  }
}
module.exports = { prepareSpecial, advanceSpecial, queueHomingSteps, failHoming };
