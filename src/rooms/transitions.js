'use strict';
const { HttpError } = require('../http/errors');
const { recordActionFeedback } = require('./action-feedback');
const { leavePlayer } = require('./lifecycle');
const { canKick } = require('./permissions');

// Player, AI and deadline actions share completion notifications.
function createRoomTransitions({
  onTransition = () => {},
  runtime,
  onMembershipChanged = () => {},
}) {
  function completed(room) {
    try {
      onTransition(room);
    } catch (error) {
      console.error('Room transition completion failed:', error);
    }
  }
  function transact(room, operation, run) {
    try {
      const result = run();
      recordActionFeedback(room, operation);
      return result;
    } finally {
      completed(room);
    }
  }
  function detach(room, userId, playerId, kicked) {
    runtime.seats.get(room.code)?.delete(userId);
    if (kicked) {
      if (!runtime.kickedUsers.has(room.code)) runtime.kickedUsers.set(room.code, new Set());
      runtime.kickedUsers.get(room.code).add(userId);
    } else if (room.players.some((player) => player.id === playerId && player.kicked)) {
      if (!runtime.departedSeats.has(room.code)) runtime.departedSeats.set(room.code, new Map());
      const departed = runtime.departedSeats.get(room.code);
      for (const [account, id] of departed)
        if (!room.players.some((player) => player.id === id)) departed.delete(account);
      departed.set(userId, playerId);
    }
    onMembershipChanged(room);
    for (const streams of [runtime.drawStreams, runtime.musicStreams])
      for (const entry of streams.get(room.code) || [])
        if (entry.userId === userId) entry.res.end();
  }
  function leave(room, userId, playerId) {
    const result = transact(room, { action: 'leave', source: 'player', actor: playerId }, () =>
      leavePlayer(room, playerId),
    );
    detach(room, userId, playerId, false);
    if (result.deleted) {
      runtime.rooms.delete(room.code);
      runtime.cleanupRoom(room.code);
    }
    return { code: room.code, left: true, deleted: result.deleted };
  }
  function kick(room, actor, input) {
    return transact(room, { action: 'kick', source: 'player', actor, input }, () => {
      if (input.confirmed !== true)
        throw new HttpError(400, 'CONFIRM_REQUIRED', '請先確認踢出玩家');
      const target = room.players.find((player) => player.id === input.playerId);
      if (!target) throw new HttpError(404, 'PLAYER_NOT_FOUND', '找不到玩家');
      if (!canKick(room, actor, target.id))
        throw new HttpError(
          403,
          'ROOM_KICK_FORBIDDEN',
          '只有房主或有權限的房間管理者可以踢出這位玩家',
        );
      room.kick(room.host, target.id);
      const account = [...(runtime.seats.get(room.code) || [])].find(
        ([, id]) => id === target.id,
      )?.[0];
      if (account) detach(room, account, target.id, true);
      else onMembershipChanged(room);
    });
  }
  return { transact, leave, kick };
}
module.exports = { createRoomTransitions };
