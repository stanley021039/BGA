const { HttpError } = require('../http/errors');
const { randomBytes } = require('node:crypto');
const { createSceneCombat, sceneDistance } = require('./scene-combat');

// Ephemeral room-local movement. Weak keys prevent positions leaking across a
// deleted/recreated room code; this never mutates gameplay or history versions.
function createRoomSpace(now = () => Date.now(), random = Math.random, authorBonus = () => false) {
  const eligibility = new WeakMap(),
    combat = createSceneCombat(random, (_id, actor) => eligibility.get(actor) === true),
    attacks = new WeakMap();
  const spaces = new WeakMap();
  function advance(position, time) {
    combat.advance(position, time);
    if (!position.health) return;
    const duration =
      Math.hypot((position.targetX - position.x) / 12, (position.targetY - position.y) / 16) * 1000;
    const ratio = duration ? Math.min(1, Math.max(0, time - position.at) / duration) : 1;
    position.x += (position.targetX - position.x) * ratio;
    position.y += (position.targetY - position.y) * ratio;
    for (const axis of ['x', 'y']) {
      const shift =
        position[axis] < 0 || position[axis] > 100 ? Math.floor(position[axis] / 100) * 100 : 0;
      if (shift) {
        position[axis] -= shift;
        position['target' + axis.toUpperCase()] -= shift;
        position.wrapId = (position.wrapId || 0) + 1;
      }
    }
    position.at = time;
  }
  function reconcile(room, time) {
    let positions = spaces.get(room);
    if (!positions) spaces.set(room, (positions = new Map()));
    const members = room.players.filter((player) => !player.kicked);
    const active = new Set(members.map((player) => player.id));
    for (const id of positions.keys()) if (!active.has(id)) positions.delete(id);
    members.forEach((player, index) => {
      if (!positions.has(player.id)) {
        const x = index % 2 ? 88 : 12,
          y = 38 + Math.floor(index / 2) * 14;
        positions.set(player.id, {
          id: player.id,
          x,
          y,
          targetX: x,
          targetY: y,
          at: time,
          moveId: 0,
          facing: 'right',
        });
      }
      const position = positions.get(player.id);
      eligibility.set(position, !!authorBonus(player.id, room));
      advance(position, time);
    });
    return positions;
  }
  function view(room, playerId, players = room.players, expressions = []) {
    const time = now(),
      positions = reconcile(room, time),
      current = new Map();
    for (const event of expressions)
      if (event.at <= time && event.at + 5000 > time) current.set(event.playerId, event);
    return {
      attacks: (attacks.get(room) || []).filter((e) => e.until > time),
      selfId: playerId,
      serverNow: time,
      visitors: players
        .filter((player) => positions.has(player.id) && !player.kicked)
        .map((player) => {
          const position = positions.get(player.id),
            expression = current.get(player.id);
          const remainingMs = Math.ceil(
            Math.hypot((position.targetX - position.x) / 12, (position.targetY - position.y) / 16) *
              1000,
          );
          return {
            ...combat.view(position),
            teleportId: position.teleportId || 0,
            wrapId: position.wrapId || 0,
            id: player.id,
            name: player.name,
            image: player.avatar || '/assets/playful/game-quacks.svg',
            x: position.x,
            y: position.y,
            targetX: position.targetX,
            targetY: position.targetY,
            moveId: position.moveId,
            remainingMs,
            moving: remainingMs > 0,
            facing: position.facing,
            emote: expression
              ? {
                  id: expression.id,
                  image: expression.image,
                  label: expression.label,
                  at: expression.at,
                  until: expression.at + 5000,
                }
              : null,
            entrance: position.entrance || 'classic',
          };
        }),
    };
  }
  function move(room, playerId, input, effect, entrance) {
    if (input?.action) return act(room, playerId, input, effect, entrance);
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => !['code', 'x', 'y'].includes(key)) ||
      ![input.x, input.y].every(
        (value) =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100,
      )
    )
      throw new HttpError(400, 'INVALID_MOVEMENT', '目的地不正確');
    const positions = reconcile(room, now()),
      position = positions.get(playerId);
    if (!position) throw new HttpError(403, 'NOT_SEATED', '尚未加入此房間');
    combat.alive(position);
    if (input.x < position.x) position.facing = 'left';
    if (input.x > position.x) position.facing = 'right';
    position.targetX = input.x;
    position.targetY = input.y;
    position.moveId++;
  }
  function act(room, playerId, input, effect, entrance) {
    const time = now(),
      positions = reconcile(room, time),
      self = positions.get(playerId);
    if (!self) throw new HttpError(403, 'NOT_SEATED', '尚未加入此房間');
    combat.alive(self);
    self.entrance = entrance || self.entrance || 'classic';
    if (
      !['step', 'teleport', 'attack'].includes(input.action) ||
      Object.keys(input).some(
        (k) =>
          !['code', 'action', 'dx', 'dy', 'slot', 'aspectRatio', 'requestId', 'entrance'].includes(
            k,
          ),
      )
    )
      throw new HttpError(400, 'INVALID_MOVEMENT', '操作不正確');
    if (input.action === 'step') {
      if (
        ![input.dx, input.dy].every(
          (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1,
        ) ||
        (!input.dx && !input.dy)
      )
        throw new HttpError(400, 'INVALID_MOVEMENT', '方向不正確');
      self.targetX = self.x + input.dx * 5;
      self.targetY = self.y + input.dy * 5;
      if (input.dx) self.facing = input.dx < 0 ? 'left' : 'right';
      self.moveId++;
      return;
    }
    if (input.action === 'teleport') {
      if (self.teleportedAt !== undefined && time - self.teleportedAt < 1000)
        throw new HttpError(429, 'TELEPORT_COOLDOWN', '瞬移冷卻中');
      self.teleportedAt = time;
      self.x = self.targetX = (self.x + 20 + random() * 60) % 100;
      self.y = self.targetY = 15 + random() * 75;
      self.teleportId = (self.teleportId || 0) + 1;
      self.entrance = entrance || 'classic';
      self.moveId++;
      return;
    }
    if (
      !['q', 'e'].includes(input.slot) ||
      !Number.isFinite(input.aspectRatio) ||
      input.aspectRatio < 0.2 ||
      input.aspectRatio > 5 ||
      !/^[a-zA-Z0-9-]{8,80}$/.test(input.requestId || '')
    )
      throw new HttpError(400, 'INVALID_ATTACK', '攻擊操作不正確');
    self.receipts ||= new Map();
    for (const [id, at] of self.receipts) if (time - at > 60000) self.receipts.delete(id);
    if (self.receipts.has(input.requestId)) return;
    self.lastAttacks ||= {};
    if (self.lastAttacks[input.slot] !== undefined && time - self.lastAttacks[input.slot] < 2000)
      throw new HttpError(429, 'ATTACK_COOLDOWN', '攻擊冷卻中');
    const distance = (v) => sceneDistance(self, v, input.aspectRatio);
    const target = ['shield', 'sphere'].includes(effect)
      ? self
      : [...positions.entries()]
          .filter(
            ([id, v]) =>
              id !== playerId &&
              v.health > 0 &&
              distance(v) <= require('../../public/shared/scene-rules.json').attackRange,
          )
          .sort((a, b) => distance(a[1]) - distance(b[1]) || a[0].localeCompare(b[0]))[0]?.[1];
    if (!target) throw new HttpError(409, 'NO_ATTACK_TARGET', '攻擊範圍內沒有其他玩家');
    const toId = [...positions].find(([, v]) => v === target)[0],
      hit = target === self ? combat.protect(self, time) : combat.hit(self, target, time);
    const events = (attacks.get(room) || []).filter((e) => e.until > time);
    events.push({
      id: randomBytes(12).toString('hex'),
      slot: input.slot,
      effect,
      fromId: playerId,
      toId,
      fromName: room.players.find((p) => p.id === playerId).name,
      toName: room.players.find((p) => p.id === toId).name,
      fromX: self.x,
      fromY: self.y,
      toX: target.x,
      toY: target.y,
      ...hit,
      at: time,
      until: time + 1800,
    });
    attacks.set(room, events.slice(-40));
    self.lastAttacks[input.slot] = time;
    self.receipts.set(input.requestId, time);
  }
  function rebind(previous, next) {
    if (previous.code !== next.code) throw Error('Cannot rebind another room');
    for (const registry of [spaces, attacks]) {
      if (registry.has(previous)) registry.set(next, registry.get(previous));
      registry.delete(previous);
    }
  }
  return { view, move, rebind };
}
module.exports = { createRoomSpace };
