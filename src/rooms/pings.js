'use strict';
const { randomUUID } = require('node:crypto');
const TYPES = new Set([
  'ping',
  'attention',
  'question',
  'help',
  'look',
  'angry',
  'sleep',
  'speechless',
  'surprised',
  'admire',
]);
const { HttpError } = require('../http/errors');
const fail = (status, code, message) => {
  throw new HttpError(status, code, message);
};
const unit = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
function scene(room) {
  return JSON.stringify([
    room.type || 'poker',
    room.phase,
    room.roundId ?? room.round ?? null,
    room.canvas?.epoch ?? null,
  ]);
}
function target(room, value) {
  if (!value || !unit(value.x) || !unit(value.y))
    fail(400, 'INVALID_PING_TARGET', '標記位置不正確');
  if (value.kind === 'viewport') return { kind: 'viewport', x: value.x, y: value.y };
  if (value.kind === 'element') {
    const fixed =
      room.type === 'lobby'
        ? ['header', 'chat', 'players', 'lobby-stage', 'game-list', 'room-list']
        : ['header', 'chat', 'players'];
    if (
      !fixed.includes(value.key) &&
      !room.players.some((p) => !p.kicked && value.key === 'player:' + p.id)
    )
      fail(400, 'INVALID_PING_TARGET', '找不到公開標記目標');
    return { kind: 'element', key: value.key, x: value.x, y: value.y };
  }
  if (
    value.kind === 'surface' &&
    room.type === 'thunder' &&
    value.epoch === scene(room) &&
    typeof value.key === 'string'
  ) {
    const match = /^race-cell:([0-5]):([0-9]{1,6})$/.exec(value.key);
    if (
      match &&
      room.tiles.some((tile) => Number(match[2]) >= tile.start && Number(match[2]) < tile.start + 8)
    )
      return { kind: 'surface', key: value.key, epoch: value.epoch, x: value.x, y: value.y };
  }
  if (
    value.kind === 'surface' &&
    room.type === 'draw' &&
    value.key === 'draw-canvas' &&
    value.epoch === scene(room)
  )
    return { kind: 'surface', key: 'draw-canvas', epoch: value.epoch, x: value.x, y: value.y };
  fail(400, 'INVALID_PING_TARGET', '標記目標已失效');
}
class RoomPings {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.rooms = new Map();
  }
  get(room) {
    let s = this.rooms.get(room.code);
    if (s?.room !== room) {
      this.delete(room.code);
      s = {
        room,
        id: randomUUID(),
        events: [],
        receipts: new Map(),
        last: new Map(),
        starts: [],
        clients: new Set(),
      };
      this.rooms.set(room.code, s);
    }
    return s;
  }
  context(room) {
    const s = this.get(room);
    return { roomInstanceId: s.id, scene: scene(room), serverNow: this.now() };
  }
  post(room, playerId, name, input) {
    const s = this.get(room),
      now = this.now();
    if (input.roomInstanceId !== s.id || input.scene !== scene(room))
      fail(409, 'STALE_PING', '畫面已更新，請重新標記');
    if (
      !TYPES.has(input.type) ||
      typeof input.requestId !== 'string' ||
      !/^[a-zA-Z0-9-]{8,64}$/.test(input.requestId)
    )
      fail(400, 'INVALID_PING', '標記格式不正確');
    const position = target(room, input.target),
      key = playerId + ':' + input.requestId,
      fingerprint = JSON.stringify([input.type, position]),
      prior = s.receipts.get(key);
    if (prior) {
      if (prior.fingerprint !== fingerprint) fail(409, 'PING_RETRY_CONFLICT', '重試內容不同');
      return { event: prior.event, serverNow: now, duplicate: true };
    }
    s.starts = s.starts.filter((at) => now - at < 5000 && at <= now);
    if (now - (s.last.get(playerId) ?? -Infinity) < 1500 || s.starts.length >= 12)
      fail(429, 'PING_RATE_LIMIT', '標記太頻繁，請稍候');
    const event = {
      id: randomUUID(),
      roomInstanceId: s.id,
      scene: scene(room),
      playerId,
      name,
      type: input.type,
      target: position,
      at: now,
      expiresAt: now + 5000,
    };
    s.last.set(playerId, now);
    while (s.last.size > 128) s.last.delete(s.last.keys().next().value);
    s.starts.push(now);
    s.events = s.events.filter((e) => e.expiresAt > now);
    s.events.push(event);
    if (s.events.length > 50) s.events.shift();
    s.receipts.set(key, { fingerprint, event });
    while (s.receipts.size > 128) s.receipts.delete(s.receipts.keys().next().value);
    for (const client of [...s.clients]) client.send('ping', { event, serverNow: now });
    return { event, serverNow: now, duplicate: false };
  }
  subscribe(room, client) {
    const s = this.get(room);
    if (
      s.clients.size >= (room.type === 'lobby' ? 240 : 32) ||
      [...s.clients].filter((c) => c.userId === client.userId).length >= 3
    )
      fail(429, 'PING_STREAM_LIMIT', '標記連線太多，請關閉舊分頁');
    s.clients.add(client);
    return () => s.clients.delete(client);
  }
  delete(code) {
    const s = this.rooms.get(code);
    if (s) for (const c of [...s.clients]) c.close();
    this.rooms.delete(code);
  }
  clear() {
    for (const code of [...this.rooms.keys()]) this.delete(code);
  }
}
module.exports = { RoomPings, scene, target };
