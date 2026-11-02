const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ROOM_IDLE_MS,
  ROOM_PLAYING_MS,
  ROOM_RECONNECT_MS,
  expireEmptyRooms,
  leavePlayer,
} = require('../src/rooms/lifecycle');
const { Room } = require('../src/games/poker');
const { ThunderRoom } = require('../src/games/thunder');
const { DrawGuessRoom } = require('../src/games/draw-guess');
const { GiftRoom } = require('../src/games/gift');
const { MajorityRoom } = require('../src/games/majority');

test('empty room cleanup preserves the reconnect window and ignores bots and kicked players', () => {
  const now = 200000,
    make = (code, players) => ({ code, players, phase: 'waiting' });
  const rooms = new Map([
      ['recent', make('recent', [{ lastSeen: now - ROOM_RECONNECT_MS + 1 }])],
      [
        'expired',
        make('expired', [
          { lastSeen: now - ROOM_RECONNECT_MS - ROOM_IDLE_MS },
          { bot: true, lastSeen: now },
        ]),
      ],
      ['kicked', make('kicked', [{ kicked: true, lastSeen: now }])],
      ['empty', make('empty', [])],
    ]),
    deleted = [];
  expireEmptyRooms({ rooms, now, onDelete: (code) => deleted.push(code) });
  assert.deepEqual([...rooms.keys()], ['recent']);
  assert.deepEqual(deleted, ['expired', 'kicked', 'empty']);
  rooms.get('recent').players[0].lastSeen = now;
  expireEmptyRooms({ rooms, now: now + ROOM_RECONNECT_MS - 1 });
  assert.equal(rooms.size, 1);
});

for (const Engine of [Room, ThunderRoom, DrawGuessRoom, GiftRoom, MajorityRoom]) {
  test(
    Engine.name +
      ': leaving host transfers control, removes their seat from play, and last human closes the room',
    () => {
      const room = new Engine('ABC123', 'test'),
        host = room.add('Host'),
        guest = room.add('Guest');
      assert.deepEqual(leavePlayer(room, host.id), { deleted: false });
      assert.equal(room.host, guest.id);
      assert.ok(!room.players.some((p) => p.id === host.id && !p.kicked && !p.bot));
      assert.deepEqual(leavePlayer(room, guest.id), { deleted: true });
    },
  );
}

test('leaving a started poker table hands the player to AI while another human remains', () => {
  const room = new Room('ABC123', 'test'),
    host = room.add('Host'),
    guest = room.add('Guest');
  room.start();
  assert.equal(leavePlayer(room, host.id).deleted, false);
  assert.equal(host.bot, true);
  assert.equal(host.kicked, true);
  assert.equal(room.host, guest.id);
  assert.equal(leavePlayer(room, guest.id).deleted, true);
});

for (const [phase, ttl] of [
  ['waiting', ROOM_IDLE_MS],
  ['finished', ROOM_IDLE_MS],
  ['drawing', ROOM_PLAYING_MS],
]) {
  test('retention boundary and reconnect: ' + phase, () => {
    const room = {
      code: 'A',
      phase,
      players: [{ lastSeen: 1000 }, { bot: true, lastSeen: 99999999 }],
    };
    const rooms = new Map([['A', room]]);
    const start = 1000 + ROOM_RECONNECT_MS;
    expireEmptyRooms({ rooms, now: start });
    assert.equal(room.emptyDeadline, start + ttl);
    room.phase = 'finished';
    expireEmptyRooms({ rooms, now: start + ttl - 1 });
    assert.equal(rooms.size, 1);
    room.players[0].lastSeen = start + ttl - 1;
    expireEmptyRooms({ rooms, now: start + ttl });
    assert.equal(room.emptyDeadline, undefined);
    const next = start + ttl - 1 + ROOM_RECONNECT_MS;
    expireEmptyRooms({ rooms, now: next });
    expireEmptyRooms({ rooms, now: next + ROOM_IDLE_MS });
    assert.equal(rooms.size, 0);
  });
}

test('offline retention survives persistence without extending its wall-clock deadline', () => {
  const { captureRoom, restoreRoom } = require('../src/rooms/persistence');
  const { restoreRoomPresence } = require('../src/rooms/lifecycle');
  const room = {
    code: 'A',
    type: 'poker',
    name: 'test',
    phase: 'waiting',
    players: [{ lastSeen: 1000 }],
    emptyDeadline: 1000 + ROOM_RECONNECT_MS + ROOM_IDLE_MS,
  };
  const restored = restoreRoom(captureRoom(room), () => ({})).room;
  assert.equal(restoreRoomPresence(restored, room.emptyDeadline - 1), true);
  assert.equal(restored.players[0].lastSeen, 1000);
  assert.equal(restoreRoomPresence(restored, room.emptyDeadline), false);
});
