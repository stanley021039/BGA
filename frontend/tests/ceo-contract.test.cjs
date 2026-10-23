'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path'),
  fs = require('node:fs'),
  vm = require('node:vm');
const ts = require('../node_modules/typescript');
const { CeoRoom } = require('../../src/games/ceo-room');

// Transpile the real contract (and its relative imports) so the test runs the shipped parser.
function load(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: (id) => load(path.resolve(path.dirname(file), id + '.ts'), cache),
  });
  return module.exports;
}
const { readCeoSnapshot } = load(path.resolve(__dirname, '../src/contracts/ceo.ts'));

test('CEO shipped parser accepts real 3–6 seat games through final results without exposing peers changes', () => {
  for (const count of [3, 4, 5, 6]) {
    const room = new CeoRoom('ABC123', 'test', () => 0);
    const players = Array.from({ length: count }, (_, i) => room.add('player' + i));
    const read = (id) =>
      readCeoSnapshot({ ...JSON.parse(JSON.stringify(room.view(id))), serverNow: 1000 });
    assert.equal(read(players[0].id).game, null);
    room.start();
    let turns = 0;
    while (room.phase === 'playing' && turns++ < 250) {
      const view = read(players[0].id),
        g = view.game;
      for (const group of g.groups)
        if (group.playerId !== players[0].id) assert.equal(group.adjustments, null);
      const actor = g.players.find((p) => p.id === g.turnId),
        slot = g.market.find((s) => s.card.assets + s.extraCost <= actor.cash);
      room.act(actor.id, slot ? 'acquire' : 'dividend', {
        companyId: slot?.card.id,
        roundId: room.roundId,
        requestId: require('node:crypto').randomUUID(),
        expectedRevision: g.revision,
      });
    }
    assert.equal(room.phase, 'finished');
    assert.equal(read(players[0].id).game.results.players.length, count);
  }
});
test('CEO parser rejects broken market and result payloads before rendering money or score', () => {
  const room = new CeoRoom('ABC123', 'test', () => 0);
  const players = Array.from({ length: 3 }, (_, i) => room.add('player' + i));
  room.start();
  const view = () => ({ ...JSON.parse(JSON.stringify(room.view(players[0].id))), serverNow: 1000 });
  const bad = view();
  bad.game.market[0].extraCost = '8';
  assert.throws(() => readCeoSnapshot(bad));
  const card = view();
  card.game.market[0].card.score.kind = 'invented';
  assert.throws(() => readCeoSnapshot(card));
  const result = view();
  result.game.phase = 'finished';
  result.game.results = {};
  assert.throws(() => readCeoSnapshot(result));
});
