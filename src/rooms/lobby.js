const { attackKind } = require('./attack-kind');
const { selectAttackTargets } = require('./attack-targets');
const { profile } = require('./archetypes');
const { createWalls, layoutCount } = require('./walls');
const { createHazards } = require('./hazards');
const { createBushes, bushAt } = require('./lobby-bushes');
const combatRules = require('../../public/shared/scene-rules.json');
const energy = require('./scene-energy');
const { HttpError } = require('../http/errors');
const { createLobbyPickups, rules: pickupRules } = require('./lobby-pickups');
const {
  center,
  boundary,
  portals,
  mapPortals,
  portalRadius,
  traversePortal,
  rollArenaRegions,
} = require('./arena-expanded-map');
const { createLobbyArena, covers: legacyCovers } = require('./lobby-arena');
const { createSceneCombat, authorSpeed } = require('./scene-combat');
const { createAttackTimeline } = require('./attack-timeline');
const { sceneWalkWithSpeed } = require('../../frontend/src/engines/scene-path.js');
const { randomBytes } = require('node:crypto');
const { builtinFrameDescriptor } = require('../barrage/builtins');

// Percentages of the lobby page background, below the site header.
const MIN_X = 6,
  MAX_X = 94,
  MIN_Y = 12,
  MAX_Y = 97;
