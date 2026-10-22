const test = require('node:test');
const assert = require('node:assert/strict');
const directions = require('../public/shared/race-directions');
const { neighbor } = require('../src/games/thunder');
const { appFixture } = require('./helpers/app-fixture.cjs');
const fs = require('node:fs');
const path = require('node:path');
test('six screen direction faces match authoritative hex displacements, including backward left', () => {
  const project = (x, y) => [48 + y * 44 + (x % 2) * 22, 81 + x * 44];
  for (const x of [2, 3])
    for (let i = 0; i < 6; i++) {
      const p = project(x, 8),
        n = neighbor(x, 8, i),
        q = project(n.x, n.y),
        face = directions.byIndex(i);
      assert.deepEqual([face.dx, face.dy], [q[0] - p[0], q[1] - p[1]]);
      assert.equal(directions.get(face.value), face);
      assert.ok(Object.isFrozen(face));
    }
  assert.equal(directions.get('後方').arrow, '←');
  assert.equal(directions.get('後方').label, '左');
  assert.equal(directions.get('前方').arrow, '→');
  for (const value of [0, 1, 6, null, {}, '__proto__', 'not-a-direction']) {
    assert.equal(directions.get(value), null);
    assert.equal(directions.markup(value), '');
  }
  for (const index of [-1, 6, '4', null, 1.5]) assert.equal(directions.byIndex(index), null);
  assert.match(
    directions.resultText('原位車向後方', ['原位車', '後方']),
    /畫面方向：← 向左（後方）/,
  );
  assert.equal(directions.resultText('命中', ['L']), '命中');
});
test('direction presentation asset is served exactly and loaded before both dice renderers', async (t) => {
  const { base } = await appFixture(t);
  const response = await fetch(base + '/shared/race-directions.js');
  assert.equal(response.status, 200);
  assert.equal(
    await response.text(),
    fs.readFileSync(path.join(__dirname, '../public/shared/race-directions.js'), 'utf8'),
  );
  for (const file of ['../public/race.html', '../frontend/pages/race/index.html']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const position = source.indexOf('/shared/race-directions.js');
    assert.ok(position >= 0);
    assert.ok(position < source.indexOf('/shared/race-dice-webgl.js'));
    assert.ok(position < source.indexOf('/shared/race-dice-dialog.js'));
  }
});
