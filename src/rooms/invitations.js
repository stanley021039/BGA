'use strict';
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { listRooms } = require('./listing');
const ONLINE_MS = 90000,
  INVITE_MS = 300000;
function createRoomInvitations({
  rooms,
  seats,
  kickedUsers,
  readUser,
  validSession,
  now = Date.now,
}) {
  const presence = new Map(),
    pending = new Map();
  const seated = (room, id) => {
    const seat = seats.get(room.code)?.get(id);
    return (
      !!room.players.find((p) => p.id === seat && !p.bot && !p.kicked) &&
      !kickedUsers.get(room.code)?.has(id)
    );
  };
  const available = (room, id) =>
    listRooms(rooms, seats, kickedUsers, id).find((r) => r.code === room.code)?.joinable === true;
  function clean() {
    const time = now();
    for (const [hash, p] of presence)
      if (time - p.at > ONLINE_MS || !validSession(hash)) presence.delete(hash);
    for (const [id, i] of pending)
      if (
        i.expiresAt <= time ||
        rooms.get(i.room.code) !== i.room ||
        !seated(i.room, i.fromId) ||
        !readUser(i.fromId) ||
        !readUser(i.toId)
      )
        pending.delete(id);
  }
  function touch(user) {
    clean();
    if (!presence.has(user.session_hash) && presence.size >= 5000) return;
    presence.set(user.session_hash, { id: user.id, at: now() });
  }
  function forget(hash) {
    presence.delete(hash);
  }
  function online() {
    clean();
    return new Set([...presence.values()].map((p) => p.id));
  }
  function roomFor(user, code) {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) throw new HttpError(404, 'ROOM_NOT_FOUND', '找不到房間');
    if (!seated(room, user.id)) throw new HttpError(403, 'NOT_SEATED', '入座後才能邀請朋友');
    return room;
  }
  function summary(i) {
    return {
      id: i.id,
      code: i.room.code,
      type: i.room.type || 'poker',
      roomName: i.room.name,
      fromName: readUser(i.fromId)?.display_name || '朋友',
      expiresAt: i.expiresAt,
      canJoin: available(i.room, i.toId),
    };
  }
  function candidates(user, code) {
    const room = roomFor(user, code),
      info = listRooms(rooms, seats, kickedUsers, user.id).find((r) => r.code === room.code),
      roomHasSpace = info.playerCount < info.maxPlayers;
    const joinPhase =
      (room.type || 'poker') === 'poker' ||
      room.type === 'draw' ||
      room.phase === 'waiting' ||
      (['gift', 'trpg', 'telephone', 'musicquiz', 'minimal', 'bluff', 'quacks', 'ceo'].includes(
        room.type,
      ) &&
        room.phase === 'finished');
    const canInvite = roomHasSpace && joinPhase,
      reason = !roomHasSpace
        ? '房間已滿，無法再邀請。'
        : !joinPhase
          ? '這款遊戲進行中無法加入，請等本場結束。'
          : '';
    const users = canInvite
      ? [...online()]
          .filter((id) => id !== user.id && !seated(room, id) && available(room, id))
          .map((id) => readUser(id))
          .filter(Boolean)
          .map((p) => ({
            id: p.id,
            name: p.display_name,
            avatar: '/characters/' + p.id,
            pending: [...pending.values()].some(
              (i) => i.room === room && i.fromId === user.id && i.toId === p.id,
            ),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
      : [];
    return { canInvite, reason, users };
  }
  function send(user, { code, targetId }) {
    const room = roomFor(user, code);
    if (typeof targetId !== 'string' || targetId === user.id || !readUser(targetId))
      throw new HttpError(400, 'INVALID_RECIPIENT', '請選擇線上的朋友');
    if (!online().has(targetId))
      throw new HttpError(409, 'FRIEND_OFFLINE', '這位朋友已離線，請重新整理');
    if (seated(room, targetId)) throw new HttpError(409, 'ALREADY_SEATED', '這位朋友已在同桌');
    if (!available(room, targetId))
      throw new HttpError(409, 'ROOM_UNAVAILABLE', '目前無法加入此房間，請重新整理');
    const previous = [...pending.values()].find(
      (i) => i.room === room && i.fromId === user.id && i.toId === targetId,
    );
    if (previous) return summary(previous);
    if (
      pending.size >= 2000 ||
      [...pending.values()].filter((i) => i.toId === targetId).length >= 20
    )
      throw new HttpError(429, 'INVITE_LIMIT', '邀請暫時已滿，請稍後再試');
    const invite = {
      id: randomUUID(),
      room,
      fromId: user.id,
      toId: targetId,
      expiresAt: now() + INVITE_MS,
    };
    pending.set(invite.id, invite);
    return summary(invite);
  }
  function inbox(user) {
    clean();
    return {
      invitations: [...pending.values()].filter((i) => i.toId === user.id).map(summary),
      serverNow: now(),
    };
  }
  function resolve(user, { id, action }, join) {
    clean();
    const i = pending.get(id);
    if (!i || i.toId !== user.id) throw new HttpError(404, 'INVITE_EXPIRED', '這份邀請已失效');
    if (action === 'decline') {
      pending.delete(id);
      return { ok: true };
    }
    if (action !== 'accept') throw new HttpError(400, 'INVALID_ACTION', '請選擇加入或婉拒');
    if (!available(i.room, user.id))
      throw new HttpError(409, 'ROOM_UNAVAILABLE', '房間已滿、已開局或目前無法加入');
    const result = join(i.room);
    pending.delete(id);
    return result;
  }
  return {
    touch,
    forget,
    candidates,
    send,
    inbox,
    resolve,
    close() {
      presence.clear();
      pending.clear();
    },
  };
}
module.exports = { createRoomInvitations };
