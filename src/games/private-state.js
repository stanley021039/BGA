'use strict';

// Server-only persistence. None of these envelopes belongs in a player/observer view.
const { randomUUID } = require('node:crypto');
const { serialize } = require('node:v8');
function requireState(ok) {
  if (!ok) throw Error('Saved private game state is invalid or unsupported');
}
function readState(snapshot, kind) {
  requireState(snapshot?.version === 1 && snapshot.kind === kind);
  requireState(serialize(snapshot).length <= 2 * 1024 * 1024);
  return structuredClone(snapshot);
}
function playerIds(ids) {
  requireState(Array.isArray(ids) && ids.length >= 3 && ids.length <= 6);
  requireState(
    ids.every((id) => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)),
  );
  requireState(new Set(ids).size === ids.length);
  return ids;
}
const natural = (n) => Number.isSafeInteger(n) && n >= 0;
function exportRoomState(room, game, participants) {
  return {
    version: 1,
    kind: room.type,
    participants: [...participants],
    game: game?.exportPersistentState() || null,
  };
}
function restoreRoomState(room, snapshot, Game) {
  // Old waiting-room snapshots have no private engine to lose.
  if (!snapshot && room.phase === 'waiting') return { game: null, participants: new Set() };
  const saved = readState(snapshot, room.type);
  requireState(Array.isArray(saved.participants));
  requireState(new Set(saved.participants).size === saved.participants.length);
  requireState(saved.participants.every((id) => room.players.some((p) => p.id === id)));
  if (saved.game === null) {
    requireState(saved.participants.length === 0 && (room.phase === 'waiting' || room.interrupted));
    return { game: null, participants: new Set() };
  }
  requireState(room.phase !== 'waiting');
  playerIds(saved.participants);
  const game = Game.restorePersistentState(saved.game);
  const view = game.observerView();
  const ids = view.players.map((p) => (typeof p === 'string' ? p : p.id));
  requireState(
    ids.length === saved.participants.length && ids.every((id) => saved.participants.includes(id)),
  );
  requireState(room.interrupted || (room.phase === 'finished') === (view.phase === 'finished'));
  for (const id of ids) game.view(id);
  return { game, participants: new Set(saved.participants) };
}
function interruptRestore(room) {
  room.phase = 'finished';
  room.interrupted = true;
  room.restoreFailed = true;
  room.winner = null;
  room.results = [];
  room.roundId = randomUUID();
  room.receipts.clear();
  for (const player of room.players) player.score = 0;
  room.event(
    'restore-interrupted',
    '伺服器重啟後無法安全還原本局，已中止且不計勝負；房主可重新開局。',
  );
}
module.exports = {
  requireState,
  readState,
  playerIds,
  natural,
  exportRoomState,
  restoreRoomState,
  interruptRestore,
};
