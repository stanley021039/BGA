'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Room } = require('../src/games/poker');
const { MinimalRoom } = require('../src/games/minimal');
const { TrpgRoom } = require('../src/games/trpg');
const { listRooms } = require('../src/rooms/listing');
const { rejoinPlayer } = require('../src/rooms/membership');
const { switchGame } = require('../src/rooms/game-switch');
const classes = { poker: Room, minimal: MinimalRoom, trpg: TrpgRoom };
for (const [type, RoomClass] of Object.entries(classes)) {
  test(`${type}: eight seats, ninth rejected, listing and game changes agree`, () => {
    const room = new RoomClass('ABCDEF', 'eight friends');
    for (let i = 0; i < 7; i++) room.add('P' + i);
    const listing = () =>
      listRooms(new Map([[room.code, room]]), new Map(), new Map(), 'outsider')[0];
    assert.equal(listing().maxPlayers, 8);
    assert.equal(listing().joinable, true);
    room.add('P7');
    assert.equal(listing().playerCount, 8);
    assert.equal(listing().joinable, false);
    assert.throws(() => room.add('P8'), /已滿/);
    for (const target of Object.keys(classes)) {
      const next = switchGame(room, room.host, target, classes);
      assert.equal(next.players.length, 8);
      assert.deepEqual(
        next.players.map((p) => p.id),
        room.players.map((p) => p.id),
      );
      next.start();
      assert.notEqual(next.phase, 'waiting');
      // Returning the same game returns the same room, so restore waiting for the next target.
      if (next === room) room.phase = 'waiting';
    }
  });
  test(`${type}: returning seat can fill eighth place but cannot overfill`, () => {
    const room = new RoomClass('ABCDEF', 'return');
    for (let i = 0; i < 8; i++) room.add('P' + i);
    const departing = room.players[7];
    departing.kicked = true;
    assert.equal(rejoinPlayer(room, departing.id, 'back').kicked, false);
    departing.kicked = true;
    room.players.push({ id: randomUUID(), name: 'replacement' });
    assert.throws(() => rejoinPlayer(room, departing.id, 'back'), /已滿/);
    assert.equal(departing.kicked, true);
  });
}
test('eight-player poker deals unique private cards and conserves chips through showdown', () => {
  for (const allin of [false, true]) {
    const room = new Room('ABCDEF', 'eight poker', () => 0);
    for (let i = 0; i < 8; i++) room.add('P' + i);
    if (allin)
      room.players.forEach((p, i) => {
        p.stack = (i + 1) * 100;
      });
    const chips = room.players.reduce((sum, p) => sum + p.stack, 0);
    room.start();
    for (const viewer of room.players) {
      const view = room.view(viewer.id);
      assert.deepEqual(view.players.find((p) => p.id === viewer.id).cards, viewer.cards);
      assert.ok(
        view.players
          .filter((p) => p.id !== viewer.id)
          .every((p) => p.cards.every((c) => c === null)),
      );
    }
    let actions = 0;
    while (room.phase !== 'showdown' && actions++ < 100) {
      const player = room.players[room.turn];
      room.act(player.id, allin ? 'allin' : player.bet < room.currentBet ? 'call' : 'check');
    }
    assert.equal(room.phase, 'showdown');
    assert.equal(new Set([...room.board, ...room.players.flatMap((p) => p.cards)]).size, 21);
    assert.equal(
      room.players.reduce((sum, p) => sum + p.stack, 0),
      chips,
    );
    assert.ok(room.players.every((p) => Number.isInteger(p.stack) && p.stack >= 0));
  }
});
test('eight-player adventure requires every plan, caps support at two and finishes all six scenes', () => {
  const room = new TrpgRoom('ABCDEF', 'eight adventurers', (n) => (n === 6 ? 5 : 0));
  for (let i = 0; i < 8; i++) room.add('P' + i);
  room.start();
  const act = (p, action, data = {}) =>
    room.act(p.id, action, { sceneId: room.sceneId, requestId: randomUUID(), ...data });
  for (let scene = 0; scene < 6; scene++) {
    const leader = room.players.find((p) => p.id === room.leaderId);
    for (const p of room.players.slice(0, 7))
      act(p, 'plan', { approach: 'bold', stance: p.focus ? 'assist' : 'recover', note: 'ready' });
    assert.throws(() => act(leader, 'resolve'), { code: 'NOT_READY' });
    act(room.players[7], 'plan', { approach: 'bold', stance: 'assist', note: 'eighth ready' });
    act(leader, 'resolve');
    const result = room.results.at(-1);
    assert.equal(result.participants.length, 8);
    assert.ok(result.support <= 2);
    if (scene < 5) act(leader, 'next');
  }
  assert.equal(room.phase, 'finished');
  assert.equal(room.results.length, 6);
});
