const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const definitions = require('../../public/shared/attack-effects.json');
const pairs = [
  ['shaohua_devour', '#ffda86'],
  ['reaper_seal', '#88dfcd'],
  ['railgun', '#78d9ee'],
  ['plasma_pulse', '#70eadc'],
  ['micro_missiles', '#a6a0ef'],
  ['photon_sniper', '#efcd85'],
];
function render(effect) {
  class Image {
    set src(url) {
      this.url = url;
      this.complete = true;
      this.width = this.naturalWidth = 96;
      this.height = 128;
    }
  }
  const scope = { Image };
  vm.createContext(scope);
  vm.runInContext(
    require('../../tests/helpers/new-attack-module.cjs')() + '\nglobalThis.create=createNewAttack;',
    scope,
  );
  const paints = [],
    geometry = [],
    portraits = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_t, k) =>
        (...args) => {
          if (k === 'drawImage') {
            portraits.push(args[0].url);
            geometry.push([k, ...args.slice(1)]);
            return;
          }
          if (k === 'createLinearGradient' || k === 'createRadialGradient') {
            geometry.push([k, ...args]);
            return { addColorStop: (_n, col) => paints.push(col) };
          }
          if (k === 'measureText') return { width: 20 };
          for (const v of args) if (typeof v === 'number') assert.ok(Number.isFinite(v));
          geometry.push([k, ...args]);
        },
      set: (_t, k, v) => {
        if (['fillStyle', 'strokeStyle', 'shadowColor', 'filter'].includes(k)) paints.push(v);
        return true;
      },
    },
  );
  const draw = scope.create(ctx, {
    effect,
    width: 1000,
    height: 700,
    from: { x: 180, y: 430 },
    to: { x: 690, y: 430 },
    preview: true,
    readHits: () => [{ x: 690, y: 430, damage: 1, delayMs: 2600 }],
    readHead: () => ({
      x: 470,
      y: 430,
      targetX: 690,
      targetY: 430,
      at: 0,
      contactAt: 2200,
      biteAt: 2600,
      finished: false,
      cancelled: false,
    }),
  });
  for (const t of [300, 600, 900, 1300, 2300, 2700]) draw(t);
  const count = geometry.length;
  draw(5000);
  assert.equal(geometry.length, count, 'expired effects do not draw');
  return { paints, geometry: JSON.parse(JSON.stringify(geometry)), portraits };
}
test('alternate materials preserve portraits and finite lifetimes with bounded detail', () => {
  for (const [id, accent] of pairs) {
    const base = render(id),
      alternate = render(id + '_alt');
    if (!['railgun', 'plasma_pulse', 'micro_missiles'].includes(id))
      assert.deepEqual(alternate.geometry, base.geometry, id + ' geometry changed');
    else
      assert.ok(
        alternate.geometry.length < base.geometry.length * 2 + 100,
        id + ' detail budget exceeded',
      );
    assert.deepEqual(alternate.portraits, base.portraits, id + ' portrait changed');
    assert.ok(
      alternate.paints.some((p) => typeof p === 'string' && p.startsWith(accent)),
      id + ' missing accent',
    );
    assert.notDeepEqual(alternate.paints, base.paints, id + ' unchanged paints');
    assert.ok(alternate.geometry.length < 12000, id + ' unexpected draw growth');
  }
});
test('attack alternate version names are descriptive and unique without changing their ownership IDs', () => {
  const variants = definitions.filter((e) => e.variantOf || e.id === 'blade_aura_crimson');
  const names = variants.map((e) => e.styleLabel || e.label.match(/（([^（）]+)）$/)?.[1]);
  assert.ok(names.every(Boolean));
  assert.equal(new Set(names).size, names.length);
  assert.ok(!names.includes('異色'));
  for (const [id] of pairs)
    assert.ok(definitions.some((e) => e.id === id + '_alt' && e.variantOf === id));
});

test('railgun and plasma originals retain their reviewed geometry after alternate-only detail changes', () => {
  const hashes = {
    railgun: '318460ab4f12e7f611585c64c0f384818a14e805184fd969fbecafdb971a5e0c',
    plasma_pulse: '77d9d569874cc87b4bc6f59081f2ad0a53f6fa803a8bfcd395c0c959faebcf3a',
  };
  for (const [id, expected] of Object.entries(hashes))
    assert.equal(
      require('node:crypto')
        .createHash('sha256')
        .update(JSON.stringify(render(id).geometry))
        .digest('hex'),
      expected,
      id,
    );
});
