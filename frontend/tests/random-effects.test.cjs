const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  ts = require('typescript');
const attacks = require('../../public/shared/attack-effects.json');
const palette = require('../../public/shared/entrance-palette.json');
const entrances = [
  ...palette.starters,
  ...require('../../public/shared/entrance-requirements.json'),
  ...palette.variants,
];
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      localStorage: { getItem: () => null },
      require(id) {
        if (id.endsWith('/attack-loadout')) return load('stores/attack-loadout.ts');
        if (id.endsWith('/entrance-effects')) return { entranceEffects: entrances };
        if (id.endsWith('attack-effects.json')) return { default: attacks };
        if (id === 'vue' || id === 'pinia') return require(id);
        return {};
      },
    },
  );
  modules.set(file, module.exports);
  return module.exports;
}
const random = load('services/random-effects.ts');
test('random selection respects owned variants and never equips an ultimate in Q/E', () => {
  const owned = new Set(['barrage', 'beam', 'explosion']);
  for (let i = 0; i < 80; i++) {
    const result = random.randomAttacks({ q: 'barrage', e: 'beam', r: '' }, (id) => owned.has(id));
    assert.equal(result.q, 'beam');
    assert.equal(result.e, 'barrage');
    assert.equal(result.r, 'explosion');
  }
  const empty = random.randomAttacks({ q: 'barrage', e: 'beam', r: 'explosion' }, (id) =>
    ['barrage', 'beam'].includes(id),
  );
  assert.equal(empty.r, '');
  const all = random.randomAttacks({ q: 'barrage', e: 'beam', r: '' });
  const fits = load('stores/attack-loadout.ts').fitsAttackSlot;
  assert.ok(fits('q', all.q) && fits('e', all.e) && fits('r', all.r));
  assert.notEqual(all.q, all.e);
});
test('random entrance is from its permitted pool, avoids the current choice and handles one candidate', () => {
  const owned = entrances.slice(0, 2).map((e) => e.id);
  assert.equal(
    random.randomEntrance(owned[0], (id) => owned.includes(id)),
    owned[1],
  );
  assert.equal(random.randomEffect(['one', 'one'], 'one'), 'one');
  assert.equal(random.randomEffect([], ''), '');
  assert.equal(
    random.randomEffect(['a', 'b'], 'a', () => 0),
    'b',
  );
});
