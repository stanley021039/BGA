const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rules = require('../../public/shared/scene-rules.json');
const effects = require('../../public/shared/attack-effects.json');
const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/services/attack-ordinary.js'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } },
).outputText;
const api = {};
new Function('exports', 'require', compiled)(api, (id) =>
  id.endsWith('attack-effects.json')
    ? effects
    : id.endsWith('attack-timing.json')
      ? require('../../public/shared/attack-timing.json')
      : rules,
);

function harness(alternate = false, moving = true) {
  const calls = [],
    paints = new Set();
  const ctx = new Proxy(
    {},
    {
      get(_t, name) {
        return (...args) => {
          calls.push([name, ...args]);
          if (name === 'createLinearGradient')
            return {
              addColorStop(_at, color) {
                paints.add(color);
              },
            };
        };
      },
      set(_t, name, value) {
        if (['fillStyle', 'strokeStyle', 'shadowColor'].includes(name) && typeof value === 'string')
          paints.add(value);
        return true;
      },
    },
  );
  let caster = { x: 180, y: 140 };
  const draw = api.createOrdinaryAttack(ctx, {
    effect: 'shield',
    alternatePalette: alternate ? 'shield_alt' : undefined,
    width: 640,
    height: 360,
    from: caster,
    readCaster: moving ? () => caster : undefined,
  });
  return {
    calls,
    paints,
    draw,
    move() {
      caster = { x: 240, y: 170 };
    },
  };
}

test('hex barrier stays finite, uses three authored paints and draws nothing after the actual guard window', () => {
  for (const alternate of [false, true]) {
    const h = harness(alternate);
    h.draw(900);
    assert.equal(h.paints.size, 3);
    assert.ok(h.calls.length < 500);
    for (const call of h.calls)
      for (const n of call.slice(1).filter((v) => typeof v === 'number'))
        assert.ok(Number.isFinite(n));
    const count = h.calls.length;
    for (const time of [-1, rules.shield.durationMs, rules.shield.durationMs + 100, NaN])
      h.draw(time);
    assert.equal(h.calls.length, count);
    h.move();
    h.draw(1100);
    assert.ok(h.calls.some(([name, x, y]) => name === 'translate' && x === 240 && y === 170));
  }
});

test('forest alternate adds segmented inner rim and distinct engraving rather than a global palette filter', () => {
  const original = harness(false),
    alternate = harness(true);
  original.draw(900);
  alternate.draw(900);
  assert.notDeepEqual(original.calls, alternate.calls);
  assert.ok(
    alternate.calls.some(
      ([name, pattern]) => name === 'setLineDash' && pattern.join(',') === '6,4',
    ),
  );
  assert.ok(!original.calls.some(([name, pattern]) => name === 'setLineDash' && pattern.length));
  assert.ok(alternate.paints.has(effects.find((e) => e.id === 'shield_alt').color));
});
