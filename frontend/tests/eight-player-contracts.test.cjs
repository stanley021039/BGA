'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path'),
  fs = require('node:fs'),
  vm = require('node:vm');
const ts = require('../node_modules/typescript');
const { Room } = require('../../src/games/poker');
const { TrpgRoom } = require('../../src/games/trpg');
const { randomUUID } = require('node:crypto');

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
const { readPokerSnapshot } = load(path.resolve(__dirname, '../src/contracts/poker.ts'));
const { readTrpgSnapshot } = load(path.resolve(__dirname, '../src/contracts/trpg.ts'));
for (const [type, RoomClass, reader] of [
  ['poker', Room, readPokerSnapshot],
  ['trpg', TrpgRoom, readTrpgSnapshot],
]) {
  test(`${type} parser accepts eight seats throughout play and rejects a forged ninth seat`, () => {
    const room = new RoomClass('ABCDEF', 'eight', (n) => (n === 6 ? 5 : 0));
    for (let i = 0; i < 8; i++) room.add('P' + i);
    const read = () =>
      reader({ ...JSON.parse(JSON.stringify(room.view(room.host))), type, serverNow: Date.now() });
    assert.equal(read().players.length, 8);
    const invalid = {
      ...JSON.parse(JSON.stringify(room.view(room.host))),
      type,
      serverNow: Date.now(),
    };
    invalid.players.push({ ...invalid.players[0], id: randomUUID() });
    assert.throws(() => reader(invalid));
    room.start();
    read();
    if (type === 'poker') {
      let actions = 0;
      while (room.phase !== 'showdown' && actions++ < 100) {
        const p = room.players[room.turn];
        room.act(p.id, p.bet < room.currentBet ? 'call' : 'check');
        read();
      }
      assert.equal(room.phase, 'showdown');
    } else {
      const act = (id, action, data = {}) =>
        room.act(id, action, { sceneId: room.sceneId, requestId: randomUUID(), ...data });
      for (let scene = 0; scene < 6; scene++) {
        for (const p of room.players) {
          act(p.id, 'plan', {
            approach: 'bold',
            stance: p.focus ? 'assist' : 'recover',
            note: 'ready',
          });
          read();
        }
        act(room.leaderId, 'resolve');
        assert.equal(read().results.at(-1).participants.length, 8);
        if (scene < 5) {
          act(room.leaderId, 'next');
          read();
        }
      }
      assert.equal(room.phase, 'finished');
    }
  });
}
