'use strict';

const center = ({ x, y }) => ({ x: 25 + x / 2, y: 25 + y / 2 });
const insideArena = (value) => Math.max(1, Math.min(99, value));
const boundary = ({ x, y }) => ({ x: insideArena(x), y: insideArena(y) });
const rectangle = (x, y, width, height) => ({ x, y, width, height });

const wings = [
  { wall: rectangle(36, 11, 16, 2), bush: rectangle(55, 8, 10, 7), trap: rectangle(37, 16, 8, 5) },
  {
    wall: rectangle(83, 33, 2, 16),
    bush: rectangle(87, 46, 5, 13),
    trap: rectangle(78, 39, 5, 12),
  },
  { wall: rectangle(48, 86, 16, 2), bush: rectangle(35, 88, 10, 7), trap: rectangle(55, 77, 8, 5) },
  { wall: rectangle(14, 51, 2, 16), bush: rectangle(5, 34, 5, 13), trap: rectangle(16, 53, 6, 12) },
];
const profiles = {
  bush: ['bushBank', 'bushCross', 'bushEdge', 'bushElbow'],
  trap: ['mudElbow', 'emberScar', 'mudBasin', 'emberCross'],
};
function rollArenaRegions(random) {
  const offset = () => Math.floor(Math.min(0.999999, Math.max(0, random())) * 5) - 2;
  return Array.from({ length: wings.length + 1 }, () => ({ x: offset(), y: offset() }));
}
function shiftArenaCore(core, offsets) {
  if (!offsets?.[0]) return core;
  const { x, y } = offsets[0];
  return core.map((box) => ({
    ...box,
    x: Math.max(1, Math.min(99 - box.width, box.x + x)),
    y: Math.max(1, Math.min(99 - box.height, box.y + y)),
  }));
}
const wingWallPatterns = {
  2: [
    [
      [36, 11, 16, 2],
      [36, 7, 2, 4],
    ],
    [
      [83, 33, 2, 16],
      [85, 33, 6, 2],
    ],
    [
      [48, 86, 16, 2],
      [62, 88, 2, 5],
    ],
    [
      [14, 51, 2, 16],
      [8, 65, 6, 2],
    ],
  ],
  3: [
    [
      [26, 10, 3, 14],
      [29, 11, 3, 2],
      [65, 14, 11, 3],
      [69, 8, 2, 14],
    ],
    [
      [83, 31, 12, 3],
      [89, 34, 2, 5],
      [93, 26, 2, 5],
      [85, 64, 3, 11],
    ],
    [
      [42, 81, 3, 13],
      [65, 89, 15, 3],
      [66, 85, 2, 4],
      [71, 81, 2, 8],
      [76, 92, 2, 5],
    ],
    [
      [8, 24, 12, 3],
      [10, 19, 2, 5],
      [14, 27, 2, 5],
      [18, 27, 2, 4],
      [13, 58, 3, 14],
      [10, 64, 3, 2],
    ],
  ],
  4: [
    [
      [28, 7, 3, 10],
      [64, 10, 6, 3],
      [73, 9, 5, 3],
    ],
    [
      [85, 27, 6, 3],
      [93, 29, 4, 3],
      [89, 66, 5, 7],
    ],
    [
      [37, 86, 4, 8],
      [64, 89, 5, 3],
      [72, 87, 4, 3],
      [79, 90, 4, 3],
    ],
    [
      [9, 24, 5, 3],
      [16, 26, 5, 3],
      [12, 58, 4, 9],
    ],
  ],
};
function appendWingGeometry(core, type, offsets = [], pattern) {
  const shift = (box, index) => {
    const offset = offsets[index];
    return offset ? { ...box, x: box.x + offset.x, y: box.y + offset.y } : box;
  };
  const middle = core.map((box) => ({
    ...box,
    ...shift(center(box), 0),
    width: box.width / 2,
    height: box.height / 2,
  }));
  const wallPattern = type === 'wall' && wingWallPatterns[pattern];
  if (wallPattern)
    return middle.concat(
      wallPattern.flatMap((wing, index) =>
        wing.map(([x, y, width, height], segment) => ({
          ...shift(rectangle(x, y, width, height), index + 1),
          id: 'wing-wall-' + index + '-' + segment,
        })),
      ),
    );
  return middle.concat(
    wings.map((wing, index) => ({
      ...shift(wing[type], index + 1),
      id: 'wing-' + type + '-' + index,
      ...(profiles[type] ? { shape: profiles[type][index] } : {}),
      ...(type === 'trap' ? { kind: index % 2 ? 'embers' : 'mud' } : {}),
    })),
  );
}

const portals = [
  { id: 'north', pair: 'south', x: 50, y: 5 },
  { id: 'south', pair: 'north', x: 50, y: 95 },
  { id: 'west', pair: 'east', x: 5, y: 50 },
  { id: 'east', pair: 'west', x: 95, y: 50 },
];
const largePortalPositions = [
  [
    [22, 10],
    [78, 94],
    [6, 43],
    [95, 57],
  ],
  [
    [53, 8],
    [53, 92],
    [6, 75],
    [95, 23],
  ],
  [
    [86, 8],
    [28, 94],
    [6, 47],
    [95, 51],
  ],
];
function mapPortals(pattern) {
  if (pattern === 0) return twinLanePortals;
  const positions = largePortalPositions[pattern - 2];
  return positions
    ? portals.map((portal, index) => ({
        ...portal,
        x: positions[index][0],
        y: positions[index][1],
      }))
    : [];
}
const twinLanePortals = [
  {
    id: 'northwest',
    pair: 'southeast',
    x: 29,
    y: 16,
    exits: [
      { x: 71, y: 91 },
      { x: 72, y: 76 },
    ],
  },
  {
    id: 'southeast',
    pair: 'northwest',
    x: 71,
    y: 84,
    exits: [
      { x: 29, y: 9 },
      { x: 28, y: 24 },
    ],
  },
];
const portalRadius = 2;

function traversePortal(actor, entrances = portals, random = Math.random) {
  const entrance = entrances.find(
    (portal) => Math.hypot(actor.x - portal.x, actor.y - portal.y) <= portalRadius,
  );
  if (!entrance) {
    actor.arenaPortalLocked = false;
    return false;
  }
  if (actor.arenaPortalLocked) return false;
  const exit = entrance.exits
    ? entrance.exits[
        Math.min(entrance.exits.length - 1, Math.floor(random() * entrance.exits.length))
      ]
    : entrances.find((portal) => portal.id === entrance.pair);
  actor.arenaPortalLocked = true;
  actor.x = actor.targetX = exit.x;
  actor.y = actor.targetY = exit.y;
  actor.wallRoute = [];
  actor.teleportId = (actor.teleportId || 0) + 1;
  actor.moveId++;
  return true;
}

module.exports = {
  rollArenaRegions,
  shiftArenaCore,
  appendWingGeometry,
  boundary,
  center,
  portals,
  twinLanePortals,
  mapPortals,
  portalRadius,
  traversePortal,
};
