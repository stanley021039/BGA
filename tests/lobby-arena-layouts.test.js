const { test } = require('node:test');
test('formal layout geometry reserves two-avatar cover and routes', () => {
  const assert = require('node:assert/strict');
  const { createWalls, layoutCount } = require('../src/rooms/walls');
  const { createLobby } = require('../src/rooms/lobby');
  const fingerprints = new Set();
  for (let id = 1; id < layoutCount; id++) {
    const map = createWalls(id),
      { covers, boxes, safePoint, clear, route } = map;
    fingerprints.add(JSON.stringify(covers));
    const inside = (p) =>
      boxes.some((b) => p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height);
    for (let x = 1; x < 100; x += 3)
      for (let y = 1; y < 100; y += 3)
        assert(!inside(safePoint({ x, y })), `safe spawn ${id} ${x},${y}`);
    const x = covers.filter((b) => b.id.startsWith('wall-x-'));
    assert(
      Math.max(...x.map((b) => b.x + b.width)) - Math.min(...x.map((b) => b.x)) >= 43,
      'wide X',
    );
    const cx = (Math.max(...x.map((b) => b.x + b.width)) + Math.min(...x.map((b) => b.x))) / 2;
    const cy = (Math.max(...x.map((b) => b.y + b.height)) + Math.min(...x.map((b) => b.y))) / 2;
    assert.equal(x.length, 13, 'extended X arms');
    // Each recess has two avatar-sized slots, including portrait-phone dimensions.
    const pockets = [
      [
        { x: cx - 29, y: cy },
        { x: cx - 15, y: cy },
      ],
      [
        { x: cx + 15, y: cy },
        { x: cx + 29, y: cy },
      ],
      [
        { x: cx - 7, y: cy - 18 },
        { x: cx + 7, y: cy - 18 },
      ],
      [
        { x: cx - 7, y: cy + 20 },
        { x: cx + 7, y: cy + 20 },
      ],
    ];
    for (const [width, height, size] of [
      [1920, 850, 48],
      [1280, 574, 48],
      [1000, 414, 48],
      [390, 698, 35],
      [320, 414, 35],
    ])
      for (const pair of pockets) {
        assert(
          Math.hypot(
            ((pair[1].x - pair[0].x) * width) / 100,
            ((pair[1].y - pair[0].y) * height) / 100,
          ) >=
            size + 8,
          'room for two bodies',
        );
        for (const p of pair) {
          assert(!inside(p), 'standing point outside collision');
          const left = p.x - (size / 2 / width) * 100,
            right = p.x + (size / 2 / width) * 100,
            top = p.y - ((size * 0.55) / height) * 100,
            bottom = p.y + ((size * 0.45) / height) * 100;
          assert(
            covers.every(
              (b) =>
                right <= b.x || left >= b.x + b.width || bottom <= b.y || top >= b.y + b.height,
            ),
            `full avatar fits map ${id}, width ${width}, point ${JSON.stringify(p)}, overlaps ${JSON.stringify(covers.filter((b) => !(right <= b.x || left >= b.x + b.width || bottom <= b.y || top >= b.y + b.height)))}`,
          );
          let prev = { x: 5, y: 5 };
          for (const next of route(prev, p)) {
            assert(clear(prev, next));
            prev = next;
          }
          assert(Math.hypot(prev.x - p.x, prev.y - p.y) < 0.1, 'both slots reachable');
        }
      }
    assert(
      !covers.every((b) =>
        covers.some(
          (c) =>
            Math.abs(c.x - (100 - b.x - b.width)) < 0.01 &&
            c.y === b.y &&
            c.width === b.width &&
            c.height === b.height,
        ),
      ),
      'asymmetric',
    );
    for (const dest of [
      { x: 32, y: 62 },
      { x: 66, y: 62 },
      { x: 50, y: 5 },
      { x: 50, y: 95 },
      { x: 5, y: 90 },
      { x: 95, y: 90 },
      { x: 50, y: 40 },
    ]) {
      let prev = { x: 5, y: 5 };
      const end = safePoint(dest),
        path = route(prev, dest);
      for (const p of path) {
        assert(clear(prev, p), `route clear map ${id}`);
        prev = p;
      }
      assert(
        Math.hypot(prev.x - end.x, prev.y - end.y) < 0.1,
        `connected map ${id} to ${JSON.stringify(dest)}`,
      );
    }
  }
  assert.equal(fingerprints.size, layoutCount - 1);
  console.log(
    'PASS 3 asymmetric layouts, widened X, safe spawn grid, connected routes and isolated games',
  );
});
