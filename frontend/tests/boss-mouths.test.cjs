const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ghidorahMouthOpenings } = require('../src/services/boss-mouths.js');
const { ghidorahMouthsFor } = require('../src/services/boss-mouths.js');
test('each evolved body has its own aligned jaw anchors and valid bounded crop paths', () => {
  assert.notDeepEqual(ghidorahMouthsFor(1), ghidorahMouthsFor(2));
  assert.notDeepEqual(ghidorahMouthsFor(2), ghidorahMouthsFor(3));
  for (const phase of [1, 2, 3]) {
    const mouths = ghidorahMouthsFor(phase);
    assert.equal(mouths.length, 3);
    assert.ok(mouths[0].x < mouths[1].x && mouths[1].x < mouths[2].x);
    for (const mouth of mouths) {
      assert.ok(mouth.x > 0 && mouth.x < 256 && mouth.y > 0 && mouth.y < 256);
      assert.ok(!/NaN|Infinity/.test(mouth.jaw));
    }
  }
});
const { bossStageSpec, bossAttackPlan } = require('../src/engines/boss-geometry.js');
const abilities = require('../../public/shared/boss-abilities.json');

test('beam jaws follow each authoritative head wave, close after release and reject stale clocks', () => {
  for (const phase of [1, 2, 3]) {
    for (const slot of ['q', 'r']) {
      const spec = bossStageSpec(
        abilities.find((a) => a.id === 'boss_ghidorah_turtle_' + slot),
        phase,
      );
      const plan = bossAttackPlan(spec, { x: 20, y: 65 }, { x: 55, y: 65 });
      const strikes = plan.map((s) => ({
        at: s.at,
        heads: s.spec.head !== undefined ? [s.spec.head] : s.zones.length >= 3 ? [0, 1, 2] : [1],
      }));
      for (const strike of strikes) {
        const open = ghidorahMouthOpenings(strikes, strike.at, spec.windup);
        for (const head of strike.heads) assert.equal(open[head], 1, `${phase}/${slot}/${head}`);
      }
      for (const age of [-1, NaN, Infinity, 4201])
        assert.deepEqual(ghidorahMouthOpenings(strikes, age, spec.windup), [0, 0, 0]);
      assert.deepEqual(
        ghidorahMouthOpenings(strikes, Math.min(4200, plan.at(-1).at + 551), spec.windup),
        [0, 0, 0],
      );
    }
  }
});

test('individual head charging stays bounded and does not animate unrelated heads', () => {
  const strikes = [
    { at: 1000, heads: [0] },
    { at: 2500, heads: [2] },
  ];
  const charging = ghidorahMouthOpenings(strikes, 600, 1000);
  assert.ok(charging[0] > 0 && charging[0] < 1);
  assert.deepEqual(charging.slice(1), [0, 0]);
  assert.deepEqual(ghidorahMouthOpenings(strikes, 1600, 1000), [0, 0, 0]);
  assert.deepEqual(ghidorahMouthOpenings([], 1000, 1000), [0, 0, 0]);
});
