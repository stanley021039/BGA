const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript'),
  path = require('node:path');
const mod = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src/services/attack-capacity.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { module: mod, exports: mod.exports },
);
const { replaceableAttack } = mod.exports;
test('a full ultimate stage preserves the hero flight and every other running ultimate', () => {
  const effects = require('../../public/shared/attack-effects.json').filter(
    (x) => x.area || x.ultimate,
  );
  for (const effect of effects) {
    const active = Object.freeze([
      Object.freeze({ slot: 'r', effect: 'gate_of_heroes' }),
      Object.freeze({ slot: 'r', effect: effect.id }),
      Object.freeze({ slot: 'r', effect: 'explosion' }),
    ]);
    assert.equal(replaceableAttack(active), undefined, effect.id);
    assert.equal(active.length, 3);
  }
});
test('ordinary visuals yield before an existing ultimate without adding capacity or mutating the stage', () => {
  const hero = { slot: 'r', effect: 'gate_of_heroes' },
    q = { slot: 'q', effect: 'beam' },
    e = { slot: 'e', effect: 'barrage' };
  const active = [hero, q, e];
  assert.equal(replaceableAttack(active), q);
  assert.deepEqual(active, [hero, q, e]);
  assert.equal(replaceableAttack([hero]), undefined);
  assert.equal(replaceableAttack([]), undefined);
});
