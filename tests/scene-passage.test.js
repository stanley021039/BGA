const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sceneWalk, passageTarget, validPassage } = require('../frontend/src/engines/scene-path.js');
const { createRoomSpace } = require('../src/rooms/space');
const box = { left: 30, right: 70, top: 25, bottom: 75 };

test('central passage skips only the covered segment in all four directions, without slowing free-floor walking', () => {
  for (const [from, to, before, after, ms] of [
    [{ x: 20, y: 50 }, { x: 80, y: 50 }, 'x', 70, 1000],
    [{ x: 80, y: 50 }, { x: 20, y: 50 }, 'x', 30, 1000],
    [{ x: 50, y: 10 }, { x: 50, y: 90 }, 'y', 75, 1000],
    [{ x: 50, y: 90 }, { x: 50, y: 10 }, 'y', 25, 1000],
  ]) {
    const start = sceneWalk(from, to, 100, box);
    assert.equal(start.crossed, false);
    const crossed = sceneWalk(from, to, ms, box);
    assert.equal(crossed.crossed, true);
    assert.ok(from[before] < to[before] ? crossed[before] >= after : crossed[before] <= after);
    assert.deepEqual(
      { ...sceneWalk(from, to, 10000, box), crossed: false },
      { ...to, remainingMs: 0, crossed: false },
    );
  }
  assert.equal(sceneWalk({ x: 20, y: 20 }, { x: 80, y: 20 }, 1000, box).x, 32);
  assert.equal(sceneWalk({ x: 40, y: 50 }, { x: 40, y: 50 }, 500, box).crossed, false);
});

test('diagonal and inside destinations exit in the movement direction; edge gliding does not jump', () => {
  const from = { x: 20, y: 50 };
  assert.deepEqual(passageTarget(from, { x: 32, y: 50 }, box), { x: 70, y: 50 });
  const diagonal = passageTarget({ x: 20, y: 10 }, { x: 40, y: 40 }, box);
  assert.equal(diagonal.bottom, undefined);
  assert.ok(diagonal.x === box.right || diagonal.y === box.bottom);
  assert.equal(sceneWalk({ x: 20, y: 25 }, { x: 80, y: 25 }, 1000, box).crossed, false);
  for (const invalid of [
    { ...box, right: NaN },
    { ...box, top: -1 },
    { ...box, extra: 1 },
    { ...box, left: 80 },
  ])
    assert.equal(validPassage(invalid), false);
});

test('fractional DOM boundary cannot strand a finished walk at the entry edge', () => {
  const fractional = { left: 12.974683544303797, right: 85.33755274261603, top: 2, bottom: 98 };
  const from = { x: fractional.left - 1, y: 50 };
  const target = passageTarget(from, { x: from.x + 5, y: 50 }, fractional);
  const result = sceneWalk(from, target, 550, fractional);
  assert.equal(result.x, fractional.right);
  assert.equal(result.remainingMs, 0);
  assert.equal(result.crossed, true);
  assert.equal(sceneWalk(target, target, 550, fractional).crossed, false);
});

test('room state and interpolation share the portal, preserve four-edge wrap, validate input and never modify gameplay', () => {
  let now = 0;
  const space = createRoomSpace(
    () => now,
    () => 0.5,
  );
  const room = { phase: 'brewing', version: 5, players: [{ id: 'a', name: 'A' }] };
  space.view(room, 'a');
  space.move(room, 'a', { x: 28, y: 50 });
  now += 10000;
  let own = space.view(room, 'a').visitors[0];
  space.move(room, 'a', { action: 'step', dx: 1, dy: 0, passage: box });
  now += 300;
  own = space.view(room, 'a').visitors[0];
  assert.equal(own.x, 70);
  assert.equal(own.wrapId, 1);
  assert.equal(own.passage.right, 70);
  assert.equal(room.version, 5);
  assert.equal(room.phase, 'brewing');
  space.move(room, 'a', { x: 99, y: 10, passage: null });
  now += 10000;
  space.view(room, 'a');
  space.move(room, 'a', { action: 'step', dx: 1, dy: 0 });
  now += 1000;
  assert.equal(space.view(room, 'a').visitors[0].x, 4);
  assert.throws(
    () => space.move(room, 'a', { action: 'step', dx: 1, dy: 0, passage: { ...box, right: 101 } }),
    { code: 'INVALID_MOVEMENT' },
  );
});
