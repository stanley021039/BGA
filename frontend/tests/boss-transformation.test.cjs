const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { parseHTML } = require('linkedom');
function fixture() {
  const callbacks = new Set(),
    timers = new Map(),
    tracks = [];
  let allowed = true,
    clock = 0,
    id = 0;
  const { document, window } = parseHTML('<html><body></body></html>');
  window.Element.prototype.animate = function (frames, options) {
    const a = {
      frames,
      options,
      cancelled: false,
      cancel() {
        this.cancelled = true;
      },
    };
    tracks.push(a);
    return a;
  };
  const scope = {
    abilities: require('../../public/shared/boss-abilities.json'),
    motionAllowed: () => allowed,
    watchMotionCancellation: (cb) => {
      callbacks.add(cb);
      return () => callbacks.delete(cb);
    },
    setTimeout: (fn, ms) => {
      const key = ++id;
      timers.set(key, { fn, at: clock + ms });
      return key;
    },
    clearTimeout: (key) => timers.delete(key),
  };
  const source = fs
    .readFileSync(path.join(__dirname, '../src/services/boss-transformation.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/export (function|const) /g, '$1 ');
  vm.runInNewContext(
    source +
      '\nthis.play=playBossTransformation;this.plan=bossTransformPlan;this.materials=bossTransformMaterials;',
    scope,
  );
  function advance(ms) {
    clock += ms;
    for (const [key, timer] of [...timers].sort((a, b) => a[1].at - b[1].at))
      if (timer.at <= clock) {
        timers.delete(key);
        timer.fn();
      }
  }
  function node() {
    const n = document.createElement('div');
    document.body.append(n);
    return n;
  }
  return {
    scope,
    node,
    timers,
    tracks,
    callbacks,
    advance,
    block() {
      allowed = false;
      for (const cb of [...callbacks]) cb();
    },
  };
}
test('all thirteen boss types have distinct geometry and stronger final bursts with bounded native work', () => {
  const f = fixture(),
    ids = [...new Set(require('../../public/shared/boss-abilities.json').map((a) => a.boss))],
    geometry = new Set();
  assert.equal(Object.keys(f.scope.materials).length, 13);
  for (const id of ids) {
    let ordinary;
    for (const phase of [2, 3]) {
      const n = f.node();
      let revealed = 0;
      const stop = f.scope.play(n, id, phase, 2000, () => revealed++),
        svg = n.querySelector('svg');
      assert.ok(svg, id);
      assert.ok(
        svg.querySelectorAll('stop').length >= 10,
        'surface depth must include directional material lighting',
      );
      assert.equal(
        svg.querySelector('filter, image, feTurbulence'),
        null,
        'material detail cannot add bitmap downloads or per-frame noise filters',
      );
      assert.ok(svg.querySelectorAll('*').length <= 64);
      assert.ok(f.tracks.every((a) => a.options.duration < 800));
      const count = svg.querySelectorAll('path').length;
      if (phase === 2) {
        ordinary = count;
        geometry.add(svg.outerHTML);
      } else assert.ok(count > ordinary);
      assert.equal(revealed, 0, 'old form remains until the reveal beat');
      f.advance(phase === 2 ? 280 : 350);
      assert.equal(revealed, 1);
      f.advance(800);
      assert.equal(n.children.length, 0);
      assert.equal(f.timers.size, 0);
      assert.equal(f.callbacks.size, 0);
      stop();
      assert.equal(revealed, 1);
    }
  }
  assert.equal(geometry.size, 13);
  assert.ok(f.tracks.every((a) => a.cancelled));
});
test('stale phase events skip, late frames advance native timelines, and cancellation always reveals the latest form', () => {
  const f = fixture();
  assert.equal(f.scope.plan('colossal', 2, 1300), null);
  assert.equal(f.scope.plan('colossal', 1, 2000), null);
  assert.equal(f.scope.plan('unknown', 3, 2000), null);
  const n = f.node();
  let reveal = 0;
  f.scope.play(n, 'colossal', 3, 1800, () => reveal++);
  assert.ok(f.tracks.every((a) => a.currentTime === 200));
  f.advance(149);
  assert.equal(reveal, 0);
  f.advance(1);
  assert.equal(reveal, 1);
  f.block();
  assert.equal(n.children.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.callbacks.size, 0);
  assert.equal(reveal, 1);
  const m = f.node();
  assert.equal(
    f.scope.play(m, 'cthulhu', 2, 2000, () => reveal++),
    null,
  );
  assert.equal(m.children.length, 0);
  assert.equal(reveal, 2);
});
test('five simultaneous transformations cap work and disposing an interrupted reveal frees every resource', () => {
  const f = fixture(),
    stops = [];
  let revealed = 0;
  for (let i = 0; i < 5; i++)
    stops.push(f.scope.play(f.node(), 'mutalith', 2, 2000, () => revealed++));
  const extra = f.node();
  assert.equal(
    f.scope.play(extra, 'cthulhu', 3, 2000, () => revealed++),
    null,
  );
  assert.equal(extra.children.length, 0);
  assert.ok(f.tracks.length <= 5 * 18);
  for (const stop of stops) stop();
  assert.equal(f.timers.size, 0);
  assert.equal(f.callbacks.size, 0);
  assert.equal(revealed, 6);
  assert.ok(f.scope.play(extra, 'cthulhu', 3, 2000));
  f.block();
  assert.equal(extra.children.length, 0);
});

test('concurrent material gradients keep owner-local paint references without external textures', () => {
  const f = fixture(),
    ids = new Set(),
    stops = [];
  try {
    for (const boss of ['steel-behemoth', 'cthulhu', 'colossal', 'prismatic-void', 'arkveld']) {
      const node = f.node();
      stops.push(f.scope.play(node, boss, 3, 2000));
      const svg = node.querySelector('svg');
      for (const def of svg.querySelectorAll('[id]')) {
        assert.equal(ids.has(def.id), false, 'one boss cannot reuse another boss paint server');
        ids.add(def.id);
      }
      for (const el of svg.querySelectorAll('[fill],[stroke]'))
        for (const name of ['fill', 'stroke']) {
          const ref = /^url\(#([^)]*)\)$/.exec(el.getAttribute(name) || '');
          if (ref)
            assert.ok(
              svg.querySelector('[id="' + ref[1] + '"]'),
              'every material reference resolves within its own effect',
            );
        }
    }
  } finally {
    for (const stop of stops) stop();
  }
  assert.equal(f.timers.size, 0);
  assert.equal(f.callbacks.size, 0);
});
