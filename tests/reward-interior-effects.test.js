const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
const { rewards } = require('../src/achievements/rewards');
test('every achievement frame has its own bounded interior motif and motion, shared by decorated players', () => {
  const css = fs.readFileSync('public/shared/barrage-frames.css', 'utf8');
  const motions = new Set();
  for (const reward of rewards) {
    const block = css.match(
      new RegExp(
        "\\[data-frame-id='" + reward.frameId + "'\\]\\s*\\{\\s*--reward-pattern:\\s*([^}]+)\\}",
      ),
    );
    assert.ok(block, reward.frameId + ' has an interior motif');
    const animation =
      block[1].match(/--reward-inner-motion:\s*([\w-]+)/)?.[1] || 'reward-ambient-drift';
    assert.match(css, new RegExp('@keyframes ' + animation + '\\s*\\{'));
    assert.equal(
      motions.has(animation),
      false,
      reward.frameId + ' does not reuse another reward motion',
    );
    motions.add(animation);
  }
  assert.equal(motions.size, 24);
  assert.match(css, /\.reward-art \.reward-surface\s*\{\s*overflow: hidden;/);
  assert.match(css, /html\.motion-reduced \.reward-surface::before/);
  assert.match(css, /\.game-barrage-static \.reward-surface::before/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.reward-surface::before/);
});
