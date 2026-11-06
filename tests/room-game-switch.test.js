'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { roomGames, switchGame, assertGameContext } = require('../src/rooms/game-switch');
const { returnToWaiting } = require('../src/rooms/rematch');
const { RoomMediaRegistry } = require('../src/media/room');
const { RoomWatchRegistry } = require('../src/watch/room');
const classes = Object.fromEntries(
  [
    ['poker', 'poker', 'Room'],
    ['thunder', 'thunder', 'ThunderRoom'],
    ['majority', 'majority', 'MajorityRoom'],
    ['gift', 'gift', 'GiftRoom'],
    ['draw', 'draw-guess', 'DrawGuessRoom'],
    ['trpg', 'trpg', 'TrpgRoom'],
    ['telephone', 'telephone', 'TelephoneRoom'],
    ['musicquiz', 'musicquiz', 'MusicQuizRoom'],
    ['minimal', 'minimal', 'MinimalRoom'],
    ['brainwave', 'voice-party', 'BrainwaveRoom'],
    ['bluff', 'bluff', 'BluffRoom'],
    ['quacks', 'quacks', 'QuacksRoom'],
  ].map(([type, file, name]) => [type, require('../src/games/' + file)[name]]),
);
for (const source of roomGames)
  test(source.type + ': changes to every game with fresh state and the same seats', () => {
    const room = new classes[source.type]('ABCDEF', 'friends');
    for (let i = 0; i < 3; i++) room.add('P' + i, i === 2);
    room.players[0].avatar = '/portrait';
    Object.defineProperty(room, 'managerIds', { value: new Set([room.players[1].id]) });
    room.oldSecret = 'must not migrate';
    for (const target of roomGames) {
      const next = switchGame(room, room.host, target.type, classes);
      if (source.type === target.type) {
        assert.equal(next, room);
        continue;
      }
      assert.equal(next.constructor, classes[target.type]);
      assert.equal(next.phase, 'waiting');
      assert.equal(next.host, room.host);
      assert.equal(next.gameRevision, 1);
      assert.equal(next.oldSecret, undefined);
      assert.equal(next.players[0].avatar, '/portrait');
      assert.deepEqual(next.managerIds, room.managerIds);
      assert.deepEqual(
        next.players.map((p) => [p.id, p.secret, p.name, p.bot]),
        room.players.map((p) => [p.id, p.secret, p.name, p.bot]),
      );
      for (const player of next.players) assert.equal(next.view(player.id).me, player.id);
      const back = switchGame(next, room.host, source.type, classes);
      assert.equal(back.gameRevision, 2);
      assertGameContext(back, { gameType: source.type, gameRevision: 2 }, true);
      assert.throws(
        () => assertGameContext(back, { gameType: source.type, gameRevision: 0 }, true),
        { code: 'ROOM_GAME_CHANGED' },
      );
    }
  });
test('switch authorization, phase and capacity reject without touching the old room', () => {
  const room = new classes.majority('ABCDEF', 'friends');
  for (let i = 0; i < 5; i++) room.add('P' + i);
  assert.throws(() => switchGame(room, room.players[1].id, 'draw', classes), { code: 'HOST_ONLY' });
  assert.throws(() => switchGame(room, room.host, 'thunder', classes), {
    code: 'GAME_PLAYER_LIMIT',
  });
  assert.throws(() => switchGame(room, room.host, '__proto__', classes), { code: 'INVALID_GAME' });
  room.phase = 'finished';
  assert.throws(() => switchGame(room, room.host, 'draw', classes), { code: 'ROOM_NOT_WAITING' });
  assert.equal(room.players.length, 5);
});
test('too few players may change games but cannot start until its minimum is met', () => {
  const room = new classes.trpg('ABCDEF', 'friends');
  room.add('host');
  const next = switchGame(room, room.host, 'majority', classes);
  assert.equal(next.players.length, 1);
  assert.throws(() => next.start());
  assert.equal(next.phase, 'waiting');
});
test('poker can return from showdown without losing chip balances', () => {
  const room = new classes.poker('ABCDEF', 'friends');
  room.add('host');
  room.add('peer');
  room.phase = 'showdown';
  room.players[0].stack = 1250;
  room.gameRevision = 4;
  returnToWaiting(room, room.host);
  assert.equal(room.phase, 'waiting');
  assert.equal(room.players[0].stack, 1250);
  assert.equal(room.gameRevision, 4);
});

test('current managers may return to waiting; demoted players cannot, and switching stays host-only', () => {
  const room = new classes.majority('ABCDEF', 'friends');
  for (let i = 0; i < 3; i++) room.add('P' + i);
  const manager = room.players[1].id;
  Object.defineProperty(room, 'managerIds', { value: new Set([manager]) });
  room.phase = 'finished';
  returnToWaiting(room, manager);
  assert.equal(room.phase, 'waiting');
  assert.throws(() => switchGame(room, manager, 'gift', classes), { code: 'HOST_ONLY' });
  room.phase = 'finished';
  room.managerIds.clear();
  assert.throws(() => returnToWaiting(room, manager), { code: 'HOST_ONLY' });
  assert.equal(room.phase, 'finished');
});
test('explicit registry rebinding keeps playback, queue and request ledger; code reuse still isolates', () => {
  for (const Registry of [RoomMediaRegistry, RoomWatchRegistry]) {
    const registry = new Registry(),
      old = { code: 'ABCDEF' },
      next = { code: 'ABCDEF' };
    const media = registry.get(old, { create: true });
    media.requests.set('receipt', { id: 'retained' });
    media.playback.anchorPositionSec = 42;
    registry.rebind(old, next);
    assert.equal(registry.get(next), media);
    assert.equal(registry.get(next).playback.anchorPositionSec, 42);
    assert.equal(registry.get(next).requests.size, 1);
    assert.throws(() => registry.rebind(next, { code: '123456' }));
    assert.notEqual(
      registry.get({ code: 'ABCDEF' }, { create: true }).roomInstanceId,
      media.roomInstanceId,
    );
  }
});

test('the drawing lobby needs a host selection and draw variants invalidate old game commands', () => {
  const room = new classes.draw('ABCDEF', 'friends');
  const host = room.add('host');
  const guest = room.add('guest');
  room.options.playMode = 'unselected';
  assert.throws(() => room.start(), { code: 'DRAW_MODE_REQUIRED' });
  assert.throws(() => room.configure(host.id, { seconds: 60 }), { code: 'DRAW_MODE_REQUIRED' });
  assert.throws(() => switchGame(room, guest.id, 'draw', classes, 'oracle'), { code: 'HOST_ONLY' });
  assert.throws(() => switchGame(room, host.id, 'minimal', classes, 'oracle'), {
    code: 'INVALID_DRAW_MODE',
  });
  const classic = switchGame(room, host.id, 'draw', classes, 'classic');
  assert.equal(classic.options.playMode, 'classic');
  assert.equal(classic.gameRevision, 1);
  classic.configure(host.id, { seconds: 60 });
  const oracle = switchGame(classic, host.id, 'draw', classes, 'oracle');
  assert.equal(oracle.options.playMode, 'oracle');
  assert.equal(oracle.options.seconds, 60);
  assert.equal(oracle.gameRevision, 2);
  assert.equal(oracle.view(guest.id).me, guest.id);
  assert.throws(() => assertGameContext(oracle, { gameType: 'draw', gameRevision: 1 }, true), {
    code: 'ROOM_GAME_CHANGED',
  });
  oracle.start();
  assert.equal(oracle.phase, 'oracle-drawing');
});
