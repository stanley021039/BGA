'use strict';
const { appendWingGeometry, shiftArenaCore } = require('./arena-expanded-map');
const { containsZonePoint } = require('./arena-zone-shape');
const positions = [
  [
    [7, 51],
    [68, 52],
    [38, 79],
  ],
  [
    [9, 51],
    [67, 58],
    [39, 79],
  ],
  [
    [22, 52],
    [57, 72],
    [51, 90],
  ],
  [
    [9, 40],
    [75, 57],
    [42, 83],
  ],
];
function createHazards(
  layoutId = 0,
  expanded = false,
  offsets,
  random = Math.random,
  modern = expanded,
  covers = [],
  extras = [],
) {
  const core = (positions[layoutId] || positions[0]).map(([x, y], index) => ({
    id: 'hazard-' + index,
    kind: index === 1 ? 'embers' : 'mud',
    x,
    y,
    width: 11,
    height: 7,
  }));
  const candidates = expanded
    ? appendWingGeometry(core, 'trap', offsets)
    : shiftArenaCore(core, offsets);
  const zones = [...candidates, ...extras].filter(
    (zone) =>
      !covers.some(
        (wall) =>
          zone.x < wall.x + wall.width &&
          zone.x + zone.width > wall.x &&
          zone.y < wall.y + wall.height &&
          zone.y + zone.height > wall.y,
      ),
  );
  function at(point) {
    return zones.find((zone) => containsZonePoint(zone, point, zone.kind));
  }
  function speed(point) {
    return at(point)?.kind === 'mud' ? 0.5 : 1;
  }
  function advanceExpanded(actor, time, damage) {
    const zone = actor.health > 0 ? at(actor) : null;
    const inEmbers = zone?.kind === 'embers';
    if (inEmbers && actor.hazardKind !== 'embers') {
      actor.hazardTickAt = time + 500;
      actor.emberTrailUntil = 0;
    } else if (!inEmbers && actor.hazardKind === 'embers') {
      actor.emberTrailUntil = time + 2000;
      actor.hazardTickAt = time + 500;
    }
    actor.hazardId = zone?.id || null;
    actor.hazardKind = zone?.kind || null;
    const deadline = inEmbers ? time : Math.min(time, actor.emberTrailUntil || 0);
    while (actor.health > 0 && actor.hazardTickAt && actor.hazardTickAt <= deadline) {
      const tickAt = actor.hazardTickAt;
      actor.hazardTickAt += 500;
      damage(actor, tickAt, inEmbers ? 0.045 + random() * 0.01 : 0.00375 + random() * 0.0025);
    }
    if (!actor.health || (!inEmbers && time >= (actor.emberTrailUntil || 0))) {
      actor.emberTrailUntil = 0;
      actor.hazardTickAt = 0;
    }
  }
  function advance(actor, time, damage) {
    if (modern) return advanceExpanded(actor, time, damage);
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
  return { zones, at, speed, advance };
}
module.exports = { ...createHazards(), createHazards };
