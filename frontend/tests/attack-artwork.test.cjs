const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('../../tests/helpers/browser-modules.cjs'),
  vm = require('node:vm'),
  path = require('node:path');
const source = fs
  .readFileSync(path.join(__dirname, '../src/services/attack-artwork.js'), 'utf8')
  .replace(/^import .*motion-lifetime.js';\n/m, '')
  .replace(/^import combatRules .*scene-rules.json';\n/m, '')
  .replace(/^import .*attack-stitch.js';\n/m, '')
  .replace(/^import .*attack-area.js';\n/m, '')
  .replace(/^import .*attack-revision.js';\n/m, '')
  .replace(/^import attackEffects .*attack-effects.json';\n/m, '')
  .replace(/^import attackTiming .*attack-timing.json';\n/m, '')
  .replace(/^export function /gm, 'function ');
const lifetime = fs
  .readFileSync(path.join(__dirname, '../src/services/motion-lifetime.js'), 'utf8')
  .toString();
function run(effect, color, frames = 7, random = Math.random, options = {}) {
  const colors = [],
    arcs = [],
    lines = [],
    transforms = [],
    texts = [],
    positions = [],
    rotations = [];
  let callback,
    clock = 0,
    nextTimer = 0;
  const timers = new Map();
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
      rotate(angle) {
        rotations.push(angle);
      },
      clearRect() {},
      fillText(text, x, y) {
        positions.push({ x, y });
        texts.push(text);
      },
      measureText() {
        return { width: 250 };
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
      moveTo(x, y) {
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
    attackTiming: require('../../public/shared/attack-timing.json'),
    combatRules: require('../../public/shared/scene-rules.json'),
    attackEffects: require('../../public/shared/attack-effects.json'),
    document: { hidden: false },
    performance: { now: () => 0 },
    requestAnimationFrame(fn) {
      callback = fn;
      return 1;
    },
    cancelAnimationFrame() {
      callback = null;
    },
    setTimeout(fn, delay) {
      const id = ++nextTimer;
      timers.set(id, { fn, at: clock + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    Math: Object.assign(Object.create(Math), { random }),
    Date,
  };
  vm.createContext(withEngineImports(sandbox));
  vm.runInContext(
    fs.fixtureSource(lifetime) +
      fs
        .readFileSync(path.join(__dirname, '../src/services/attack-revision.js'), 'utf8')
        .replace(/export function /g, 'function ') +
      fs
        .readFileSync(path.join(__dirname, '../src/services/attack-figures.js'), 'utf8')
        .replace(/export function /g, 'function ') +
      fs
        .readFileSync(path.join(__dirname, '../src/services/attack-area.js'), 'utf8')
        .replace(/^import .*attack-figures.js';\n/m, '')
        .replace(/^import .*attack-revision.js';\n/m, '')
        .replace('export function createAreaAttack', 'function createAreaAttack') +
      fs
        .readFileSync(path.join(__dirname, '../src/services/attack-stitch.js'), 'utf8')
        .replace('export function createStitchAttack', 'function createStitchAttack') +
      source,
    sandbox,
  );
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
  for (let i = 1; i <= frames; i++) {
    clock = i * 17;
    for (const [id, timer] of timers)
      if (timer.at <= clock) {
        timers.delete(id);
        timer.fn();
      }
    callback?.(clock);
  }
  stop();
  assert.equal(callback, null);
  assert.equal(timers.size, 0);
  return { colors, arcs, lines, transforms, texts, positions, rotations };
}
test('rainbow barrage paints multiple distinct authored shot colours', () => {
  const r = run('barrage', '#00f0ff');
  for (const c of ['#00f0ff', '#ff2a5f', '#ffea00', '#a855f7', '#10b981', '#ff007f', '#ff8800'])
    assert.ok(r.colors.includes(c), c);
});

test('every current offensive renderer waits for both authoritative settlement and its arrival clock', () => {
  const timing = require('../../public/shared/attack-timing.json');
  for (const effect of require('../../public/shared/attack-effects.json').filter(
    (e) => !['shield', 'sphere'].includes(e.id),
  )) {
    const [delayMs, , phase] = timing[effect.id][0];
    const hit = {
      toId: 'victim',
      x: 640,
      y: 380,
      damage: 111111,
      critical: false,
      delayMs,
      phase,
      pending: false,
    };
    const options = {
      damage: 0,
      hits: [{ ...hit, pending: true, damage: 0 }],
      readHits: () => [hit],
    };
    const before = run(effect.id, effect.color, Math.ceil(delayMs / 17) - 1, () => 0.5, options);
    assert.ok(!before.texts.some((t) => t.includes('111,111')), effect.id + ' early');
    const after = run(effect.id, effect.color, Math.ceil(delayMs / 17) + 2, () => 0.5, options);
    assert.ok(
      after.texts.some((t) => t.includes('111,111')),
      effect.id + ' arrived',
    );
    const pending = run(effect.id, effect.color, Math.ceil(delayMs / 17) + 2, () => 0.5, {
      ...options,
      readHits: () => [{ ...hit, pending: true }],
    });
    assert.ok(!pending.texts.some((t) => t.includes('111,111')), effect.id + ' pending');
  }
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

test('narrow shield previews keep all honeycomb vertices inside the canvas', () => {
  const result = run('shield', '#00f0ff', 80, () => 0.5, {
    width: 340,
    height: 180,
    from: { x: 60, y: 90 },
    to: { x: 265, y: 90 },
  });
  assert.ok(result.lines.length > 0);
  for (const point of result.lines) {
    assert.ok(point.x + 60 >= 0 && point.x + 60 <= 340);
    assert.ok(point.y + 90 >= 0 && point.y + 90 <= 180);
  }
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

test('six-figure critical text stays inside a narrow preview at the right edge', () => {
  const result = run('beam', '#7df4ff', 40, () => 0.999, {
    width: 340,
    height: 180,
    from: { x: 60, y: 90 },
    to: { x: 330, y: 90 },
  });
  assert.ok(result.positions.length > 0);
  for (const p of result.positions) {
    assert.ok(p.x >= 10 && p.x + 250 <= 330);
    assert.ok(p.y >= 28 && p.y <= 168);
  }
});

test('live combat uses authoritative damage and critical status instead of preview random numbers', () => {
  const normal = run('beam', '#7df4ff', 7, () => 0, { damage: 2000, critical: false });
  assert.deepEqual([...new Set(normal.texts)], ['2,000']);
  const critical = run('beam', '#7df4ff', 7, () => 0.9, { damage: 3000, critical: true });
  assert.deepEqual([...new Set(critical.texts)], ['CRITICAL 3,000!']);
});

test('orange-red arrows preserve visible broad heads, shafts and fletching', () => {
  const r = run('arrow_volley', '#ff5a24', 70, () => 0.5);
  for (const c of ['#ff5a24', '#7f1d1d', '#fff1dc']) assert.ok(r.colors.includes(c), c);
  assert.ok(
    r.lines.some((p) => p.x === 10 && p.y === 0),
    'broad arrowhead',
  );
  assert.ok(
    r.lines.some((p) => p.x === -43 && Math.abs(p.y) === 7),
    'split fletching',
  );
});

test('three small fire vortices orbit the primary without extra damage events', () => {
  const r = run('flame_vortex', '#ff3366', 85, () => 0.5, { damage: 123457, critical: false });
  assert.ok(new Set(r.transforms.filter((p) => p.y > 350).map((p) => Math.round(p.x))).size > 4);
  assert.equal(r.texts.filter((t) => String(t).includes('123,457')).length > 0, true);
});

test('one area cast renders each authoritative victim damage once instead of reusing primary damage', () => {
  const r = run('dimension_cleave', '#ff3366', 130, () => 0.5, {
    damage: 999999,
    critical: false,
    hits: [
      { x: 310, y: 200, damage: 111113, critical: false },
      { x: 410, y: 240, damage: 222227, critical: true },
      { x: 510, y: 280, damage: 333337, critical: false },
    ],
  });
  for (const amount of ['111,113', '222,227', '333,337'])
    assert.ok(
      r.texts.some((text) => String(text).includes(amount)),
      amount,
    );
  assert.ok(!r.texts.some((text) => String(text).includes('999,999')));
  assert.equal(new Set(r.texts.filter((t) => /\d[\d,]{2,}/.test(t))).size, 3);
});

test('Ea, Excalibur and the burst use only actual victims and damage across their full multi-phase animation', () => {
  for (const effect of ['gate_of_babylon', 'excalibur', 'explosion', 'giant_orange_cat']) {
    const r = run(effect, '#ffd556', 245, () => 0.5, {
      damage: 999999,
      critical: false,
      hits: [
        { x: 310, y: 200, damage: 111113, critical: false },
        { x: 410, y: 240, damage: 222227, critical: true },
      ],
    });
    assert.equal(new Set(r.texts.filter((t) => /\d[\d,]{2,}/.test(t))).size, 2, effect);
    for (const amount of ['111,113', '222,227'])
      assert.ok(
        r.texts.some((text) => String(text).includes(amount)),
        effect + ' ' + amount,
      );
    assert.ok(
      !r.texts.some((text) => /999,999|488,920|612,400|T[1234]|RADIUS|GUARD/.test(String(text))),
      effect,
    );
  }
});
test('staged previews show the first partial hit promptly and preserve the larger Ea finish', () => {
  const before = run('barrage', '#00f0ff', 26, () => 0.5, { preview: true });
  assert.equal(before.texts.length, 0);
  const after = run('barrage', '#00f0ff', 29, () => 0.5, { preview: true });
  assert.ok(after.texts.includes('70,000'));
  assert.ok(!after.texts.includes('200,000'));
  const gate = run('gate_of_babylon', '#ffd556', 245, () => 0.5, { preview: true });
  assert.ok(gate.texts.includes('100,000'));
  assert.ok(gate.texts.includes('800,000'));
});
test('pending or missed live stages never show preview damage even after their scheduled time', () => {
  const result = run('beam', '#7df4ff', 60, () => 0.5, {
    preview: true,
    readHits: () => [
      { toId: 'a', phase: 'impact', delayMs: 450, x: 640, y: 380, damage: 200000, pending: true },
      { toId: 'b', phase: 'impact', delayMs: 450, x: 640, y: 380, damage: 200000, missed: true },
    ],
  });
  assert.equal(result.texts.length, 0);
});
test('crescent flight catches up to its target before the 650ms hit even on a wide scene', () => {
  const result = run('blade_aura', '#00d0ff', 1, () => 0.5, {
    width: 3840,
    height: 1080,
    from: { x: 100, y: 300 },
    to: { x: 2000, y: 300 },
    ageMs: 600,
    readHits: () => [],
  });
  assert.ok(result.transforms.some((p) => p.x === 2000 && p.y === 285));
  assert.equal(result.texts.length, 0, 'catching up the visual cannot invent damage');
});
test('three explicit bijuu directions remain three beams even when many victims share the first ray', () => {
  const result = run('bijuu_beam', '#ffd556', 150, () => 0.5, {
    rays: [
      { x: 640, y: 380 },
      { x: 120, y: 20 },
      { x: 120, y: 580 },
    ],
    readHits: () =>
      Array.from({ length: 12 }, (_, i) => ({
        toId: String(i),
        x: 300 + i * 15,
        y: 300,
        pathX: 640,
        pathY: 380,
        phase: 'impact',
        delayMs: 2460,
        damage: 0,
        pending: true,
      })),
  });
  const root = Math.atan2(140, 520);
  for (const direction of [-Math.PI / 2 - root, Math.PI / 2 - root])
    assert.ok(result.rotations.some((angle) => Math.abs(angle - direction) < 1e-8));
});

// Shared lobby stage (#322): a context whose shadowBlur is a prototype accessor, like the real one.
function stageHarness() {
  const callbacks = new Map(),
    blurs = [],
    clears = [];
  let nextFrame = 0;
  class FakeContext {
    set shadowBlur(value) {
      blurs.push(value);
    }
    get shadowBlur() {
      return 0;
    }
  }
  for (const name of [
    'setTransform',
    'translate',
    'rotate',
    'save',
    'restore',
    'fillText',
    'arc',
    'lineTo',
    'moveTo',
    'beginPath',
    'closePath',
    'fill',
    'stroke',
    'fillRect',
    'strokeRect',
    'ellipse',
    'quadraticCurveTo',
    'bezierCurveTo',
    'scale',
    'drawImage',
    'rect',
    'clip',
    'setLineDash',
  ])
    FakeContext.prototype[name] = () => {};
  FakeContext.prototype.clearRect = () => clears.push(1);
  FakeContext.prototype.measureText = () => ({ width: 120 });
  FakeContext.prototype.createRadialGradient = FakeContext.prototype.createLinearGradient = () => ({
    addColorStop() {},
  });
  const context = new FakeContext(),
    canvas = { width: 0, height: 0, getContext: () => context };
  const sandbox = {
    attackTiming: require('../../public/shared/attack-timing.json'),
    combatRules: require('../../public/shared/scene-rules.json'),
    attackEffects: require('../../public/shared/attack-effects.json'),
    document: { hidden: false },
    performance: { now: () => 0 },
    requestAnimationFrame(fn) {
      callbacks.set(++nextFrame, fn);
      return nextFrame;
    },
    cancelAnimationFrame(id) {
      callbacks.delete(id);
    },
    setTimeout: () => 0,
    clearTimeout() {},
    Math,
    Date,
  };
  vm.createContext(withEngineImports(sandbox));
  vm.runInContext(
    fs.fixtureSource(lifetime) +
      fs
        .readFileSync(path.join(__dirname, '../src/services/attack-revision.js'), 'utf8')
        .replace(/export function /g, 'function ') +
      fs
        .readFileSync(path.join(__dirname, '../src/services/attack-figures.js'), 'utf8')
        .replace(/export function /g, 'function ') +
      fs
        .readFileSync(path.join(__dirname, '../src/services/attack-area.js'), 'utf8')
        .replace(/^import .*attack-figures.js';\n/m, '')
        .replace(/^import .*attack-revision.js';\n/m, '')
        .replace('export function createAreaAttack', 'function createAreaAttack') +
      fs
        .readFileSync(path.join(__dirname, '../src/services/attack-stitch.js'), 'utf8')
        .replace('export function createStitchAttack', 'function createStitchAttack') +
      source,
    sandbox,
  );
  const stage = sandbox.createAttackStage(canvas);
  const attack = (effect) => ({
    effect,
    color: '#00f0ff',
    width: 1440,
    height: 900,
    from: { x: 200, y: 500 },
    to: { x: 1100, y: 500 },
  });
  function frame(now) {
    const pending = [...callbacks.entries()];
    callbacks.clear();
    for (const [, fn] of pending) fn(now);
    return pending.length;
  }
  return { stage, attack, frame, canvas, blurs, clears, callbacks };
}

test('three lobby attacks share one canvas, one frame loop and one clear per frame', () => {
  const h = stageHarness();
  for (const [id, effect] of [
    ['a', 'barrage'],
    ['b', 'flame_vortex'],
    ['c', 'chain_lightning'],
  ])
    assert.equal(h.stage.add(id, h.attack(effect)), true);
  assert.equal(h.callbacks.size, 1);
  h.clears.length = 0;
  for (let i = 1; i <= 5; i++) assert.equal(h.frame(i * 17), 1);
  assert.equal(h.clears.length, 5);
  h.stage.clear();
  assert.equal(h.callbacks.size, 0);
});

test('the stage lowers spark density and glow as more attacks play at once', () => {
  const h = stageHarness();
  h.stage.add('a', h.attack('barrage'));
  assert.deepEqual({ ...h.stage.detail() }, { density: 1, glow: 1, tier: 0 });
  h.stage.add('b', h.attack('barrage'));
  assert.deepEqual({ ...h.stage.detail() }, { density: 0.7, glow: 0.6, tier: 0 });
  h.stage.add('c', h.attack('barrage'));
  assert.deepEqual({ ...h.stage.detail() }, { density: 0.5, glow: 0, tier: 0 });
  // Glow set by any drawing helper is scaled through the shared context.
  h.blurs.length = 0;
  h.frame(17);
  assert.ok(h.blurs.length > 0);
  assert.ok(h.blurs.every((value) => value === 0));
  h.stage.remove('c');
  h.stage.remove('b');
  assert.deepEqual({ ...h.stage.detail() }, { density: 1, glow: 1, tier: 0 });
  h.stage.clear();
});

test('a device that keeps missing frames draws attacks at a lower resolution', () => {
  const h = stageHarness();
  h.stage.add('a', h.attack('flame_vortex'));
  const full = h.canvas.width;
  // Smooth frames keep full detail.
  for (let i = 1; i <= 40; i++) h.frame(i * 16);
  assert.equal(h.stage.detail().tier, 0);
  // Missed frames (50 ms apart) drop a tier and shrink the canvas.
  for (let i = 1; i <= 31; i++) h.frame(640 + i * 50);
  assert.equal(h.stage.detail().tier, 1);
  assert.ok(h.canvas.width < full);
  h.stage.clear();
});
