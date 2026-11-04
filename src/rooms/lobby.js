const { profile } = require('./archetypes');
const { createWalls, layoutCount } = require('./walls');
const hazards = require('./hazards');
const { isAreaAttack, selectAttackTargets } = require('./attack-targets');
const combatRules = require('../../public/shared/scene-rules.json');
const { HttpError } = require('../http/errors');
const { createLobbyPickups, rules: pickupRules } = require('./lobby-pickups');
const { createLobbyArena, covers: legacyCovers } = require('./lobby-arena');
const { createSceneCombat } = require('./scene-combat');
const { createAttackTimeline } = require('./attack-timeline');
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
  ...require('../../public/shared/entrance-requirements.json').map((effect) => effect.id),
]);
const PRESENCE_MS = 15000,
  EMOTE_MS = 5000,
  MAX_VISITORS = 80;
const ATTACK_EFFECTS = new Set(require('../../public/shared/attack-effects.json').map((e) => e.id));
const WALK_X_PER_SECOND = 12,
  WALK_Y_PER_SECOND = 16;

function createLobby(
  now = () => Date.now(),
  portrait = (userId) => `/characters/${userId}`,
  random = Math.random,
  authorBonus = () => false,
  arenaOptions = {},
) {
  let walls = null,
    layoutId = 0;
  const geometry = {
    get covers() {
      return walls?.covers || legacyCovers;
    },
  };
  const arena = createLobbyArena(now, geometry, (visitors, players) => {
    const choices = Array.from({ length: layoutCount - 1 }, (_, i) => i + 1).filter(
      (i) => i !== layoutId,
    );
    layoutId =
      choices[
        Math.min(
          choices.length - 1,
          Math.floor(Math.max(0, Math.min(0.999999, random())) * choices.length),
        )
      ];
    walls = createWalls(layoutId);
    for (const p of players) {
      const actor = visitors.get(p.id),
        point = walls.safePoint(actor);
      actor.x = actor.targetX = point.x;
      actor.y = actor.targetY = point.y;
      actor.wallRoute = [];
      actor.moveId++;
      actor.updatedAt = now();
      const loadout = arenaOptions.attackLoadout?.(p.id);
      actor.lockedAttackLoadout = loadout ? Object.freeze({ q: loadout.q, e: loadout.e }) : null;
      p.loadout = actor.lockedAttackLoadout ? { ...actor.lockedAttackLoadout } : null;
    }
  });
  const combat = createSceneCombat(random, authorBonus, arena);
  const pickups = createLobbyPickups(now, random, arena, () => geometry.covers);
  const timeline = createAttackTimeline(combat, (actors, time) => pickups.advance(actors, time));
  let background = { id: 'default', changedAt: now(), nextChangeAt: 0 };
  const visitors = new Map(),
    barrages = [],
    attacks = [],
    receipts = new Map();
  function clean(time) {
    timeline.advance(attacks, visitors.values(), time, advance);
    arena.finish(time, visitors);
    pickups.advance(visitors.values(), time);
    for (const [id, visitor] of visitors)
      if (time - visitor.seenAt > PRESENCE_MS) visitors.delete(id);
    while (attacks.length && attacks[0].until < time) attacks.shift();
    while (barrages.length && time - barrages[0].at >= 8000) barrages.shift();
    for (const [key, value] of receipts) if (time - value.at > 60000) receipts.delete(key);
  }
  function advance(visitor, time) {
    if (!arena.active(visitor.id) || !walls) return advanceOrdinary(visitor, time);
    const end = Math.min(time, arena.deadline(visitor.id));
    while (visitor.updatedAt < end) {
      const at = Math.min(end, visitor.updatedAt + 100),
        teleportId = visitor.teleportId;
      combat.advance(visitor, at);
      if (!visitor.health) {
        visitor.updatedAt = at;
        continue;
      }
      const safe = walls.safePoint(visitor);
      if (teleportId !== visitor.teleportId || safe.x !== visitor.x || safe.y !== visitor.y) {
        visitor.x = visitor.targetX = safe.x;
        visitor.y = visitor.targetY = safe.y;
        visitor.wallRoute = [];
      }
      hazards.advance(visitor, at, combat.environmentDamage);
      if (!visitor.health) {
        visitor.updatedAt = at;
        continue;
      }
      if (
        Math.hypot(visitor.x - visitor.targetX, visitor.y - visitor.targetY) < 0.01 &&
        visitor.wallRoute?.length
      ) {
        const next = visitor.wallRoute.shift();
        visitor.targetX = next.x;
        visitor.targetY = next.y;
        visitor.moveId++;
      }
      const fromAt = Math.max(visitor.updatedAt, visitor.immobileUntil || 0),
        start = { x: visitor.x, y: visitor.y };
      const factor = hazards.speed(visitor) * profile(visitor).speed;
      const boosted = Math.max(
        0,
        Math.min(at, visitor.pickupSpeedUntil || 0) - Math.max(fromAt, visitor.pickupSpeedAt || 0),
      );
      const elapsed =
        ((Math.max(0, at - fromAt) + (pickupRules.speed - 1) * boosted) / 1000) * factor;
      const dx = visitor.targetX - visitor.x,
        dy = visitor.targetY - visitor.y,
        duration = Math.hypot(dx / WALK_X_PER_SECOND, dy / WALK_Y_PER_SECOND),
        ratio = duration ? Math.min(1, elapsed / duration) : 1;
      const point = walls.clip(start, { x: start.x + dx * ratio, y: start.y + dy * ratio });
      const shiftX = Math.floor(point.x / 100) * 100,
        shiftY = Math.floor(point.y / 100) * 100;
      visitor.x = point.x - shiftX;
      visitor.y = point.y - shiftY;
      visitor.targetX -= shiftX;
      visitor.targetY -= shiftY;
      if (shiftX || shiftY) visitor.wrapId = (visitor.wrapId || 0) + 1;
      pickups.record(
        visitor,
        start,
        visitor.updatedAt,
        at,
        !!(shiftX || shiftY) || teleportId !== visitor.teleportId,
        {
          distance:
            Math.hypot(
              (point.x - start.x) / WALK_X_PER_SECOND,
              (point.y - start.y) / WALK_Y_PER_SECOND,
            ) / factor,
          start: Math.min(at, fromAt),
          speedAt: visitor.pickupSpeedAt || 0,
          speedUntil: visitor.pickupSpeedUntil || 0,
        },
      );
      visitor.updatedAt = at;
      combat.collect(visitor, shiftX || shiftY ? undefined : start);
    }
    visitor.updatedAt = Math.max(visitor.updatedAt, time);
  }
  function advanceOrdinary(visitor, time) {
    const teleportId = visitor.teleportId;
    combat.advance(visitor, time);
    if (!visitor.health) return;
    const start = { x: visitor.x, y: visitor.y };
    const fromAt = Math.max(visitor.updatedAt, visitor.immobileUntil || 0);
    const boosted = Math.max(
      0,
      Math.min(time, visitor.pickupSpeedUntil || 0) - Math.max(fromAt, visitor.pickupSpeedAt || 0),
    );
    const elapsed = Math.max(0, time - fromAt) / 1000 + ((pickupRules.speed - 1) * boosted) / 1000;
    const dx = visitor.targetX - visitor.x,
      dy = visitor.targetY - visitor.y;
    const duration = Math.hypot(dx / WALK_X_PER_SECOND, dy / WALK_Y_PER_SECOND);
    const ratio = duration ? Math.min(1, elapsed / duration) : 1;
    const rawX = visitor.x + dx * ratio,
      rawY = visitor.y + dy * ratio;
    const shiftX = Math.floor(rawX / 100) * 100,
      shiftY = Math.floor(rawY / 100) * 100;
    visitor.x = rawX - shiftX;
    visitor.y = rawY - shiftY;
    visitor.targetX -= shiftX;
    visitor.targetY -= shiftY;
    if (shiftX || shiftY) visitor.wrapId = (visitor.wrapId || 0) + 1;
    pickups.record(
      visitor,
      start,
      visitor.updatedAt,
      time,
      !!(shiftX || shiftY) || teleportId !== visitor.teleportId,
      {
        distance: duration * ratio,
        start: Math.min(time, fromAt),
        speedAt: visitor.pickupSpeedAt || 0,
        speedUntil: visitor.pickupSpeedUntil || 0,
      },
    );
    visitor.updatedAt = time;
    combat.collect(visitor, shiftX || shiftY ? undefined : start);
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
        teleportId: 0,
        wrapId: 0,
        updatedAt: time,
        facing: 'right',
      };
      visitors.set(user.id, visitor);
    }
    arena.attach(visitor);
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
      arena: {
        ...arena.view(visitors),
        ...pickups.view(),
        layoutId,
        hazards: walls ? hazards.zones : [],
      },
      attacks: attacks.filter((event) => event.until > time),
      background: { ...background },
      barrages: barrages.filter((event) => time - event.at < 8000),
      visitors: [...visitors.values()].map((visitor) => ({
        ...combat.view(visitor, visitor.id === user.id),
        ...pickups.effects(visitor, time),
        id: visitor.id,
        name: visitor.name,
        archetype: visitor.archetype || null,
        hazardKind: arena.active(visitor.id) ? visitor.hazardKind || null : null,
        x: visitor.x,
        y: visitor.y,
        targetX: visitor.targetX,
        targetY: visitor.targetY,
        moveId: visitor.moveId,
        teleportId: visitor.teleportId,
        wrapId: visitor.wrapId || 0,
        remainingMs: remainingMs(visitor, time),
        facing: visitor.facing,
        moving: Math.hypot(visitor.targetX - visitor.x, visitor.targetY - visitor.y) > 0.05,
        image: portrait(visitor.id),
        emote: visitor.emote && visitor.emote.until > time ? visitor.emote : null,
        entrance: visitor.entrance || 'classic',
      })),
    };
  }
  function remainingMs(visitor, time) {
    const factor = arena.active(visitor.id) ? hazards.speed(visitor) * profile(visitor).speed : 1;
    const duration = Math.hypot(
      (visitor.targetX - visitor.x) / WALK_X_PER_SECOND / factor,
      (visitor.targetY - visitor.y) / WALK_Y_PER_SECOND / factor,
    );
    const boosted = Math.max(0, (visitor.pickupSpeedUntil || 0) - time) / 1000;
    return Math.ceil(
      (duration <= boosted * pickupRules.speed
        ? duration / pickupRules.speed
        : duration - boosted * (pickupRules.speed - 1)) * 1000,
    );
  }
  function move(user, input) {
    const step = input && (Object.hasOwn(input, 'dx') || Object.hasOwn(input, 'dy'));
    if (step) {
      if (
        ![input.dx, input.dy].every(
          (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1,
        ) ||
        (!input.dx && !input.dy) ||
        Object.hasOwn(input, 'x') ||
        Object.hasOwn(input, 'y')
      )
        throw new HttpError(400, 'INVALID_MOVEMENT', '方向不正確');
    } else if (
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
    combat.canMove(visitor, time);
    if (arena.active(visitor.id) && walls) {
      const dest = step
        ? { x: visitor.x + input.dx * 5, y: visitor.y + input.dy * 5 }
        : { x: input.x, y: input.y };
      visitor.wallRoute = step ? [walls.clip(visitor, dest)] : walls.route(visitor, dest);
      const first = visitor.wallRoute.shift() || visitor;
      visitor.targetX = first.x;
      visitor.targetY = first.y;
    } else {
      visitor.targetX = step ? visitor.x + input.dx * 5 : Math.max(MIN_X, Math.min(MAX_X, input.x));
      visitor.targetY = step ? visitor.y + input.dy * 5 : Math.max(MIN_Y, Math.min(MAX_Y, input.y));
    }
    visitor.moveId += 1;
    if (visitor.targetX < visitor.x - 0.1) visitor.facing = 'left';
    if (visitor.targetX > visitor.x + 0.1) visitor.facing = 'right';
    return view(user);
  }
  function attack(user, input) {
    const time = now();
    clean(time);
    const self = visitors.get(user.id);
    if (!self) throw new HttpError(403, 'LOBBY_PRESENCE_REQUIRED', '請先進入大廳');
    if (
      !input ||
      typeof input !== 'object' ||
      typeof input.requestId !== 'string' ||
      !/^[a-zA-Z0-9-]{8,80}$/.test(input.requestId) ||
      !Number.isFinite(input.aspectRatio) ||
      input.aspectRatio < 0.2 ||
      input.aspectRatio > 5 ||
      (input.slot !== undefined && !['q', 'e'].includes(input.slot)) ||
      (input.effect !== undefined && !ATTACK_EFFECTS.has(input.effect)) ||
      Object.keys(input).some((k) => !['requestId', 'aspectRatio', 'slot', 'effect'].includes(k))
    )
      throw new HttpError(400, 'INVALID_ATTACK', '攻擊操作不正確');
    const slot = input.slot || 'q',
      effect =
        (arena.active(self.id) && self.lockedAttackLoadout?.[slot]) || input.effect || 'barrage',
      fingerprint = JSON.stringify([input.aspectRatio, slot, effect]);
    const key = 'attack:' + user.id + ':' + input.requestId,
      prior = receipts.get(key);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new HttpError(409, 'REQUEST_CONFLICT', '同一操作內容不一致');
      return view(user);
    }
    if (
      self.lastAttacks?.[slot] !== undefined &&
      time - self.lastAttacks[slot] < combatRules.attackCooldownMs
    )
      throw new HttpError(
        429,
        'ATTACK_COOLDOWN',
        slot.toUpperCase() + ' 攻擊冷卻中，請稍候 1.6 秒',
      );
    for (const visitor of visitors.values()) advance(visitor, time);
    const targets = selectAttackTargets(
      self,
      combat
        .targets(visitors.values())
        .filter((actor) => arena.canPair(self.id, actor.ownerId || actor.id)),
      effect,
      input.aspectRatio,
    );
    if (attacks.length >= 40)
      throw new HttpError(429, 'ATTACK_SCENE_BUSY', '場景特效較多，請稍候再試');
    const target = targets[0];
    if (!target) throw new HttpError(409, 'NO_ATTACK_TARGET', '目前沒有其他玩家可以互動');
    combat.alive(self);
    const defensive = target === self;
    const hit = defensive ? combat.protect(self, time) : { damage: 0, critical: false };
    self.lastAttacks ||= {};
    self.lastAttacks[slot] = time;
    const event = {
      id: randomBytes(12).toString('hex'),
      fromId: self.id,
      ...hit,
      aspectRatio: input.aspectRatio,
      slot,
      effect,
      toId: target.id,
      fromName: self.name,
      toName: target.name,
      fromX: self.x,
      fromY: self.y,
      toX: target.x,
      toY: target.y,
      at: time,
      until: time + 1800,
    };
    combat.cast(self, effect, time);
    if (!defensive)
      timeline.prepare(
        event,
        self,
        targets,
        effect === 'bijuu_beam'
          ? combat
              .targets(visitors.values())
              .filter((actor) => arena.canPair(self.id, actor.ownerId || actor.id))
          : targets,
      );
    attacks.push(event);
    if (attacks.length > 40) attacks.shift();
    receipts.set(key, { at: time, fingerprint });
    if (receipts.size > 4000) receipts.delete(receipts.keys().next().value);
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
  function teleport(user, entrance) {
    const visitor = enter(user, entrance);
    combat.advance(visitor, now());
    combat.canMove(visitor, now());
    // Open gutters and the lower floor keep arrivals clear of the game carousel.
    const zones = [
      [6, 18, 45, 76],
      [66, 74, 40, 75],
      [8, 70, 82, 93],
    ];
    const zone = zones[Math.min(2, Math.floor(random() * zones.length))];
    let x = zone[0] + random() * (zone[1] - zone[0]),
      y = zone[2] + random() * (zone[3] - zone[2]);
    if (Math.hypot(x - visitor.x, y - visitor.y) < 2) x = x + 3 <= zone[1] ? x + 3 : x - 3;
    if (arena.active(visitor.id) && walls) {
      const safe = walls.safePoint({ x, y });
      x = safe.x;
      y = safe.y;
      visitor.wallRoute = [];
    }
    visitor.x = visitor.targetX = x;
    visitor.y = visitor.targetY = y;
    visitor.updatedAt = now();
    visitor.moveId++;
    visitor.teleportId++;
    return view(user);
  }
  function changeBackground(user, input) {
    if (
      !require('../../public/shared/lobby-backgrounds.json').some((item) => item.id === input?.id)
    )
      throw new HttpError(400, 'INVALID_BACKGROUND', '請選擇可用的大廳背景');
    if (input.id === background.id) return view(user);
    const time = now();
    if (time < background.nextChangeAt)
      throw new HttpError(429, 'BACKGROUND_COOLDOWN', '大廳背景每 30 秒只能更換一次');
    background = {
      id: input.id,
      changedAt: Math.max(time, background.changedAt + 1),
      nextChangeAt: time + 30000,
    };
    return view(user);
  }
  function arenaCommand(user, input) {
    enter(user);
    arena.view(visitors);
    arena.command(user, input, visitors, combat.reset);
    return view(user);
  }
  return {
    arena: arenaCommand,
    view,
    move,
    attack,
    emote,
    barrage,
    mediaAudience,
    rename,
    clearExpression,
    changeBackground,
    teleport,
  };
}

module.exports = { createLobby };