const { starters, variants } = require('../../public/shared/entrance-palette.json');
const ENTRANCE_EFFECTS = new Set(
  [...starters, ...require('../../public/shared/entrance-requirements.json'), ...variants].map(
    (effect) => effect.id,
  ),
);
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
  const expanded = !!arenaOptions.expandedMap;
  let wide = expanded;
  let activePortals = [];
  function buildMap(layout, wide, offsets, pattern) {
    const walls = createWalls(layout, wide, offsets, pattern);
    const extraTraps =
      pattern === 4
        ? [
            {
              id: 'wing-trap-extra-nw',
              kind: 'embers',
              shape: 'emberPatch',
              x: 17,
              y: 16,
              width: 8,
              height: 7,
            },
            {
              id: 'wing-trap-extra-ne',
              kind: 'mud',
              shape: 'mudElbow',
              x: 73,
              y: 15,
              width: 8,
              height: 8,
            },
            {
              id: 'wing-trap-extra-sw',
              kind: 'embers',
              shape: 'emberCross',
              x: 21,
              y: 75,
              width: 9,
              height: 8,
            },
          ]
        : pattern === 0
          ? [
              {
                id: 'twin-trap-nw',
                kind: 'mud',
                shape: 'mudElbow',
                x: 25,
                y: 29,
                width: 8,
                height: 7,
              },
              {
                id: 'twin-trap-se',
                kind: 'embers',
                shape: 'emberScar',
                x: 76,
                y: 55,
                width: 8,
                height: 7,
              },
            ]
          : pattern === 1
            ? [
                {
                  id: 'cross-trap-nw',
                  kind: 'embers',
                  shape: 'emberCross',
                  x: 10,
                  y: 16,
                  width: 9,
                  height: 8,
                },
                {
                  id: 'cross-trap-se',
                  kind: 'mud',
                  shape: 'mudElbow',
                  x: 85,
                  y: 77,
                  width: 8,
                  height: 9,
                },
              ]
            : [];
    const hazards = createHazards(
      layout,
      wide,
      offsets,
      random,
      expanded,
      pattern === undefined ? [] : walls.covers,
      extraTraps,
    );
    const extraBushes =
      pattern === 2
        ? [
            { id: 'wing-bush-extra-nw', shape: 'bushGrove', x: 17, y: 18, width: 9, height: 8 },
            { id: 'wing-bush-extra-ne', shape: 'bushBank', x: 72, y: 16, width: 9, height: 7 },
            { id: 'wing-bush-extra-sw', shape: 'bushElbow', x: 23, y: 75, width: 8, height: 8 },
          ]
        : pattern === 1
          ? [
              { id: 'cross-bush-ne', shape: 'bushGrove', x: 79, y: 19, width: 11, height: 8 },
              { id: 'cross-bush-sw', shape: 'bushElbow', x: 7, y: 72, width: 8, height: 11 },
            ]
          : [];
    const bushes = createBushes(
      layout,
      [...walls.covers, ...hazards.zones],
      wide,
      offsets,
      extraBushes,
    );
    return { walls, hazards, bushes };
  }
  const mapNames = ['雙巷', '十字走廊', '四門庭院', '中央長牆', '三島外環'];
  const rollMaps = () =>
    Array.from({ length: 5 }, (_, index) => {
      const wide = index >= 2;
      const layout = 1 + Math.min(layoutCount - 2, Math.floor(random() * (layoutCount - 1)));
      const map = buildMap(layout, wide, rollArenaRegions(random), index);
      const entrances = mapPortals(index);
      return {
        id: index + 1,
        name: mapNames[index],
        wide,
        layout,
        ...map,
        entrances,
        preview: {
          walls: map.walls.covers,
          hazards: map.hazards.zones,
          bushes: map.bushes,
          portals: entrances.map(({ id, pair, x, y }) => ({ id, pair, x, y })),
        },
      };
    });
  let mapChoices = expanded && arenaOptions.requireReady ? rollMaps() : [];
  let walls = null,
    hazards = createHazards(),
    bushes = [],
    layoutId = 0;
  const geometry = {
    get covers() {
      return walls?.covers || legacyCovers;
    },
  };
  const arena = createLobbyArena(
    now,
    geometry,
    (visitors, players, map) => {
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
      if (map) {
        wide = map.wide;
        layoutId = map.layout;
        mapChoices = rollMaps();
      }
      const terrain =
        map || buildMap(layoutId, wide, expanded ? rollArenaRegions(random) : undefined);
      ({ walls, hazards, bushes } = terrain);
      activePortals = map?.entrances || (wide ? portals : []);
      const gap = wide ? 6 : 12;
      const starts = [];
      const occupied = [];
      const safeStart = (point) =>
        walls.clear(point, point) &&
        !hazards.at(point) &&
        !bushAt(bushes, point) &&
        activePortals.every(({ x, y }) => Math.hypot(point.x - x, point.y - y) > portalRadius);
      if (expanded) {
        for (let y = 8; y <= 92; y += gap / 2)
          for (let x = 8; x <= 92; x += gap / 2) {
            const point = { x, y };
            if (safeStart(point)) starts.push(point);
          }
      }
      for (const p of players) {
        const actor = visitors.get(p.id);
        const origin = walls.safePoint(wide ? center(actor) : actor);
        let point = origin;
        if (expanded) {
          const spaced = (candidate) =>
            occupied.every(({ x, y }) => Math.hypot(candidate.x - x, candidate.y - y) >= gap);
          if (!safeStart(origin) || !spaced(origin)) {
            let bestDistance = Infinity;
            for (const candidate of starts) {
              const distance = Math.hypot(candidate.x - origin.x, candidate.y - origin.y);
              if (distance < bestDistance && spaced(candidate)) {
                point = candidate;
                bestDistance = distance;
              }
            }
          }
          occupied.push(point);
        }
        actor.x = actor.targetX = point.x;
        actor.y = actor.targetY = point.y;
        actor.wallRoute = [];
        actor.arenaPortalLocked = false;
        actor.hazardId = actor.hazardKind = null;
        actor.hazardTickAt = actor.emberTrailUntil = 0;
        actor.bushRevealUntil = 0;
        actor.bushEntryId = null;
        actor.bushEnteredAt = 0;
        actor.moveId++;
        actor.updatedAt = now();
        const loadout = arenaOptions.attackLoadout?.(p.id);
        actor.lockedAttackLoadout = loadout
          ? Object.freeze({ q: loadout.q, e: loadout.e, r: loadout.r || '' })
          : null;
        p.loadout = actor.lockedAttackLoadout ? { ...actor.lockedAttackLoadout } : null;
      }
    },
    (teams, user) => {
      const bots = arenaOptions.practiceBots;
      if (bots?.length !== 5 || bots.some((bot) => bot.id === user.id)) return [];
      const ids = new Set(bots.map((bot) => bot.id));
      const humans = [...teams.keys()].filter((id) => !ids.has(id));
      if (humans.length !== 1 || humans[0] !== user.id) return [];
      const side = teams.get(user.id),
        other = side === 'red' ? 'blue' : 'red';
      if (visitors.size + bots.filter((bot) => !visitors.has(bot.id)).length > MAX_VISITORS)
        return [];
      bots.forEach((bot, index) => {
        enter(bot);
        teams.set(bot.id, index < 3 ? other : side);
      });
      return [...ids];
    },
    arenaOptions.startDelayMs,
    arenaOptions.requireReady,
    () => mapChoices,
    arenaOptions.onFinish,
  );
  const combat = createSceneCombat(random, authorBonus, arena);
  const pickups = createLobbyPickups(now, random, arena, () => geometry.covers, expanded);
  const timeline = createAttackTimeline(
    combat,
    (actors, time) => pickups.advance(actors, time),
    (source) => (source.matchId ? walls : null),
  );
  let background = { id: 'default', changedAt: now(), nextChangeAt: 0 };
  const visitors = new Map(),
    barrages = [],
    attacks = [],
    receipts = new Map();
  function clean(time) {
    for (const [id, visitor] of visitors)
      if (time - visitor.seenAt > PRESENCE_MS) visitors.delete(id);
    timeline.advance(attacks, visitors.values(), time, advance);
    arena.finish(time, visitors);
    pickups.advance(visitors.values(), time);
    for (let i = attacks.length - 1; i >= 0; i--)
      if (attacks[i].until <= time) attacks.splice(i, 1);
    while (barrages.length && time - barrages[0].at >= 8000) barrages.shift();
    for (const [key, value] of receipts) if (time - value.at > 60000) receipts.delete(key);
  }
  function arenaSpeed(visitor, time) {
    const status =
      time < (visitor.slowUntil || 0)
        ? combatRules.frost.speedMultiplier
        : time < (visitor.hasteUntil || 0)
          ? combatRules.bladeHaste.speedMultiplier
          : 1;
    return (
      hazards.speed(visitor) *
      profile(visitor).speed *
      authorSpeed(visitor) *
      status *
      (wide ? 0.5 : 1)
    );
  }
  function advance(visitor, time) {
    if (!arena.active(visitor.id) || !walls) return advanceOrdinary(visitor, time);
    if (arena.preparing(visitor.id, time)) {
      visitor.updatedAt = Math.max(visitor.updatedAt, time);
      return;
    }
    const end = Math.min(time, arena.deadline(visitor.id));
    while (visitor.updatedAt < end) {
      const at = Math.min(
          end,
          visitor.updatedAt + 100,
          ...[visitor.slowUntil, visitor.hasteUntil].filter((until) => until > visitor.updatedAt),
        ),
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
      const factor = arenaSpeed(visitor, fromAt);
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
      const shiftX = expanded ? 0 : Math.floor(point.x / 100) * 100,
        shiftY = expanded ? 0 : Math.floor(point.y / 100) * 100;
      visitor.x = point.x - shiftX;
      visitor.y = point.y - shiftY;
      visitor.targetX -= shiftX;
      visitor.targetY -= shiftY;
      const usedPortal = activePortals.length > 0 && traversePortal(visitor, activePortals, random);
      const bushId = bushAt(bushes, visitor)?.id || null;
      if (bushId !== visitor.bushEntryId) {
        visitor.bushEntryId = bushId;
        visitor.bushEnteredAt = at;
      }
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
      if (ratio > 0) {
        const moved = Math.hypot(
          (point.x - start.x) / WALK_X_PER_SECOND,
          (point.y - start.y) / WALK_Y_PER_SECOND,
        );
        energy.walk(
          visitor,
          elapsed > 0 ? Math.max(0, at - fromAt) * Math.min(1, moved / elapsed) : 0,
        );
      }
      combat.collect(
        visitor,
        shiftX || shiftY || usedPortal ? undefined : start,
        visitors.values(),
        at,
        Math.min(at, fromAt),
      );
      visitor.updatedAt = at;
    }
    visitor.updatedAt = Math.max(visitor.updatedAt, time);
  }
  function advanceOrdinary(visitor, time) {
    combat.advance(visitor, time);
    if (!visitor.health) return;
    const start = { x: visitor.x, y: visitor.y };
    const walkFrom = Math.max(visitor.updatedAt, visitor.immobileUntil || 0);
    const {
      x: rawX,
      y: rawY,
      walkedMs,
    } = sceneWalkWithSpeed(
      visitor,
      { x: visitor.targetX, y: visitor.targetY },
      Math.max(0, time - walkFrom),
      null,
      {
        slowMs: Math.max(0, (visitor.slowUntil || 0) - walkFrom),
        hasteMs: Math.max(0, (visitor.hasteUntil || 0) - walkFrom),
        speed: authorSpeed(visitor),
      },
    );
    energy.walk(visitor, Math.min(walkedMs, Math.max(0, time - walkFrom)));
    const shiftX = Math.floor(rawX / 100) * 100,
      shiftY = Math.floor(rawY / 100) * 100;
    visitor.x = rawX - shiftX;
    visitor.y = rawY - shiftY;
    visitor.targetX -= shiftX;
    visitor.targetY -= shiftY;
    if (shiftX || shiftY) visitor.wrapId = (visitor.wrapId || 0) + 1;
    combat.collect(
      visitor,
      shiftX || shiftY ? undefined : start,
      visitors.values(),
      time,
      Math.min(time, walkFrom),
    );
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
        teleportId: 0,
        wrapId: 0,
        updatedAt: time,
        facing: 'right',
        energy: expanded ? 0 : combatRules.energy.lobbyInitial,
        energyMaximum: combatRules.energy.lobbyMaximum,
        ordinaryHitEnergy: combatRules.energy.lobbyOrdinaryHit,
      };
      visitors.set(user.id, visitor);
    }
    arena.attach(visitor);
    visitor.name = user.display_name;
    visitor.seenAt = time;
    if (ENTRANCE_EFFECTS.has(entrance)) visitor.entrance = entrance;
    return visitor;
  }
  function canSee(viewerId, targetId, time) {
    targetId = targetId.split(':lower:')[0];
    if (viewerId === targetId || !arena.active(targetId) || arena.areAllies(viewerId, targetId))
      return true;
    const target = visitors.get(targetId);
    const bush = bushAt(bushes, target);
    if (
      !bush ||
      time < (target.bushRevealUntil || 0) ||
      (expanded && time - target.bushEnteredAt >= 1000)
    )
      return true;
    return arena.active(viewerId) && bushAt(bushes, visitors.get(viewerId)) === bush;
  }
  function view(user, { entrance } = {}) {
    enter(user, entrance);
    const time = now();
    for (const visitor of visitors.values()) advance(visitor, time);
    const visible = new Map();
    const canView = (id) => {
      if (!visible.has(id)) visible.set(id, canSee(user.id, id, time));
      return visible.get(id);
    };
    return {
      selfId: user.id,
      arena: {
        ...arena.view(visitors, user.id),
        ...pickups.view(),
        layoutId: arena.pickupScope() ? layoutId : 0,
        ...(wide && arena.pickupScope() ? { expanded: true } : {}),
        ...(arena.pickupScope() && activePortals.length
          ? {
              portals: activePortals.map(({ id, pair, x, y, exits }) => ({
                id,
                pair,
                x,
                y,
                exitCount: exits?.length || 1,
              })),
              portalRadius,
            }
          : {}),
        hazards: arena.pickupScope() && walls ? hazards.zones : [],
        bushes: arena.pickupScope() ? bushes : [],
      },
      attacks: attacks
        .filter((event) => event.until > time && canView(event.fromId) && canView(event.toId))
        .map((event) =>
          event.hits
            ? {
                ...event,
                hits: event.hits.filter((hit) => canView(hit.toId)),
              }
            : event,
        ),
      background: { ...background },
      barrages: barrages.filter((event) => time - event.at < 8000 && canView(event.playerId)),
      visitors: [...visitors.values()]
        .filter((visitor) => canView(visitor.id))
        .map((visitor) => ({
          ...combat.view(visitor, visitor.id === user.id),
          ...pickups.effects(visitor, time),
          id: visitor.id,
          name: visitor.name,
          archetype: visitor.archetype || null,
          concealed: !!(
            arena.active(visitor.id) &&
            bushAt(bushes, visitor) &&
            time >= (visitor.bushRevealUntil || 0) &&
            (!expanded || time - visitor.bushEnteredAt < 1000)
          ),
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
    const factor =
      arena.active(visitor.id) && walls ? arenaSpeed(visitor, time) : authorSpeed(visitor);
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
    if (input?.action === 'solve-equation') {
      if (Object.keys(input).some((key) => !['action', 'id', 'answer'].includes(key)))
        throw new HttpError(400, 'INVALID_EQUATION_ANSWER', '操作不正確');
      const visitor = enter(user);
      const time = now();
      advance(visitor, time);
      combat.solveEquation(visitor, input.id, input.answer, time);
      return view(user);
    }
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
    arena.assertStarted(visitor.id, time);
    advance(visitor, time);
    combat.canMove(visitor, time);
    if (arena.active(visitor.id) && walls) {
      const dest = step
        ? {
            x: visitor.x + input.dx * (wide ? 2.5 : 5),
            y: visitor.y + input.dy * (wide ? 2.5 : 5),
          }
        : { x: input.x, y: input.y };
      const target = expanded ? boundary(dest) : dest;
      visitor.wallRoute = step ? [walls.clip(visitor, target)] : walls.route(visitor, target);
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
    arena.assertStarted(self.id, time);
    if (
      !input ||
      typeof input !== 'object' ||
      typeof input.requestId !== 'string' ||
      !/^[a-zA-Z0-9-]{8,80}$/.test(input.requestId) ||
      !Number.isFinite(input.aspectRatio) ||
      input.aspectRatio < 0.2 ||
      input.aspectRatio > 5 ||
      (input.slot !== undefined && !['q', 'e', 'r'].includes(input.slot)) ||
      (input.effect !== undefined && !ATTACK_EFFECTS.has(input.effect)) ||
      Object.keys(input).some((k) => !['requestId', 'aspectRatio', 'slot', 'effect'].includes(k))
    )
      throw new HttpError(400, 'INVALID_ATTACK', '攻擊操作不正確');
    const slot = input.slot || 'q';
    const locked = arena.active(self.id) ? self.lockedAttackLoadout : null;
    const selected = locked ? locked[slot] : input.effect;
    if (slot === 'r' && !selected)
      throw new HttpError(409, 'NO_MULTI_ATTACK_LOADOUT', '請先在設定配裝 R 鍵多人招式');
    const effect = selected || 'barrage';
    const fingerprint = JSON.stringify([input.aspectRatio, slot, effect]);
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
    energy.check(self, slot, effect);
    const targets = selectAttackTargets(
      self,
      combat
        .targets(visitors.values())
        .filter(
          (actor) =>
            arena.canPair(self.id, actor.ownerId || actor.id) &&
            canSee(self.id, actor.ownerId || actor.id, time),
        ),
      effect,
      input.aspectRatio,
    );
    if (
      attacks.filter(
        (e) => !(e.head && e.fromId === self.id && effect.startsWith('shaohua_devour')),
      ).length >= 40
    )
      throw new HttpError(429, 'ATTACK_SCENE_BUSY', '場景特效較多，請稍候再試');
    const target = targets[0];
    if (!target) throw new HttpError(409, 'NO_ATTACK_TARGET', '目前沒有其他玩家可以互動');
    combat.alive(self);
    combat.canCast(self, time);
    energy.spend(self, slot);
    const defensive = target === self && attackKind(effect) !== 'susanoo';
    const reflection = attackKind(effect) === 'crystal_reflection';
    if (!defensive && arena.active(self.id)) self.bushRevealUntil = time + 2000;
    const hit =
      defensive && !reflection
        ? combat.protect(self, time, effect)
        : { damage: 0, critical: false };
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
    if (reflection) timeline.armReflection(event, self);
    else if (!defensive)
      timeline.prepare(
        event,
        self,
        targets,
        attackKind(effect) === 'bijuu_beam'
          ? combat
              .targets(visitors.values())
              .filter(
                (actor) =>
                  arena.canPair(self.id, actor.ownerId || actor.id) &&
                  canSee(self.id, actor.ownerId || actor.id, time),
              )
          : targets,
      );
    if (event.head)
      for (let i = attacks.length - 1; i >= 0; i--)
        if (attacks[i].head && attacks[i].fromId === self.id) attacks.splice(i, 1);
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
    arena.assertStarted(visitor.id, now());
    combat.advance(visitor, now());
    combat.canTeleport(visitor, now());
    const cost = combatRules.energy.lobbyTeleportCost;
    if (visitor.energy < cost)
      throw new HttpError(409, 'INSUFFICIENT_SCENE_ENERGY', `瞬移需要 ${cost} 點能量`);
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
      visitor.arenaPortalLocked = activePortals.some(
        (portal) => Math.hypot(x - portal.x, y - portal.y) <= portalRadius,
      );
    }
    visitor.x = visitor.targetX = x;
    visitor.y = visitor.targetY = y;
    visitor.updatedAt = now();
    visitor.moveId++;
    visitor.teleportId++;
    visitor.energy -= cost;
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
  function leaveArenaRoom(user) {
    arena.finish(now(), visitors);
    if (arena.active(user.id) && visitors.has(user.id)) {
      const matchId = arena.view(visitors).match.id;
      arena.command(user, { action: 'leave', matchId }, visitors, combat.reset);
    }
    visitors.delete(user.id);
    arena.view(visitors);
  }
  return {
    leaveArenaRoom,
    hasActiveArenaPlayer: arena.active,
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
