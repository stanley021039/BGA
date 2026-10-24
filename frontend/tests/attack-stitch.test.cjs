const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs
  .readFileSync(require('node:path').join(__dirname, '../src/services/attack-stitch.js'), 'utf8')
  .replace('export function createStitchAttack', 'function createStitchAttack');
function fixture(effect, dimensions = {}) {
  const calls = [];
  let impacts = 0;
  const ctx = new Proxy(
    {},
    {
      get(_target, name) {
        if (name === 'createLinearGradient') return () => ({ addColorStop() {} });
        return (...args) => {
          for (const arg of args)
            if (typeof arg === 'number') assert.ok(Number.isFinite(arg), name);
          if (name === 'arc') assert.ok(args[2] >= 0, 'non-negative radius');
          if (name === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0, 'non-negative ellipse');
          calls.push({ name, args });
        };
      },
      set() {
        return true;
      },
    },
  );
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const draw = sandbox.createStitchAttack(
    ctx,
    {
      effect,
      width: 800,
      height: 600,
      from: { x: 120, y: 240 },
      to: { x: 640, y: 380 },
      ...dimensions,
    },
    () => impacts++,
  );
  return { draw, calls, impacts: () => impacts, reset: () => calls.splice(0) };
}
test('Rho Aias keeps seven layered petal shields on the caster and never inflicts damage', () => {
  const f = fixture('sphere');
  f.draw(500);
  assert.ok(f.calls.some((c) => c.name === 'translate' && c.args[0] === 120 && c.args[1] === 240));
  assert.equal(f.calls.filter((c) => c.name === 'quadraticCurveTo').length, 42);
  f.draw(1500);
  assert.equal(f.impacts(), 0);
});
test('eight physical chains converge around the target from all sides and hit once', () => {
  const f = fixture('chains');
  f.draw(900);
  const links = f.calls.filter((c) => c.name === 'translate');
  assert.ok(links.some((c) => c.args[0] < 600));
  assert.ok(links.some((c) => c.args[0] > 680));
  assert.ok(links.some((c) => c.args[1] < 340));
  assert.ok(links.some((c) => c.args[1] > 420));
  assert.ok(links.length <= 8 * 24);
  f.draw(1200);
  assert.equal(f.impacts(), 1);
});
test('DRAGOON pods travel and charge before crossfire, then return without repeat damage', () => {
  const f = fixture('funnel');
  for (const t of [0, 400, 1000, 1299]) f.draw(t);
  assert.equal(f.impacts(), 0);
  assert.ok(!f.calls.some((c) => c.name === 'lineTo' && c.args[0] === 640 && c.args[1] === 380));
  f.reset();
  f.draw(1400);
  assert.ok(f.calls.some((c) => c.name === 'lineTo' && c.args[0] === 640 && c.args[1] === 380));
  f.draw(1600);
  f.draw(2200);
  assert.equal(f.impacts(), 1);
  f.reset();
  f.draw(3000);
  assert.equal(f.calls.length, 0);
});
test('ice crystals emerge in staggered sizes and mushroom cap follows the casting circle', () => {
  const ice = fixture('frost_spikes');
  ice.draw(80);
  assert.equal(ice.calls.filter((c) => c.name === 'rotate').length, 1);
  ice.reset();
  ice.draw(1000);
  assert.equal(ice.calls.filter((c) => c.name === 'rotate').length, 5);
  const cloud = fixture('explosion');
  cloud.draw(200);
  assert.equal(cloud.impacts(), 0);
  cloud.reset();
  cloud.draw(1200);
  assert.ok(cloud.calls.filter((c) => c.name === 'arc').length >= 10);
  assert.equal(cloud.impacts(), 1);
});
test('the burning boot continues past the target after impact', () => {
  const f = fixture('flame_kick');
  f.draw(300);
  assert.equal(f.impacts(), 0);
  f.reset();
  f.draw(1500);
  assert.ok(f.calls.some((c) => c.name === 'translate' && c.args[0] > 640));
  assert.ok(f.calls.some((c) => c.name === 'bezierCurveTo'));
  f.draw(1700);
  assert.equal(f.impacts(), 1);
});

test('the boot remains fully visible after passing a target near a small preview edge', () => {
  const f = fixture('flame_kick', {
    width: 340,
    height: 180,
    from: { x: 60, y: 90 },
    to: { x: 265, y: 90 },
  });
  f.draw(1600);
  const boot = f.calls.find((c) => c.name === 'translate');
  assert.ok(boot.args[0] > 265);
  assert.ok(boot.args[0] + 28 < 340);
});
test('all adapted effects render finite geometry throughout desktop and small preview lifetimes', () => {
  for (const effect of ['chains', 'sphere', 'funnel', 'explosion', 'frost_spikes', 'flame_kick']) {
    for (const [width, height] of [
      [1920, 1080],
      [340, 180],
    ]) {
      const f = fixture(effect, {
        width,
        height,
        from: { x: width * 0.2, y: height * 0.5 },
        to: { x: width * 0.7, y: height * 0.6 },
      });
      for (let t = 0; t <= 2800; t += 17) {
        f.reset();
        f.draw(t);
        assert.ok(f.calls.length < 5000);
      }
      assert.equal(f.impacts(), effect === 'sphere' ? 0 : 1);
    }
  }
});
