const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const code = ts.transpileModule(
  readFileSync(path.join(__dirname, '../src/services/effect-variants.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const helpers = {};
const attacks = require('../../public/shared/attack-effects.json');
const { starters, variants } = require('../../public/shared/entrance-palette.json');
const entrances = [
  ...starters,
  ...require('../../public/shared/entrance-requirements.json'),
  ...variants,
];

test('all effect versions appear once beside their original, including the older crescent pair', () => {
  new Function('exports', 'require', code)(helpers, (id) => {
    if (id === '../stores/attack-loadout') return { attackEffects: attacks };
    assert.equal(id, './entrance-effects');
    return { entranceEffects: entrances };
  });
  const { attackEffectGroups: attackGroups, entranceEffectGroups: entranceGroups } = helpers;
  assert.equal(attackGroups.length, 29);
  assert.equal(entranceGroups.length, 31);
  for (const [groups, effects] of [
    [attackGroups, attacks],
    [entranceGroups, entrances],
  ]) {
    const ids = groups.flatMap((group) => group.versions.map((version) => version.id));
    assert.equal(ids.length, effects.length);
    assert.deepEqual(new Set(ids), new Set(effects.map((effect) => effect.id)));
    for (const { original, versions } of groups) {
      assert.equal(versions[0], original);
      assert.equal(versions.length, 2);
      assert.equal(versions[1].variantOf ?? 'blade_aura', original.id);
    }
  }
  const crescent = attackGroups.find((group) => group.original.id === 'blade_aura');
  assert.equal(crescent.versions[1].id, 'blade_aura_crimson');
});
