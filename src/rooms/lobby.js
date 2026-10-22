const { HttpError } = require('../http/errors');
const { randomBytes } = require('node:crypto');
const { builtinFrameDescriptor } = require('../barrage/builtins');

// Percentages of the lobby page background, below the site header.
const MIN_X = 6,
  MAX_X = 94,
  MIN_Y = 12,
  MAX_Y = 97;
// Entrance effects a visitor may pick (frontend services/entrance-effects.ts).
const ENTRANCE_EFFECTS = new Set([
  'classic',
  'smoke',
  'sparks',
  'ink',
  'runes',
  'rift',
  'particles',
]);
const PRESENCE_MS = 15000,
  EMOTE_MS = 5000,
  MAX_VISITORS = 80;
const WALK_X_PER_SECOND = 12,
  WALK_Y_PER_SECOND = 16;

function createLobby(now = () => Date.now()) {
  const visitors = new Map(),
    barrages = [],
    receipts = new Map();
  function clean(time) {
    for (const [id, visitor] of visitors)
      if (time - visitor.seenAt > PRESENCE_MS) visitors.delete(id);
    while (barrages.length && time - barrages[0].at >= 8000) barrages.shift();
    for (const [key, value] of receipts) if (time - value.at > 60000) receipts.delete(key);
  }
  function advance(visitor, time) {
    const elapsed = Math.max(0, (time - visitor.updatedAt) / 1000);
    const dx = visitor.targetX - visitor.x,
      dy = visitor.targetY - visitor.y;
    const duration = Math.hypot(dx / WALK_X_PER_SECOND, dy / WALK_Y_PER_SECOND);
    const ratio = duration ? Math.min(1, elapsed / duration) : 1;
    visitor.x += dx * ratio;
    visitor.y += dy * ratio;
    visitor.updatedAt = time;
  }
  function enter(user, entrance) {
    const time = now();
    clean(time);
    let visitor = visitors.get(user.id);
    if (!visitor) {
      if (visitors.size >= MAX_VISITORS) throw new HttpError(503, 'LOBBY_FULL', '大廳目前已滿');
      const seed = [...user.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      // Arrive in the open gutters beside the three-card game carousel.
      const x = seed % 2 ? 67 + (seed % 3) * 2 : 4 + (seed % 3) * 3,
        y = 40 + (seed % 4) * 10;
      visitor = {
        id: user.id,
        x,
        y,
        targetX: x,
        targetY: y,
        moveId: 0,
        updatedAt: time,
        facing: 'right',
      };
      visitors.set(user.id, visitor);
    }
    visitor.name = user.display_name;
    visitor.seenAt = time;
    if (ENTRANCE_EFFECTS.has(entrance)) visitor.entrance = entrance;
    return visitor;
  }
  function view(user, { entrance } = {}) {
    enter(user, entrance);
    const time = now();
    for (const visitor of visitors.values()) advance(visitor, time);
    return {
      selfId: user.id,
      barrages: barrages.filter((event) => time - event.at < 8000),
      visitors: [...visitors.values()].map((visitor) => ({
        id: visitor.id,
        name: visitor.name,
        x: visitor.x,
        y: visitor.y,
        targetX: visitor.targetX,
        targetY: visitor.targetY,
        moveId: visitor.moveId,
        remainingMs: Math.ceil(
          Math.hypot(
            (visitor.targetX - visitor.x) / WALK_X_PER_SECOND,
            (visitor.targetY - visitor.y) / WALK_Y_PER_SECOND,
          ) * 1000,
        ),
        facing: visitor.facing,
        moving: Math.hypot(visitor.targetX - visitor.x, visitor.targetY - visitor.y) > 0.05,
        image: `/characters/${visitor.id}`,
        emote: visitor.emote && visitor.emote.until > time ? visitor.emote : null,
        entrance: visitor.entrance || 'classic',
      })),
    };
  }
  function move(user, input) {
    if (
      !input ||
      typeof input !== 'object' ||
      ![input.x, input.y].every(
        (value) =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100,
      )
    )
      throw new HttpError(400, 'INVALID_MOVEMENT', '目的地不正確');
    const visitor = enter(user),
      time = now();
    advance(visitor, time);
    visitor.targetX = Math.max(MIN_X, Math.min(MAX_X, input.x));
    visitor.targetY = Math.max(MIN_Y, Math.min(MAX_Y, input.y));
    visitor.moveId += 1;
    if (visitor.targetX < visitor.x - 0.1) visitor.facing = 'left';
    if (visitor.targetX > visitor.x + 0.1) visitor.facing = 'right';
    return view(user);
  }
  function emote(user, selected) {
    const visitor = enter(user),
      time = now();
    if (visitor.lastEmoteAt !== undefined && time - visitor.lastEmoteAt < 1200)
      throw new HttpError(429, 'EMOTE_RATE_LIMIT', '表情太快了，請稍後再試');
    visitor.lastEmoteAt = time;
    visitor.emote = {
      id: randomBytes(8).toString('hex'),
      image: selected.image,
      label: selected.label,
      at: time,
      until: time + EMOTE_MS,
      ...(selected.sound ? { sound: selected.sound, soundUntil: time + 10000 } : {}),
    };
    return view(user);
  }
  function barrage(user, input) {
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    if (!message || [...message].length > 160 || /[\u0000-\u001f\u007f]/.test(message))
      throw new HttpError(400, 'INVALID_MESSAGE', '請輸入1–160字的彈幕');
    if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(input.requestId))
      throw new HttpError(400, 'INVALID_REQUEST_ID', '操作識別碼不正確');
    const frame = builtinFrameDescriptor(input.builtinFrameId),
      visitor = enter(user),
      time = now(),
      key = user.id + ':' + input.requestId,
      fingerprint = JSON.stringify([message, frame.id]),
      prior = receipts.get(key);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new HttpError(409, 'REQUEST_CONFLICT', '同一操作內容不一致');
      return view(user);
    }
    if (visitor.lastBarrageAt !== undefined && time - visitor.lastBarrageAt < 1500)
      throw new HttpError(429, 'BARRAGE_RATE_LIMIT', '彈幕太快了，請稍後再試');
    visitor.lastBarrageAt = time;
    barrages.push({
      id: randomBytes(12).toString('hex'),
      kind: 'barrage',
      playerId: user.id,
      name: user.display_name,
      message,
      frame,
      at: time,
    });
    if (barrages.length > 50) barrages.shift();
    receipts.set(key, { fingerprint, at: time });
    if (receipts.size > 4000) receipts.delete(receipts.keys().next().value);
    return view(user);
  }
  function mediaAudience(viewerId) {
    const time = now(),
      present = [...visitors.values()].filter((visitor) => time - visitor.seenAt <= PRESENCE_MS);
    if (!present.some((visitor) => visitor.id === viewerId)) return null;
    return {
      id: 'lobby',
      userIds: new Set(present.map((visitor) => visitor.id)),
      expressions: present
        .filter((visitor) => visitor.emote && visitor.emote.until > time)
        .map((visitor) => ({ userId: visitor.id, ...visitor.emote })),
    };
  }
  function rename(userId, name) {
    const visitor = visitors.get(userId);
    if (visitor) visitor.name = name;
  }
  function clearExpression(image) {
    for (const visitor of visitors.values())
      if (visitor.emote?.image?.split('?')[0] === image) delete visitor.emote;
  }
  return { view, move, emote, barrage, mediaAudience, rename, clearExpression };
}

module.exports = { createLobby };
