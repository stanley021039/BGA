const { test } = require('node:test'),
  assert = require('node:assert/strict');
const {
  sceneCorrection,
  reconcileScenePosition,
  createSceneSnapshotClock,
} = require('../src/services/scene-reconciliation.js');
test('ordinary jitter begins at the rendered position, converges in 160ms, and keeps world wrapping continuous', () => {
  const correction = sceneCorrection({ x: 40, y: 60 }, { x: 38, y: 60 }, true);
  assert.equal(reconcileScenePosition({ x: 38, y: 60 }, correction, 0).x, 40);
  assert.equal(reconcileScenePosition({ x: 39, y: 60 }, correction, 80).x, 40);
  assert.equal(reconcileScenePosition({ x: 40, y: 60 }, correction, 160).x, 40);
  assert.equal(sceneCorrection({ x: 98, y: 50 }, { x: 2, y: 50 }, true).x, -4);
  assert.equal(sceneCorrection({ x: 10, y: 50 }, { x: 40, y: 50 }, true), null);
  assert.equal(
    sceneCorrection({ x: 40, y: 50 }, { x: 40, y: 50 }, true),
    null,
    'idle snapshots never request correction frames',
  );
  assert.equal(
    sceneCorrection({ x: 40, y: 50 }, { x: 41, y: 50 }, false),
    null,
    'teleports/deaths/resets bypass smoothing',
  );
});
test('snapshot clock estimates transport age from RTT, ignores jittery samples and bounds late packets', () => {
  const clock = createSceneSnapshotClock();
  assert.equal(clock.age(1000, 100), 0);
  clock.sample(10000, 0, 100);
  assert.equal(clock.age(10000, 100), 50);
  clock.sample(10100, 100, 500);
  assert.equal(clock.age(10100, 500), 350);
  assert.equal(clock.age(9000, 500), 500);
  assert.equal(clock.age(20000, 500), 0);
  clock.sample(11000, 1000, 1020);
  assert.equal(clock.age(11000, 1020), 10);
  clock.sample(NaN, 0, 1);
  assert.equal(clock.age(11000, 1020), 10);
  clock.reset();
  assert.equal(clock.age(11000, 1020), 0);
});
