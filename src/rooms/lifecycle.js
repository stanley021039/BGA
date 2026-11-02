const ROOM_RECONNECT_MS = 180000;
const ROOM_IDLE_MS = 30 * 60000;
const ROOM_PLAYING_MS = 2 * 60 * 60000;
const hasOnlineHuman = (room, now = Date.now()) =>
  humans(room).some((p) => now - p.lastSeen < ROOM_RECONNECT_MS);
const humans = (room) => room.players.filter((player) => !player.bot && !player.kicked);

function expireEmptyRooms({ rooms, onDelete = () => {}, now = Date.now() }) {
  for (const [code, room] of rooms) {
    const players = humans(room);
    if (hasOnlineHuman(room, now)) {
      delete room.emptyDeadline;
      continue;
    }
    if (players.length) {
      if (!Number.isFinite(room.emptyDeadline)) {
        const lastSeen = Math.max(
          ...players.map((p) => (Number.isFinite(p.lastSeen) ? p.lastSeen : 0)),
        );
        const idle = ['waiting', 'finished', 'showdown'].includes(room.phase);
        room.emptyDeadline = lastSeen + ROOM_RECONNECT_MS + (idle ? ROOM_IDLE_MS : ROOM_PLAYING_MS);
      }
      if (now < room.emptyDeadline) continue;
    }
    rooms.delete(code);
    onDelete(code);
  }
}

function leavePlayer(room, playerId) {
  const remaining = humans(room).filter((player) => player.id !== playerId);
  if (!remaining.length) return { deleted: true };
  if (room.host === playerId) room.host = remaining[0].id;
  room.kick(room.host, playerId, true);
  return { deleted: false };
}

module.exports = {
  ROOM_IDLE_MS,
  ROOM_PLAYING_MS,
  hasOnlineHuman,
  ROOM_RECONNECT_MS,
  expireEmptyRooms,
  leavePlayer,
};

// Offline retention is wall-clock time, unlike paused gameplay timers.
function restoreRoomPresence(room, now) {
  if (Number.isFinite(room.emptyDeadline)) return room.emptyDeadline > now;
  for (const player of room.players) if (!player.bot) player.lastSeen = now;
  return true;
}
module.exports.restoreRoomPresence = restoreRoomPresence;
