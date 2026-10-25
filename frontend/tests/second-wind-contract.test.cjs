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

test('all packs survive the real room projection; mixed duplicates and invalid pack names are rejected', () => {
  for (const pack of ['second-wind', 'base', 'mixed']) {
    const room = new SecondWindRoom('ABCDEF', '契約');
    const players = ['甲', '乙', '丙'].map((n) => room.add(n));
    room.configure(players[0].id, { racerSet: pack });
    room.start();
    const view = { ...room.view(players[0].id), serverNow: Date.now() };
    readAthleteSnapshot(view);
    assert.equal(view.game.catalog.length, pack === 'mixed' ? 72 : 36);
    const duplicate = structuredClone(view);
    duplicate.game.catalog[1] = duplicate.game.catalog[0];
    assert.throws(() => readAthleteSnapshot(duplicate));
    const invalid = structuredClone(view);
    invalid.options.racerSet = 'unknown';
    assert.throws(() => readAthleteSnapshot(invalid));
  }
});
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
  const missingRace = structuredClone(v);
  missingRace.game.phase = 'choosing';
  delete missingRace.game.race;
  assert.throws(() => readAthleteSnapshot(missingRace));
  missingRace.game.race = 1;
  readAthleteSnapshot(missingRace);
  missingRace.game.race = 5;
  assert.throws(() => readAthleteSnapshot(missingRace));
});
