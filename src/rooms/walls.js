'use strict';
const { appendWingGeometry, shiftArenaCore, boundary } = require('./arena-expanded-map');
// Shared geometry for rendering, shot blocking, walking, routing and safe arrivals.
const baseline = [
  [18, 28, 3, 'h'],
  [18, 32, 2, 'v'],
  [64, 28, 3, 'h'],
  [76, 32, 2, 'v'],
  [42, 49, 3, 'h'],
  [48, 53, 2, 'v'],
  [18, 72, 2, 'h'],
  [70, 72, 2, 'h'],
];
const layouts = [
  { groups: baseline, x: 50, y: 18 },
  {
    groups: [
      [8, 68, 2, 'v'],
      [12, 68, 2, 'h'],
      [84, 44, 2, 'h'],
      [92, 48, 2, 'v'],
      [38, 57, 3, 'h'],
      [38, 61, 2, 'v'],
      [14, 85, 2, 'h'],
      [73, 80, 2, 'h'],
    ],
    x: 50,
    y: 25,
  },
  {
    groups: [
      [8, 68, 2, 'v'],
      [12, 76, 2, 'h'],
      [82, 46, 2, 'h'],
      [90, 50, 2, 'v'],
      [43, 58, 3, 'h'],
      [49, 62, 2, 'v'],
      [14, 86, 2, 'h'],
      [74, 78, 2, 'v'],
    ],
    x: 54,
    y: 25,
  },
  {
    groups: [
      [7, 65, 2, 'v'],
      [11, 65, 2, 'h'],
      [84, 44, 2, 'v'],
      [72, 44, 2, 'h'],
      [36, 56, 2, 'v'],
      [40, 64, 3, 'h'],
      [16, 85, 3, 'h'],
      [77, 77, 2, 'h'],
    ],
    x: 46,
    y: 25,
  },
];
const mapPatterns = [
  // Staggered lane walls leave the northwest ring and southeast approach open.
  [
    [31, 57, 5, 24],
    [65, 18, 5, 26],
  ],
  // The classic X above staggered horizontal walls.
  [
    [14, 47, 31, 4],
    [55, 61, 29, 4],
    [19, 76, 30, 4],
    ...Array.from({ length: 6 }, (_, i) => [30 + i * 2, 91 - i * 4, 3, 5]),
    ...Array.from({ length: 6 }, (_, i) => [65 + i * 2, 54 + i * 3.5, 3, 4.5]),
  ],
  // Four corners around a courtyard with entrances on all sides.
  [
    [31, 29, 14, 4],
    [31, 33, 4, 12],
    [56, 29, 14, 4],
    [66, 33, 4, 12],
    [31, 57, 4, 11],
    [31, 68, 14, 4],
    [66, 57, 4, 11],
    [56, 68, 14, 4],
  ],
  // Offset opposing baffles form two ways around a long central ridge.
  [
    [46, 20, 6, 59],
    [23, 20, 23, 5],
    [52, 74, 26, 5],
    [22, 53, 13, 4],
    [67, 43, 14, 4],
  ],
  // Three islands leave a broad outer loop and a three-way junction.
  [
    [43, 22, 14, 10],
    [19, 58, 17, 11],
    [64, 58, 17, 11],
    [47, 76, 7, 7],
  ],
];
// Three masonry arcs leave openings at the left, right and bottom. The
// southeast enclosure is the same footprint rotated around the map centre.
const ringArcs = [
  [210, 330],
  [30, 60],
  [120, 150],
];
const twinRingWall = [false, true].flatMap((mirrored) =>
  ringArcs.flatMap(([start, end], arc) =>
    Array.from({ length: (end - start) / 10 + 1 }, (_, index) => {
      const angle = ((start + index * 10) * Math.PI) / 180;
      const x = 15 + 9 * Math.cos(angle);
      const y = 19 + 14 * Math.sin(angle);
      return {
        id: `twin-ring-wall-${Number(mirrored)}-${arc}-${index}`,
        x: (mirrored ? 100 - x : x) - 1.7,
        y: (mirrored ? 100 - y : y) - 2.4,
        width: 3.4,
        height: 4.8,
      };
    }),
  ),
);
function createWalls(layoutId = 0, expanded = false, offsets, pattern) {
  const selected = layouts[layoutId] || layouts[0],
    groups = selected.groups;
  // Overlapping masonry sections make a solid X while retaining the same geometry
  // for artwork, collision, shot blocking and routes.
  const xSections = [];
  const roomy = layoutId > 0,
    armSteps = roomy ? 3 : 2;
  for (let i = -armSteps; i <= armSteps; i++)
    for (const slope of [-1, 1]) {
      if (i === 0 && slope === 1) continue;
      xSections.push(
        Object.freeze({
          id: `wall-x-${i}-${slope}`,
          x: selected.x - (roomy ? 3.5 : 3.25) + i * (roomy ? 6 : 5.5),
          y: selected.y - (roomy ? 2.25 : 2) + i * (roomy ? 4.5 : 3.5) * slope,
          width: roomy ? 7 : 6.5,
          height: roomy ? 4.5 : 4,
        }),
      );
    }
  const core = [
    ...groups.flatMap(([x, y, count, axis], g) =>
      Array.from({ length: count }, (_, i) =>
        Object.freeze({
          id: `wall-${g}-${i}`,
          x: x + (axis === 'h' ? i * 6 : 0),
          y: y + (axis === 'v' ? i * 6 : 0),
          width: axis === 'h' ? 6 : 4,
          height: axis === 'v' ? 6 : 4,
        }),
      ),
    ),
    ...xSections,
  ];
  const patternWalls = mapPatterns[pattern]?.map(([x, y, width, height], index) => ({
    id: 'map-wall-' + index,
    x,
    y,
    width,
    height,
  }));
  const arrangement = pattern === 1 ? [...patternWalls, ...xSections] : patternWalls || core;
  const covers = Object.freeze(
    expanded
      ? appendWingGeometry(arrangement, 'wall', offsets, pattern)
      : [...shiftArenaCore(arrangement, offsets), ...(pattern === 0 ? twinRingWall : [])],
  );
  const margin = expanded ? 1 : 2;
  const boxes = covers.map((b) => ({
    x: b.x - margin,
    y: b.y - margin,
    width: b.width + margin * 2,
    height: b.height + margin * 2,
  }));
  function inside(p, b) {
    return p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height;
  }
  function safePoint(p) {
    p = expanded
      ? boundary(p)
      : {
          x: p.x >= 0 && p.x < 100 ? p.x : ((p.x % 100) + 100) % 100,
          y: p.y >= 0 && p.y < 100 ? p.y : ((p.y % 100) + 100) % 100,
        };
    if (!boxes.some((b) => inside(p, b))) return p;
    // Project to the boundary of the entire wall union. Repeated local pushes can
    // oscillate between overlapping diagonal sections at an X junction.
    const xs = [p.x, ...new Set(boxes.flatMap((b) => [b.x - 0.02, b.x + b.width + 0.02]))];
    const ys = [p.y, ...new Set(boxes.flatMap((b) => [b.y - 0.02, b.y + b.height + 0.02]))];
    let nearest = null,
      distance = Infinity;
    for (const x of xs)
      for (const y of ys) {
        const d = (x - p.x) ** 2 + (y - p.y) ** 2;
        if (d >= distance || x < 0 || x >= 100 || y < 0 || y >= 100) continue;
        const candidate = { x, y };
        if (boxes.some((b) => inside(candidate, b))) continue;
        nearest = candidate;
        distance = d;
      }
    return nearest || p;
  }
  function entry(a, z, b) {
    let lo = 0,
      hi = 1;
    for (const [axis, size] of [
      ['x', 'width'],
      ['y', 'height'],
    ]) {
      const d = z[axis] - a[axis];
      if (Math.abs(d) < 1e-10) {
        if (a[axis] <= b[axis] || a[axis] >= b[axis] + b[size]) return null;
      } else {
        const t = (b[axis] - a[axis]) / d,
          u = (b[axis] + b[size] - a[axis]) / d;
        lo = Math.max(lo, Math.min(t, u));
        hi = Math.min(hi, Math.max(t, u));
        if (lo >= hi) return null;
      }
    }
    return hi > 0 && lo < 1 ? Math.max(0, lo) : null;
  }
  function clip(from, to) {
    if (expanded) to = boundary(to);
    let t = 1;
    for (const b of boxes) {
      const at = entry(from, to, b);
      if (at !== null) t = Math.min(t, Math.max(0, at - 0.0001));
    }
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  }
  function clear(a, b) {
    return boxes.every((box) => entry(a, b, box) === null);
  }
  const corners = boxes
    .flatMap((b) => [
      { x: b.x - 0.05, y: b.y - 0.05 },
      { x: b.x + b.width + 0.05, y: b.y - 0.05 },
      { x: b.x - 0.05, y: b.y + b.height + 0.05 },
      { x: b.x + b.width + 0.05, y: b.y + b.height + 0.05 },
    ])
    .filter((p) => !boxes.some((b) => inside(p, b)));
  function route(from, to) {
    to = safePoint(to);
    if (clear(from, to)) return [to];
    const nodes = [from, to, ...corners],
      distance = nodes.map(() => Infinity),
      prev = [],
      done = new Set();
    distance[0] = 0;
    for (let n = 0; n < nodes.length; n++) {
      let i = -1;
      for (let j = 0; j < nodes.length; j++)
        if (!done.has(j) && (i < 0 || distance[j] < distance[i])) i = j;
      if (i < 0 || !Number.isFinite(distance[i])) break;
      if (i === 1) {
        const result = [];
        for (let k = 1; k !== 0; k = prev[k]) result.unshift(nodes[k]);
        return result;
      }
      done.add(i);
      for (let j = 0; j < nodes.length; j++)
        if (!done.has(j) && clear(nodes[i], nodes[j])) {
          const d =
            distance[i] +
            Math.hypot((nodes[i].x - nodes[j].x) / 12, (nodes[i].y - nodes[j].y) / 16);
          if (d < distance[j]) {
            distance[j] = d;
            prev[j] = i;
          }
        }
    }
    return [clip(from, to)];
  }
  return { covers, boxes, safePoint, clip, route, clear, layoutId };
}
module.exports = { ...createWalls(), createWalls, layoutCount: layouts.length };
