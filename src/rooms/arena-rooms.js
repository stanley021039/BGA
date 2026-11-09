'use strict';

const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');

const idleMs = 5 * 60 * 1000;

function createArenaRooms(makeLobby, makeHandlers, now = Date.now) {
  const rooms = new Map();
  const members = new Map();
  const waiting = makeHandlers(makeLobby());
  let nextNumber = 1;

  function detach(id, entry) {
    entry.room.lobby.leaveArenaRoom(entry.user);
    entry.room.count--;
    members.delete(id);
    if (entry.room.count === 0) rooms.delete(entry.room.id);
  }

  function sweep() {
    const cutoff = now() - idleMs;
    for (const [id, entry] of members) {
      if (entry.seenAt < cutoff) detach(id, entry);
    }
  }

  function handlers(id) {
    const entry = members.get(id);
    if (entry) entry.seenAt = now();
    sweep();
    return entry?.room.handlers || waiting;
  }

  function view(id) {
    return {
      currentId: members.get(id)?.room.id || null,
      rooms: [...rooms.values()].map(({ id, name, count }) => ({ id, name, count })),
    };
  }

  function command(user, input) {
    sweep();
    const previous = members.get(user.id);
    if (input?.action === 'leave') {
      if (previous) detach(user.id, previous);
      return;
    }
    let room;
    if (input?.action === 'create') {
      const rawName = input.roomName;
      const name = typeof rawName === 'string' ? rawName.trim() : '';
      if (
        (rawName !== undefined && typeof rawName !== 'string') ||
        name.length > 24 ||
        /[\p{Cc}]/u.test(name)
      )
        throw new HttpError(400, 'INVALID_ARENA_ROOM_NAME', '房名最多 24 個字，請使用一般文字');
      if (rooms.size >= 50) throw new HttpError(409, 'ARENA_ROOMS_FULL', '目前房間已滿');
      const lobby = makeLobby();
      room = {
        id: randomUUID(),
        name: name || '競技場 ' + nextNumber++,
        lobby,
        handlers: makeHandlers(lobby),
        count: 0,
      };
    } else if (input?.action === 'join') {
      room = rooms.get(input.roomId);
      if (!room) throw new HttpError(404, 'ARENA_ROOM_GONE', '這間房已關閉');
      if (previous?.room === room) return;
      if (room.count >= 16) throw new HttpError(409, 'ARENA_ROOM_FULL', '這間房已滿');
    } else throw new HttpError(400, 'INVALID_ARENA_ROOM', '房間操作不正確');

    if (previous) detach(user.id, previous);
    rooms.set(room.id, room);
    room.count++;
    members.set(user.id, { user, room, seenAt: now() });
  }

  function botRooms(id) {
    return [...rooms.values()].filter((room) => room.lobby.hasActiveArenaPlayer(id));
  }
  return { handlers, view, command, botRooms };
}

module.exports = { createArenaRooms };
