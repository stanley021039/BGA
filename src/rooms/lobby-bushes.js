'use strict';
const { appendWingGeometry, shiftArenaCore } = require('./arena-expanded-map');
const { containsZonePoint } = require('./arena-zone-shape');
function createBushes(layoutId, obstacles, expanded = false, offsets, extras = []) {
  const layoutOffsets = [
    [0, 0],
    [0, 0],
    [4, -4],
    [-3, 4],
  ];
  const [dx, dy] = layoutOffsets[layoutId] || layoutOffsets[0];
  const core = [
    [8, 32],
    [81, 28],
    [42, 73],
    [28, 63],
    [68, 36],
    [31, 88],
    [80, 65],
  ].map(([x, y], i) => ({ id: 'bush-' + i, x: x + dx, y: y + dy, width: 10, height: 7 }));
  const candidates = expanded
    ? appendWingGeometry(core, 'bush', offsets)
    : shiftArenaCore(core, offsets);
  const safe = [...candidates, ...extras].filter(
    (b) =>
      !obstacles.some(
        (o) =>
          b.x < o.x + o.width &&
          b.x + b.width > o.x &&
          b.y < o.y + o.height &&
          b.y + b.height > o.y,
      ),
  );
  return expanded
    ? [
        ...safe.filter((b) => b.id.startsWith('bush-')).slice(0, 3),
        ...safe.filter((b) => b.id.startsWith('wing-')),
      ]
    : [
        ...safe.filter((zone) => !zone.id.startsWith('cross-bush-')).slice(0, 3),
        ...safe.filter((zone) => zone.id.startsWith('cross-bush-')),
      ];
}
function bushAt(bushes, actor) {
  return bushes.find((bush) => containsZonePoint(bush, actor, 'bush'));
}
module.exports = { createBushes, bushAt };
