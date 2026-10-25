'use strict';
const { HttpError } = require('../http/errors');
const { fill } = require('./persistence');

// Keep the room object: seats, streams, history, media and achievement hooks
// are attached to its identity. Rebuild only game state from its own defaults.
function returnToWaiting(room, actor) {
  if (room.host !== actor) throw new HttpError(403, 'HOST_ONLY', '只有房主可以返回等待室');
  if (room.phase === 'waiting') return;
  if (room.phase !== 'finished')
    throw new HttpError(409, 'MATCH_NOT_FINISHED', '本局結束後才能返回等待室');

  const fresh = new room.constructor(room.code, room.name, room.rng, room.now);
  const keep = new Set([
    'rng',
    'now',
    'code',
    'name',
    'host',
    'options',
    'settings',
    'customSongs',
    'reactionSeq',
  ]);
  if (room.type === 'gift')
    for (const key of ['target', 'customPercent', 'includeAdult']) keep.add(key);
  if (room.type === 'quacks') keep.add('bookChoices');
  const version = room.version || 0;
  const players = room.players
    .filter((player) => !player.kicked)
    .map((player) => {
      const next = fresh.add(player.name, player.bot);
      for (const key of [
        'id',
        'secret',
        'name',
        'avatar',
        'bot',
        'lastSeen',
        'role',
        'potColor',
        'potName',
        'musicCardFrame',
      ])
        if (Object.hasOwn(player, key)) next[key] = player[key];
      return next;
    });
  for (const key of Object.keys(room)) {
    if (keep.has(key) || typeof room[key] === 'function') continue;
    if (Object.hasOwn(fresh, key)) room[key] = fresh[key];
    else delete room[key];
  }
  for (const key of Object.keys(fresh)) {
    if (!keep.has(key)) room[key] = fresh[key];
  }
  room.players = players;
  if (room.type === 'majority')
    room.roundLimit =
      room.options.mode === 'cruel'
        ? 10
        : ['music', 'scenario'].includes(room.options.mode)
          ? room.options.bracketSize - 1
          : room.options.rounds;
  room.version = version;
  room.events = [];
  room.log = [];
  // These game buffers deliberately stay outside polling/history snapshots.
  for (const key of [
    'receipts',
    'draftReceipts',
    'topicReceipts',
    'publicResults',
    'roundStartScores',
  ])
    room[key]?.clear();
  for (const key of ['canvas', 'books', 'drafts', 'matchSummary']) {
    const descriptor = Object.getOwnPropertyDescriptor(room, key);
    if (!descriptor || descriptor.enumerable) continue;
    if (descriptor.writable) room[key] = fresh[key];
    else fill(room[key], fresh[key]);
  }
  if (Object.hasOwn(room, 'roundFastest')) room.roundFastest = null;
  if (room.achievementUnits) room.achievementUnits.current = null;
  room.matchAchievements?.restore(null);
  room.event('waiting', '已返回原房等待室，準備好後由房主開始下一局。');
}

module.exports = { returnToWaiting };
