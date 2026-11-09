'use strict';
const { randomUUID } = require('node:crypto');
const energy = require('./scene-energy');
const { covers } = require('./lobby-arena');
const kinds = Object.freeze(['health', 'speed', 'shield', 'sword']);
const rules = Object.freeze({
  radius: 3,
  maximum: 3,
  lifetimeMs: 30000,
  effectMs: 6000,
  speed: 1.5,
  attackBonus: 0.2,
  healing: 0.25,
  reduction: 0.3,
  energy: 25,
});
const zones = [
  [6, 16, 45, 76],
  [66, 74, 40, 75],
  [8, 68, 82, 94],
];
function clearEffects(actor) {
  actor.pickupSpeedAt =
    actor.pickupSpeedUntil =
    actor.pickupShieldUntil =
    actor.pickupAttackUntil =
      0;
  actor.lastPickup = null;
}
// First entry into a circle, rather than the closest point or Map iteration order.
function contact(from, to, item) {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const x = from.x - item.x,
    y = from.y - item.y;
  const c = x * x + y * y - rules.radius ** 2;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy,
    b = 2 * (x * dx + y * dy);
  const d = b * b - 4 * a * c;
  if (!a || d < 0) return null;
  const t = (-b - Math.sqrt(d)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
function travelTime(distanceSeconds, start, speedAt = 0, speedUntil = 0) {
  if (speedUntil <= start || speedAt >= speedUntil) return start + distanceSeconds * 1000;
  const before = Math.max(0, (speedAt - start) / 1000);
  if (distanceSeconds <= before) return start + distanceSeconds * 1000;
  const boostedStart = Math.max(start, speedAt),
    available = (speedUntil - boostedStart) / 1000;
  const rest = distanceSeconds - before;
  return rest <= available * rules.speed
    ? boostedStart + (rest / rules.speed) * 1000
    : speedUntil + (rest - available * rules.speed) * 1000;
}
function createLobbyPickups(now, random, arena, coverGeometry = covers, expanded = false) {
  const availableKinds = expanded ? [...kinds, 'energy'] : kinds;
  const spawnZones = expanded ? [[5, 95, 5, 95]] : zones;
  let items = [],
    nextAt = now() + delay(),
    scope = arena.pickupScope(),
    lastTime = -Infinity;
  const paths = new WeakMap();
  const roll = () => Math.max(0, Math.min(0.999999999, random()));
  function delay() {
    return 8000 + Math.floor(Math.max(0, Math.min(1, random())) * 4000);
  }
  function record(actor, from, fromAt, time, discontinuous = false, motion = null) {
    if (!arena.pickupScope()) return;
    const entries = paths.get(actor) || [];
    entries.push({
      from: discontinuous ? { x: actor.x, y: actor.y } : from,
      to: { x: actor.x, y: actor.y },
      fromAt: discontinuous ? time : fromAt,
      time,
      motion: discontinuous ? null : motion,
    });
    paths.set(actor, entries);
  }
  function advance(actors, time) {
    if (time < lastTime) return;
    lastTime = time;
    const bodies = [...actors];
    if (scope !== arena.pickupScope()) {
      scope = arena.pickupScope();
      items = [];
      nextAt = time + delay();
      for (const actor of bodies) clearEffects(actor);
    }
    if (!scope) {
      for (const actor of bodies) paths.delete(actor);
      return;
    }
    const eligible = bodies.filter(
      (a) => a.health > 0 && time - a.seenAt <= 15000 && arena.canCollect(a.id, time),
    );
    const candidates = [];
    for (const actor of eligible) {
      const segments = paths.get(actor) || [{ from: actor, fromAt: time, time }];
      for (const path of segments)
        for (const item of items) {
          const t = contact(path.from, path.to || actor, item);
          if (t === null) continue;
          const at = path.motion
            ? travelTime(
                path.motion.distance * t,
                path.motion.start,
                path.motion.speedAt,
                path.motion.speedUntil,
              )
            : path.fromAt + t * Math.max(0, path.time - path.fromAt);
          if (at < item.at || at >= item.until || time >= item.until) continue;
          candidates.push({ actor, item, at });
        }
    }
    candidates.sort(
      (a, b) =>
        a.at - b.at || a.actor.id.localeCompare(b.actor.id) || a.item.id.localeCompare(b.item.id),
    );
    const taken = new Set();
    for (const { actor, item } of candidates) {
      if (taken.has(item.id)) continue;
      if (item.kind === 'health') {
        if (actor.health >= actor.maxHealth || time < (actor.regenBlockedUntil || 0)) continue;
        actor.health = Math.min(
          actor.maxHealth,
          actor.health + Math.round(actor.maxHealth * rules.healing),
        );
      } else if (item.kind === 'energy') {
        if ((actor.energy || 0) >= energy.maximum(actor)) continue;
        energy.gain(actor, rules.energy);
      } else if (item.kind === 'speed') {
        actor.pickupSpeedAt = time;
        actor.pickupSpeedUntil = time + rules.effectMs;
      } else if (item.kind === 'sword') actor.pickupAttackUntil = time + rules.effectMs;
      else actor.pickupShieldUntil = time + rules.effectMs;
      actor.lastPickup = { id: item.id, kind: item.kind, at: time, until: time + 4000 };
      taken.add(item.id);
    }
    items = items.filter((item) => !taken.has(item.id) && time < item.until);
    for (const actor of bodies) paths.delete(actor);
    // No backlog burst after an empty lobby or a suspended process.
    if (time < nextAt) return;
    nextAt = time + delay();
    if (!eligible.length || items.length >= rules.maximum) return;
    for (let attempt = 0; attempt < 24; attempt++) {
      const zone = spawnZones[Math.floor(roll() * spawnZones.length)];
      const x = zone[0] + roll() * (zone[1] - zone[0]),
        y = zone[2] + roll() * (zone[3] - zone[2]);
      if (
        (typeof coverGeometry === 'function' ? coverGeometry() : coverGeometry).some(
          (c) => x >= c.x - 4 && x <= c.x + c.width + 4 && y >= c.y - 4 && y <= c.y + c.height + 4,
        ) ||
        items.some((item) => Math.hypot(item.x - x, item.y - y) < 8) ||
        bodies.some((actor) => Math.hypot(actor.x - x, actor.y - y) < 4)
      )
        continue;
      items.push({
        id: randomUUID(),
        kind: availableKinds[Math.floor(roll() * availableKinds.length)],
        x,
        y,
        at: time,
        until: time + rules.lifetimeMs,
      });
      break;
    }
  }
  function effects(actor, time) {
    const speedUntil = actor.pickupSpeedUntil > time ? actor.pickupSpeedUntil : 0,
      shieldUntil = actor.pickupShieldUntil > time ? actor.pickupShieldUntil : 0,
      attackUntil = actor.pickupAttackUntil > time ? actor.pickupAttackUntil : 0;
    const last = actor.lastPickup?.until > time ? { ...actor.lastPickup } : null;
    return speedUntil > time || shieldUntil > time || attackUntil > time || last
      ? { pickupEffects: { speedUntil, shieldUntil, attackUntil, last } }
      : {};
  }
  return {
    record,
    advance,
    effects,
    view: () => ({ pickups: items.map((item) => ({ ...item })), nextPickupAt: scope ? nextAt : 0 }),
  };
}
module.exports = { createLobbyPickups, contact, clearEffects, kinds, rules, travelTime };
