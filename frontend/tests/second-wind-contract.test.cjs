'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
const ts = require('typescript');
const { SecondWindRoom } = require('../../src/games/second-wind/room');
function load(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) => load(path.resolve(path.dirname(file), id + '.ts'), cache),
    },
  );
  return module.exports;
}
const { readAthleteSnapshot } = load(path.resolve(__dirname, '../src/contracts/second-wind.ts'));
test('shipped athlete parser accepts actual recruiting views and rejects malformed revision, racer and choices', () => {
  const room = new SecondWindRoom('ABCDEF', '契約');
  const ps = ['甲', '乙', '丙'].map((n) => room.add(n));
  const view = () => ({ ...room.view(ps[0].id), serverNow: Date.now() });
  readAthleteSnapshot(view());
  room.start();
  const v = view();
  readAthleteSnapshot(v);
  const bad = structuredClone(v);
  bad.game.revision = -1;
  assert.throws(() => readAthleteSnapshot(bad));
  const wrong = structuredClone(v);
  wrong.game.pending = { id: 'x', playerId: 'outsider', title: 'bad', options: [] };
  assert.throws(() => readAthleteSnapshot(wrong));
  const racer = structuredClone(v);
  racer.game.racers = [
    {
      id: 'x',
      racerId: 'mole',
      playerId: ps[0].id,
      position: 31,
      tripped: false,
      finished: false,
      eliminated: false,
      transformed: false,
      copiedPowers: [],
    },
  ];
  assert.throws(() => readAthleteSnapshot(racer));
});
