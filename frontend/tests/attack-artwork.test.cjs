const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('../../tests/helpers/browser-modules.cjs'),
  vm = require('node:vm'),
  path = require('node:path'),
  ts = require('typescript');

test('attack previews frame both regular and area effects around the stage center', () => {
  const module = { exports: {} };
  const attackEffects = require('../../public/shared/attack-effects.json');
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, '../src/services/attack-placement.ts'), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    {
      module,
      exports: module.exports,
      require: () => ({
        attackEffects,
        fitsAttackSlot: (slot, id) => {
          const effect = attackEffects.find((entry) => entry.id === id);
          return !!effect && (slot === 'r') === !!(effect.area || effect.ultimate);
        },
      }),
    },
  );
  const { previewAttackOptions, attackOptions } = module.exports;
  for (const [width, height] of [
    [934, 232],
    [320, 260],
    [1200, 550],
  ]) {
    for (const id of [
      'shield_alt',
      'beam',
      'frost_spikes',
      'guanyin_barrage',
      'dimension_cleave',
    ]) {
      const frame = previewAttackOptions(id, width, height);
      for (const point of [frame.from, frame.to]) {
        assert.ok(Math.abs(point.x / frame.width - 0.5) <= 0.3, id);
        assert.ok(Math.abs(point.y / frame.height - 0.5) < 0.15, id);
      }
      assert.ok(Math.abs(frame.width * frame.renderScale - width) < 1);
      assert.ok(Math.abs(frame.height * frame.renderScale - height) < 1);
    }
    for (const id of ['funnel', 'funnel_alt']) {
      const frame = previewAttackOptions(id, width, height);
      assert.equal(frame.from.x, frame.width / 2);
      assert.equal(frame.to.x, frame.width / 2);
      assert.equal(frame.from.y, frame.height / 2);
      assert.equal(frame.to.y, frame.height / 2);
    }
    const area = previewAttackOptions('guanyin_barrage', width, height);
    assert.ok(area.previewUnit * area.renderScale > Math.min(width / 105, height / 68) * 1.12);
  }
  const live = attackOptions(
    { effect: 'beam', from: { x: 20, y: 65 }, to: { x: 70, y: 65 } },
    1000,
    200,
  );
  assert.equal(live.from.x, 200);
  assert.equal(live.to.x, 700);
  assert.equal(live.to.y, 88);
});
const source = fs
  .readFileSync(path.join(__dirname, '../src/services/attack-artwork.js'), 'utf8')
  .replace(/^import .*motion-lifetime.js';\n/m, '')
  .replace(/^import combatRules .*scene-rules.json';\n/m, '')
  .replace(/^import .*attack-stitch.js';\n/m, '')
  .replace(/^import .*attack-new.js';\n/m, () =>
    require('../../tests/helpers/new-attack-module.cjs')(),
  )
  .replace(/^import .*attack-ordinary.js';\n/m, () => {
    const ordinary = fs
      .readFileSync(path.join(__dirname, '../src/services/attack-ordinary.js'), 'utf8')
      .replace(/^import .*\n/gm, '')
      .replace(/^export /gm, '');
    return (
      `const createOrdinaryAttack = (() => {
      const timing = attackTiming, { crystalReflection, shield } = combatRules;
      ${ordinary}
      return createOrdinaryAttack;
    })();` + '\n'
    );
  })
  .replace(/^import .*attack-area.js';\n/m, '')
  .replace(/^import .*attack-revision.js';\n/m, '')
  .replace(/^import attackEffects .*attack-effects.json';\n/m, '')
  .replace(/^import .*attack-variants.js';\n/m, () =>
    fs
      .readFileSync(path.join(__dirname, '../src/services/attack-variants.js'), 'utf8')
      .replace(/^import .*\n/m, 'const definitions = attackEffects;\n')
      .replace(/^export /gm, ''),
  )
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
    scales = [],
    texts = [],
    positions = [],
    rotations = [];
  let callback,
    clock = 0,
    nextTimer = 0;
  const timers = new Map();
  const gradient = () => ({
    addColorStop(_p, c) {
      colors.push(c);
    },
  });
  const context = new Proxy(
    {
      setTransform() {},
      translate(x, y) {
        transforms.push({ x, y });
      },
      scale(x, y) {
        scales.push([x, y]);
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
        return gradient();
      },
      createLinearGradient() {
        return gradient();
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
  return { colors, arcs, lines, transforms, scales, texts, positions, rotations };
}
test('crystal closes after 800 ms and reflects each supported projectile with its own art', () => {
  const { crystalReflection } = require('../../public/shared/scene-rules.json');
  const timing = require('../../public/shared/attack-timing.json');
  const reflect = (reflectedEffect, reflectedPhase, pending = true) =>
    run('crystal_reflection', '#69e3f4', 70, () => 0.5, {
      ageMs: 880,
      readHits: () => [
        {
          x: 640,
          y: 380,
          pathX: 120,
          pathY: 240,
          toId: 'enemy',
          phase: 'reflection',
          reflectedEffect,
          reflectedPhase,
          delayMs: 450 + crystalReflection.travelMs,
          pending,
          damage: 43210,
          critical: false,
        },
      ],
    });
  const idle = run('crystal_reflection', '#69e3f4', 40, () => 0.5, {
    ageMs: 880,
    readHits: () => [],
  });
  assert.equal(idle.arcs.length, 0);
  for (const effect of crystalReflection.projectiles) {
    const art = reflect(effect, timing[effect][0][2]);
    assert.ok(art.lines.length || art.arcs.length, effect);
    assert.ok(!art.texts.includes('43,210'), effect);
  }
  const arrow = reflect('arrow_volley', 'hit1');
  assert.ok(arrow.colors.includes('#ff5a24'));
  assert.ok(arrow.lines.some(({ x }) => x === -44));
  const alternate = reflect('tidal_blades_alt', 'hit1', false);
  const original = reflect('tidal_blades', 'hit1', false);
  assert.ok(alternate.colors.some((paint) => paint.startsWith('hsla(')));
  assert.notDeepEqual(alternate.colors, original.colors);
  assert.ok(alternate.texts.includes('43,210'));
  const multiple = run('crystal_reflection', '#69e3f4', 150, () => 0.5, {
    readHits: () =>
      ['hit1', 'hit2'].map((reflectedPhase, index) => ({
        x: 640,
        y: 380,
        pathX: 120,
        pathY: 240,
        toId: 'enemy',
        phase: 'reflection',
        reflectionIndex: index,
        reflectedEffect: 'tidal_blades',
        reflectedPhase,
        delayMs: 430 + index * 360 + crystalReflection.travelMs,
        damage: 43210 + index,
        critical: false,
      })),
  });
  assert.ok(multiple.texts.includes('43,210'));
  assert.ok(multiple.texts.includes('43,211'));
});

test('original barrage mixes bright colors and metallic shots with white highlights', () => {
  const { colors } = run('barrage', '#63f5ff');
  for (const color of ['#63f5ff', '#ff819c', '#c99aff', '#69f2b5', '#e3edf5', '#95acbf', '#e9cb90'])
    assert.ok(colors.includes(color), color);
  for (const color of ['#9eb2c9', '#d5e8f5', '#fff0bf']) assert.ok(colors.includes(color), color);
  assert.ok(colors.includes('#ffffff'));
});

test('rose barrage mixes rose, iron-gray, and coffee shots with lighter rings', () => {
  const { colors } = run('barrage_alt', '#fa4298');
  for (const color of ['#ed4190', '#ff79b4', '#e62e78', '#ff569c', '#535b66', '#742150', '#70462f'])
    assert.ok(colors.includes(color), color);
  for (const color of ['#aeb7c5', '#c976a8', '#c4946f']) assert.ok(colors.includes(color), color);
  assert.ok(!colors.includes('#63f5ff'));
});

test('both barrages paint small, medium, and large shots on successive frames', () => {
  for (const [effect, color] of [
    ['barrage', '#63f5ff'],
    ['barrage_alt', '#fa4298'],
  ]) {
    const { scales } = run(effect, color, 2);
    for (const size of [0.72, 1, 1.28]) {
      assert.ok(
        scales.filter(([x, y]) => x === size && y === size).length >= 12,
        `${effect} ${size}`,
      );
    }
  }
});

test('red-and-black cross beam paints a dark core and a red outer beam', () => {
  const { colors } = run('beam_alt', '#fa294a');
  assert.ok(colors.includes('#080204'));
  assert.ok(colors.includes('#fa294a'));
  assert.ok(colors.includes('#ff546a'));
});

test('every current offensive renderer waits for both authoritative settlement and its arrival clock', () => {
  const timing = require('../../public/shared/attack-timing.json');
  for (const effect of require('../../public/shared/attack-effects.json').filter(
    (e) => e.damageMultiplier !== 0,
  )) {
    const [delayMs, , phase] = (timing[effect.id] || timing[effect.variantOf]).find(
      (stage) => stage[1] > 0,
    );
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
    const isDisplay = (text) =>
      (effect.variantOf ?? effect.id) === 'starburst_stream'
        ? text === '1'
        : text.includes('111,111');
    const before = run(effect.id, effect.color, Math.ceil(delayMs / 17) - 1, () => 0.5, options);
    assert.ok(!before.texts.some(isDisplay), effect.id + ' early');
    const after = run(effect.id, effect.color, Math.ceil(delayMs / 17) + 2, () => 0.5, options);
    assert.ok(after.texts.some(isDisplay), effect.id + ' arrived');
    const pending = run(effect.id, effect.color, Math.ceil(delayMs / 17) + 2, () => 0.5, {
      ...options,
      readHits: () => [{ ...hit, pending: true }],
    });
    assert.ok(!pending.texts.some(isDisplay), effect.id + ' pending');
  }
});
test('Starburst shows all sixteen slash numbers in order even after several hits arrive together', () => {
  const timing = require('../../public/shared/attack-timing.json').starburst_stream;
  const hits = timing.map(([delayMs, , phase]) => ({
    toId: 'victim',
    x: 640,
    y: 380,
    damage: 25000,
    critical: false,
    delayMs,
    phase,
    pending: false,
  }));
  const display = run('starburst_stream', '#7bc7ff', 160, () => 0.5, {
    ageMs: 1460,
    readHits: () => hits,
  });
  const numbers = [...new Set(display.texts.filter((text) => /^\d+$/.test(text)))];
  assert.deepEqual(
    numbers,
    Array.from({ length: 16 }, (_, i) => String(i + 1)),
  );
  for (const paint of ['#161a24', '#62c9c6', '#f3fcff']) assert.ok(display.colors.includes(paint));
  assert.ok(!display.colors.includes('#3776ff'), 'no detached sword energy trail');
});
test('Starburst finisher has a separate expanding burst only after its confirmed hit', () => {
  const hit = {
    toId: 'victim',
    x: 640,
    y: 380,
    damage: 25000,
    delayMs: 2320,
    phase: 'slash16',
  };
  const confirmed = run('starburst_stream', '#7bc7ff', 28, () => 0.5, {
    ageMs: 2320,
    readHits: () => [hit],
  });
  assert.ok(confirmed.arcs.some(({ r }) => r > 130));
  assert.ok(confirmed.texts.includes('16'));
  const pending = run('starburst_stream', '#7bc7ff', 28, () => 0.5, {
    ageMs: 2320,
    readHits: () => [{ ...hit, pending: true }],
  });
  assert.ok(!pending.arcs.some(({ r }) => r > 130));
});
test('Starburst alternate keeps both blades and paints purple then white on confirmed hits', () => {
  const hits = [1, 2].map((count) => ({
    toId: 'victim',
    x: 640,
    y: 380,
    damage: 25000,
    delayMs: 760 + (count - 1) * 104,
    phase: 'slash' + count,
  }));
  for (const [index, impact] of ['#bb7eff', '#f2f5ff'].entries()) {
    const result = run('starburst_stream_alt', '#bf90ff', 1, () => 0.5, {
      ageMs: hits[index].delayMs,
      readHits: () => [hits[index]],
    });
    for (const paint of ['#6d34b8', '#f4f7ff', impact])
      assert.ok(result.colors.includes(paint), paint);
    assert.ok(!result.colors.includes(index === 0 ? '#f2f5ff' : '#bb7eff'));
  }
});
test('Explosion Scholar locks before firing its six different weapon types', () => {
  const locked = run('human_malice', '#ff7957', 1, () => 0.5, { preview: true, ageMs: 1170 });
  assert.ok(locked.texts.includes('鎖定'));
  assert.ok(!locked.colors.includes('#f4bf58'), 'physical bullets appear after lock');
  const result = run('human_malice', '#ff7957', 1, () => 0.5, { preview: true, ageMs: 1420 });
  for (const paint of [
    '#ffd175',
    '#8eb5e9',
    '#a5dd63',
    '#ff6749',
    '#da9eff',
    '#64efff',
    '#f4bf58',
    '#a5b6cb',
  ])
    assert.ok(result.colors.includes(paint), paint);
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
  assert.ok(after.texts.includes('56,000'));
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
function stageHarness(options) {
  const callbacks = new Map(),
    blurs = [],
    clears = [],
    transforms = [];
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
  FakeContext.prototype.setTransform = (...args) => transforms.push(args);
  FakeContext.prototype.clearRect = () => clears.push(1);
  FakeContext.prototype.measureText = () => ({ width: 120 });
  FakeContext.prototype.createRadialGradient = FakeContext.prototype.createLinearGradient = () => ({
    addColorStop() {},
  });
  const context = new FakeContext(),
    canvas = { width: 0, height: 0, style: {}, getContext: () => context };
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
  const stage = sandbox.createAttackStage(canvas, options);
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
  return { stage, attack, frame, canvas, blurs, clears, callbacks, transforms };
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

test('the shield artwork follows the live anchor from frame to frame', () => {
  let x = 120;
  const { transforms } = run('shield', '#63f5ff', 8, Math.random, {
    readAnchor: () => ({ x: (x += 15), y: 240 }),
  });
  assert.ok(transforms.some((point) => point.x === 15 && point.y === 0));
  assert.ok(transforms.some((point) => point.x === 45 && point.y === 0));
});

test('expanded arena renders the camera viewport at lobby pixel density', () => {
  const lobby = stageHarness();
  const arena = stageHarness({ readCamera: () => ({ x: 0.25, y: 0.5 }) });
  const attack = lobby.attack('barrage');
  lobby.stage.add('lobby', attack);
  arena.stage.add('arena', { ...attack, width: attack.width * 2, height: attack.height * 2 });
  assert.equal(arena.canvas.width, lobby.canvas.width);
  assert.equal(arena.canvas.height, lobby.canvas.height);
  arena.frame(17);
  assert.equal(arena.canvas.style.transform, 'translate3d(720px, 900px, 0)');
  assert.deepEqual(arena.transforms.at(-1).slice(4), [-640, -800]);
});
