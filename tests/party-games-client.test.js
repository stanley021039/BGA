'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
test('geometry conversion produces genuine circles and simple lines without colour or freehand extensions', () => {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(require.resolve('../public/shared/party-shapes.js'), 'utf8'),
    context,
  );
  const result = context.window.PartyShapes.toStrokes([
    { kind: 'circle', cx: 100, cy: 100, r: 20 },
    { kind: 'line', x1: 5, y1: 10, x2: 15, y2: 20 },
  ]);
  assert.equal(result[0].tool, 'ellipse');
  assert.equal(
    result[0].points[1][0] - result[0].points[0][0],
    result[0].points[1][1] - result[0].points[0][1],
  );
  assert.equal(result[1].tool, 'line');
  assert.equal(result[0].color, '#222222');
});
