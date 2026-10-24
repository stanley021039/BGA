const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
const source = fs
  .readFileSync(path.join(__dirname, '../src/services/attack-artwork.js'), 'utf8')
  .replace(/^import .*motion-lifetime.js';\n/m, '')
  .replace(/^import combatRules .*scene-rules.json';\n/m, '')
  .replace('export function playAttackArtwork', 'function playAttackArtwork');
const lifetime = fs
  .readFileSync(path.join(__dirname, '../src/services/motion-lifetime.js'), 'utf8')
  .replace(/export /g, '');
function run(effect, color, frames = 7, random = Math.random, options = {}) {
  const colors = [],
    arcs = [],
    lines = [],
    transforms = [],
    texts = [],
    positions = [];
  let callback;
  const gradient = {
    addColorStop(_p, c) {
      colors.push(c);
    },
  };
  const context = new Proxy(
    {
      setTransform() {},
      translate(x, y) {
        transforms.push({ x, y });
      },
      clearRect() {},
      fillText(text, x, y) {
        positions.push({ x, y });
        texts.push(text);
      },
      createRadialGradient() {
        return gradient;
      },
      createLinearGradient() {
        return gradient;
      },
      arc(x, y, r) {
        arcs.push({ x, y, r });
      },
      lineTo(x, y) {
        lines.push({ x, y });
      },
    },
    {
      get(t, k) {
        return k in t ? t[k] : () => {};
      },
      set(t, k, v) {
        if (['strokeStyle', 'fillStyle', 'shadowColor'].includes(k) && typeof v === 'string')
          colors.push(v);
        t[k] = v;
        return true;
      },
    },
  );
  const sandbox = {
    combatRules: require('../../public/shared/scene-rules.json'),
    document: { hidden: false },
    performance: { now: () => 0 },
    requestAnimationFrame(fn) {
      callback = fn;
      return 1;
    },
    cancelAnimationFrame() {
      callback = null;
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    Math: Object.assign(Object.create(Math), { random }),
    Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(lifetime + source, sandbox);
  const stop = sandbox.playAttackArtwork(
    { getContext: () => context },
    {
      effect,
      color,
      width: 800,
      height: 600,
      from: { x: 120, y: 240 },
      to: { x: 640, y: 380 },
      ...options,
    },
  );
  for (let i = 1; i <= frames; i++) callback?.(i * 17);
  stop();
  assert.equal(callback, null);
  return { colors, arcs, lines, transforms, texts, positions };
}
test('rainbow barrage paints multiple distinct authored shot colours', () => {
  const r = run('barrage', '#00f0ff');
  for (const c of ['#00f0ff', '#ff2a5f', '#ffea00', '#a855f7', '#10b981', '#ff007f', '#ff8800'])
    assert.ok(r.colors.includes(c), c);
});
test('red and blue obsidian crescents paint independent palettes', () => {
  for (const [id, color, other] of [
    ['blade_aura', '#00d0ff', '#ff0f3f'],
    ['blade_aura_crimson', '#ff0f3f', '#00d0ff'],
  ]) {
    const r = run(id, color);
    assert.ok(r.colors.includes(color));
    assert.ok(!r.colors.includes(other));
    assert.ok(r.colors.some((c) => c === '#090003' || c === '#000714'));
  }
});
test('shield geometry stays on the caster and the beam paints a visible cross', () => {
  const r = run('shield', '#00f0ff');
  assert.ok(r.transforms.some((a) => a.x === 120 && a.y === 240));
  assert.ok(!r.transforms.some((a) => a.x === 640 && a.y === 380));
  const beam = run('beam', '#7df4ff');
  assert.ok(beam.lines.some((p) => p.x === 25 && p.y === 0));
  assert.ok(beam.lines.some((p) => p.x === 0 && p.y === 38));
});

test('offensive effects show damage automatically, defensive effects do not', () => {
  assert.ok(run('beam', '#7df4ff').texts.some((t) => /\d/.test(t)));
  assert.equal(run('shield', '#00f0ff').texts.length, 0);
  assert.equal(run('sphere', '#10b981').texts.length, 0);
});
test('ice spikes grow upwards and the fire vortex rises into a column', () => {
  assert.ok(run('frost_spikes', '#7df4ff', 18).lines.some((p) => p.y < -100));
  assert.ok(run('flame_vortex', '#ff3366', 24).lines.some((p) => p.y < -150));
});

test('damage values and popup locations vary within a bounded range', () => {
  const low = run('beam', '#7df4ff', 7, () => 0),
    high = run('beam', '#7df4ff', 7, () => 0.999);
  const value = (r) => Number(r.texts[0].replace(/[^0-9]/g, ''));
  assert.ok(value(low) >= 270000);
  assert.ok(value(high) <= 330000);
  assert.notEqual(value(low), value(high));
  assert.notDeepEqual(low.positions[0], high.positions[0]);
});

test('live combat uses authoritative damage and critical status instead of preview random numbers', () => {
  const normal = run('beam', '#7df4ff', 7, () => 0, { damage: 2000, critical: false });
  assert.deepEqual([...new Set(normal.texts)], ['2,000']);
  const critical = run('beam', '#7df4ff', 7, () => 0.9, { damage: 3000, critical: true });
  assert.deepEqual([...new Set(critical.texts)], ['CRITICAL 3,000!']);
});
