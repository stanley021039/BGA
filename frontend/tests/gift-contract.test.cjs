'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path'),
  fs = require('node:fs'),
  vm = require('node:vm');
const ts = require('../node_modules/typescript');
const { GiftRoom } = require('../../src/games/gift');

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
const { readGiftSnapshot } = load(path.resolve(__dirname, '../src/contracts/gift.ts'));

function finishedRoom() {
  const room = new GiftRoom('ABC172', '送禮達人', () => 0),
    players = ['阿星', '小河', '雨點'].map((name) => room.add(name));
  room.configure(players[0].id, { target: 30 });
  room.start();
  for (const player of room.players) {
    player.giveScore = 28;
    player.getScore = 28;
  }
  const [a, b, c] = players.map((player) => player.id),
    [g0, g1, g2, g3] = room.gifts.map((gift) => gift.id);
  room.act(a, 'give', { assignments: { [b]: g0, [c]: g1 } });
  room.act(b, 'give', { assignments: { [a]: g0, [c]: g2 } });
  room.act(c, 'give', { assignments: { [a]: g1, [b]: g2 } });
  room.act(a, 'wish', { ranking: { great: g0, good: g1, ok: g2, noWay: g3 } });
  room.act(b, 'wish', { ranking: { great: g0, good: g2, ok: g1, noWay: g3 } });
  room.act(c, 'wish', { ranking: { great: g2, good: g1, ok: g0, noWay: g3 } });
  while (room.phase === 'delivering') {
    const id = room.delivery.order[room.delivery.index];
    room.act(id, 'accept', { recipientId: id });
  }
  return { room, players };
}

test('gift contract accepts scores and entry snapshots above the target (#172)', () => {
  const { room, players } = finishedRoom();
  assert.equal(room.phase, 'finished');
  const view = { ...JSON.parse(JSON.stringify(room.view(players[0].id))), serverNow: Date.now() };
  assert.ok(view.players.some((player) => player.giveScore > 30));
  assert.ok(view.result.entries.some((entry) => entry.giveAfter > 30));
  const snapshot = readGiftSnapshot(view);
  assert.deepEqual(
    snapshot.players.map((player) => [player.giveScore, player.getScore]),
    view.players.map((player) => [player.giveScore, player.getScore]),
  );
  assert.deepEqual(snapshot.winner.ids, [players[1].id]);
});

test('gift contract still rejects negative scores', () => {
  const { players, room } = finishedRoom();
  const view = { ...JSON.parse(JSON.stringify(room.view(players[0].id))), serverNow: Date.now() };
  view.players[0].getScore = -1;
  assert.throws(() => readGiftSnapshot(view));
});
