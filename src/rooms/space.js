const { HttpError } = require('../http/errors');

// Ephemeral room-local movement. Weak keys prevent positions leaking across a
// deleted/recreated room code; this never mutates gameplay or history versions.
function createRoomSpace(now = () => Date.now()) {
  const spaces = new WeakMap();
  function advance(position, time) {
    const duration =
      Math.hypot((position.targetX - position.x) / 12, (position.targetY - position.y) / 16) * 1000;
    const ratio = duration ? Math.min(1, Math.max(0, time - position.at) / duration) : 1;
    position.x += (position.targetX - position.x) * ratio;
    position.y += (position.targetY - position.y) * ratio;
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
          x,
          y,
          targetX: x,
          targetY: y,
          at: time,
          moveId: 0,
          facing: 'right',
        });
      }
      advance(positions.get(player.id), time);
    });
    return positions;
  }
  function view(room, playerId, players = room.players) {
    const time = now(),
      positions = reconcile(room, time);
    return {
      selfId: playerId,
      serverNow: time,
      visitors: players
        .filter((player) => positions.has(player.id) && !player.kicked)
        .map((player) => {
          const position = positions.get(player.id);
          const remainingMs = Math.ceil(
            Math.hypot((position.targetX - position.x) / 12, (position.targetY - position.y) / 16) *
              1000,
          );
          return {
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
            emote: null,
            entrance: 'classic',
          };
        }),
    };
  }
  function move(room, playerId, input) {
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
    if (input.x < position.x) position.facing = 'left';
    if (input.x > position.x) position.facing = 'right';
    position.targetX = input.x;
    position.targetY = input.y;
    position.moveId++;
  }
  return { view, move };
}
module.exports = { createRoomSpace };
