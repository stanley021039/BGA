'use strict';
const zones = Object.freeze([
  Object.freeze({ id: 'mud-west', kind: 'mud', x: 7, y: 51, width: 22, height: 12 }),
  Object.freeze({ id: 'embers-east', kind: 'embers', x: 68, y: 52, width: 19, height: 13 }),
  Object.freeze({ id: 'mud-south', kind: 'mud', x: 38, y: 79, width: 24, height: 10 }),
]);
function at(point) {
  return zones.find(
    (z) =>
      point.x >= z.x && point.x <= z.x + z.width && point.y >= z.y && point.y <= z.y + z.height,
  );
}
function speed(point) {
  return at(point)?.kind === 'mud' ? 0.5 : 1;
}
function advance(actor, time, damage) {
  const zone = actor.health > 0 ? at(actor) : null;
  if (actor.hazardId !== zone?.id) {
    actor.hazardId = zone?.id;
    actor.hazardTickAt = time + 1000;
  }
  actor.hazardKind = zone?.kind || null;
  if (zone?.kind === 'embers' && time >= actor.hazardTickAt) {
    const ticks = Math.floor((time - actor.hazardTickAt) / 1000) + 1;
    damage(actor, time, 0.05 * ticks);
    actor.hazardTickAt += ticks * 1000;
    if (!actor.health) {
      actor.hazardKind = null;
      actor.hazardId = null;
    }
  }
}
module.exports = { zones, at, speed, advance };
