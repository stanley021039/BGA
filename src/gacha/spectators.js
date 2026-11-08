'use strict';
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { createStateStream } = require('../rooms/state-stream');

const lobby = { code: '__GACHA_SPECTATORS__' };
const lifetimeMs = 180000;
const idPattern = /^[a-f0-9-]{36}$/i;
function createGachaSpectators({ db, valid, hideAnnouncement, announce }) {
  const rooms = new Map();
  const hosts = new Map();
  const stream = createStateStream({
    valid,
    onConnectionsChanged: (room) => {
      if (room !== lobby) stream.notify(lobby);
    },
    project: (room, _playerId, entry) => {
      if (room === lobby) {
        const hosted = hosts.get(entry.userId);
        return {
          rooms: [...rooms.values()].map(({ code, name }) => ({ id: code, name })),
          ...(hosted
            ? {
                hosted: {
                  id: hosted.code,
                  viewerNames: stream.viewerNames(
                    hosted,
                    (viewer) => viewer.userId !== hosted.owner,
                  ),
                },
              }
            : {}),
        };
      }
      return {
        id: room.code,
        name: room.name,
        phase: room.phase,
        count: room.receipt.results.length,
        index: room.index,
        startedAt: room.startedAt,
        changedAt: room.changedAt,
        serverNow: Date.now(),
        ...(room.phase === 'settled' ? { ending: room.ending } : {}),
        ...(room.phase === 'card' || room.phase === 'spotlight'
          ? { item: room.receipt.results[room.index] }
          : {}),
        ...(room.phase === 'summary' ? { items: room.receipt.results } : {}),
      };
    },
  });
  function closeRoom(room) {
    clearTimeout(room.timer);
    rooms.delete(room.code);
    hosts.delete(room.owner);
    room.phase = 'closed';
    stream.notify(room);
    setImmediate(() => stream.closeRoom(room.code));
    stream.notify(lobby);
  }
  function touch(room) {
    clearTimeout(room.timer);
    room.timer = setTimeout(() => closeRoom(room), lifetimeMs);
    room.timer.unref();
  }
  const invalid = () => new HttpError(400, 'INVALID_GACHA_SPECTATE', '無效的抽卡觀戰操作');
  function update(user, input) {
    const { action, id, requestId, market } = input || {};
    if (action === 'start') {
      if (
        typeof requestId !== 'string' ||
        !idPattern.test(requestId) ||
        typeof market !== 'boolean'
      )
        throw invalid();
      const previous = hosts.get(user.id);
      if (previous?.receipt.requestId === requestId) return { id: previous.code };
      const saved = db
        .prepare(
          "SELECT response_json FROM gacha_requests WHERE user_id=? AND request_id=? AND operation='draw'",
        )
        .get(user.id, requestId);
      if (!saved) throw new HttpError(404, 'GACHA_DRAW_NOT_FOUND', '找不到這筆抽卡');
      const receipt = JSON.parse(saved.response_json);
      if (Date.now() - Date.parse(receipt.at) > 10000) throw invalid();
      if (previous) closeRoom(previous);
      if (rooms.size >= 64) throw new HttpError(429, 'GACHA_SPECTATE_LIMIT', '觀戰場次已滿');
      const results = receipt.results;
      const ending = results.some((i) => i.rarity === 'epic' || i.rarity === 'legendary')
        ? 'rise'
        : results.every((i) => i.duplicate) || results.every((i) => i.rarity === 'common')
          ? 'fall'
          : 'flat';
      const at = Date.now();
      const room = {
        code: randomUUID(),
        owner: user.id,
        name: user.display_name,
        receipt,
        ending,
        phase: market ? 'market' : 'back',
        index: 0,
        startedAt: at,
        changedAt: at,
      };
      hideAnnouncement(user.id, requestId);
      rooms.set(room.code, room);
      hosts.set(user.id, room);
      touch(room);
      stream.notify(lobby);
      return { id: room.code };
    }
    const room = hosts.get(user.id);
    if (!room || room.code !== id)
      throw new HttpError(404, 'GACHA_SPECTATE_NOT_FOUND', '觀戰已結束');
    if (action === 'close') {
      closeRoom(room);
      return { ok: true };
    }
    const phase = room.phase;
    if (action === 'settle' && phase === 'market') room.phase = 'settled';
    else if (action === 'board' && (phase === 'market' || phase === 'settled')) room.phase = 'back';
    else if ((action === 'card' || action === 'spotlight') && phase === 'back') room.phase = action;
    else if (action === 'card' && phase === 'spotlight') room.phase = 'card';
    else if (
      action === 'next' &&
      phase === 'card' &&
      room.index + 1 < room.receipt.results.length
    ) {
      room.index++;
      room.phase = 'back';
    } else if (action === 'summary' && phase !== 'summary') {
      room.phase = 'summary';
      announce(user, room.receipt);
    } else throw invalid();
    room.changedAt = Date.now();
    touch(room);
    stream.notify(room);
    return { ok: true };
  }
  return {
    update,
    subscribe(id, entry) {
      const room = id ? rooms.get(id) : lobby;
      if (!room) throw new HttpError(404, 'GACHA_SPECTATE_NOT_FOUND', '觀戰已結束');
      return stream.subscribe(room, entry);
    },
    close() {
      for (const room of rooms.values()) clearTimeout(room.timer);
      rooms.clear();
      hosts.clear();
      stream.close();
    },
  };
}
module.exports = { createGachaSpectators };
