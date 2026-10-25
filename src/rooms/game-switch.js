'use strict';
const { HttpError } = require('../http/errors');

const roomGames = [
  ['poker', '德州撲克', 2, 6],
  ['thunder', '雷霆之路', 2, 4],
  ['majority', '同頻俱樂部', 3, 12],
  ['gift', '送禮達人', 3, 8],
  ['draw', '你畫我猜', 2, 8],
  ['trpg', '霧港跑團', 1, 6],
  ['telephone', '傳情畫意', 3, 8],
  ['musicquiz', '猜歌挑戰', 1, 8],
  ['minimal', '極簡畫家', 3, 6],
  ['bluff', '瞎掰王', 3, 9],
  ['quacks', '郎中闖江湖', 2, 8],
].map(([type, name, min, max]) => Object.freeze({ type, name, min, max }));

// A fresh instance keeps constructor-owned closures attached to the correct
// game. Only room membership crosses the boundary; game data uses new defaults.
function switchGame(room, actor, target, classes) {
  if (actor !== room.host) throw new HttpError(403, 'HOST_ONLY', '只有房主可以更換遊戲');
  if (room.phase !== 'waiting')
    throw new HttpError(409, 'ROOM_NOT_WAITING', '請先返回等待室再更換遊戲');
  const game = roomGames.find((game) => game.type === target);
  if (!game || !Object.hasOwn(classes, target))
    throw new HttpError(400, 'INVALID_GAME', '請選擇支援的遊戲');
  if ((room.type || 'poker') === target) return room;
  const players = room.players.filter((player) => !player.kicked);
  if (players.length > game.max)
    throw new HttpError(
      409,
      'GAME_PLAYER_LIMIT',
      `${game.name}最多 ${game.max} 人，目前有 ${players.length} 人，請先調整人數`,
    );
  const next = new classes[target](room.code, room.name, room.rng, room.now);
  for (const player of players) {
    const fresh = next.add(player.name, player.bot);
    for (const key of ['id', 'secret', 'name', 'avatar', 'bot', 'lastSeen', 'musicCardFrame'])
      if (Object.hasOwn(player, key)) fresh[key] = player[key];
  }
  next.host = room.host;
  if (room.managerIds)
    Object.defineProperty(next, 'managerIds', {
      value: new Set(room.managerIds),
      configurable: true,
    });
  next.gameRevision = (room.gameRevision || 0) + 1;
  next.version = (room.version || 0) + 1;
  return next;
}

function assertGameContext(room, data, required = false) {
  if (
    ((required || data.gameType !== undefined) && data.gameType !== (room.type || 'poker')) ||
    ((required || data.gameRevision !== undefined) &&
      data.gameRevision !== (room.gameRevision || 0))
  )
    throw new HttpError(409, 'ROOM_GAME_CHANGED', '房間遊戲已更新，請等待同步或重新連線後再操作');
}

module.exports = { roomGames, switchGame, assertGameContext };
