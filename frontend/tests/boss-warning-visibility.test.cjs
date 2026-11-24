const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bossWarningOpacity } = require('../src/services/boss-warning-visibility.js');
const { bossStageSpec, bossAttackPlan } = require('../src/engines/boss-geometry.js');
const abilities = require('../../public/shared/boss-abilities.json');

test('all boss floor cues preserve 550ms ordinary notice, shorten ultimate notice and vanish 120ms after each wave', () => {
  for (const phase of [1, 2, 3])
    for (const ability of abilities) {
      const spec = bossStageSpec(ability, phase),
        rate = [1, 1.15, 1.3][phase - 1];
      const plan = bossAttackPlan(spec, { x: 20, y: 65 }, { x: 55, y: 65 });
      const original = JSON.stringify(plan);
      for (const strike of plan) {
        const notice = spec.slot === 'r' ? 850 : 550;
        assert.equal(
          bossWarningOpacity(
            spec.slot,
            spec.windup,
            strike.at,
            strike.at - notice * rate - 1,
            rate,
          ),
          0,
        );
        assert.ok(
          bossWarningOpacity(spec.slot, spec.windup, strike.at, strike.at - notice * rate, rate) >
            0,
        );
        assert.ok(bossWarningOpacity(spec.slot, spec.windup, strike.at, strike.at, rate) <= 0.18);
        const tail = bossWarningOpacity(
          spec.slot,
          spec.windup,
          strike.at,
          strike.at + 60 * rate,
          rate,
        );
        assert.ok(tail > 0 && tail < 0.1);
        assert.equal(
          bossWarningOpacity(spec.slot, spec.windup, strike.at, strike.at + 121 * rate, rate),
          0,
        );
      }
      assert.equal(
        JSON.stringify(plan),
        original,
        'presentation never edits locked hit geometry or damage',
      );
    }
});

test('invalid clocks never reveal a permanent floor cue', () => {
  for (const age of [NaN, Infinity, -Infinity])
    assert.equal(bossWarningOpacity('q', 700, 700, age), 0);
  assert.equal(bossWarningOpacity('q', 0, 700, 600), 0);
  assert.equal(bossWarningOpacity('q', 700, 700, 600, 0), 0);
});
