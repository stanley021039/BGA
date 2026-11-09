'use strict';
const { randomInt, randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { types, profile } = require('./archetypes');
const covers = Object.freeze([
  Object.freeze({ id: 'west', x: 18, y: 83, width: 5, height: 5 }),
  Object.freeze({ id: 'center', x: 43, y: 90, width: 6, height: 4 }),
  Object.freeze({ id: 'east', x: 70, y: 82, width: 5, height: 5 }),
]);
const { attackKind } = require('./attack-kind');
// Walls stop eligible ordinary attacks and reduce other covered hits by 25%.
const coveredEffects = Object.freeze([
  'barrage',
  'beam',
  'blade_aura',
  'blade_aura_crimson',
  'bijuu_beam',
  'funnel',
  'plasma_pulse',
  'micro_missiles',
  'photon_sniper',
]);
const coverDamage = 0.75;
function entryTime(from, to, box) {
  let low = 0,
    high = 1;
  for (const [axis, size] of [
    ['x', 'width'],
    ['y', 'height'],
  ]) {
    const delta = to[axis] - from[axis];
    if (Math.abs(delta) < 1e-10) {
      if (from[axis] < box[axis] || from[axis] > box[axis] + box[size]) return null;
    } else {
      const a = (box[axis] - from[axis]) / delta;
      const b = (box[axis] + box[size] - from[axis]) / delta;
      low = Math.max(low, Math.min(a, b));
      high = Math.min(high, Math.max(a, b));
      if (low > high) return null;
    }
  }
  return low;
}
function intersects(from, to, box) {
  return entryTime(from, to, box) !== null;
}
function coverDamageMultiplier(from, to, effect, obstacles = covers) {
  const kind = attackKind(effect);
  const blocked = coveredEffects.includes(kind);
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return 1;
  if (!obstacles.some((box) => intersects(from, to, box))) return 1;
  if (blocked) return 0;
  return coverDamage;
}
function behindCover(from, to, effect) {
  return coverDamageMultiplier(from, to, effect) === 0;
}
function createLobbyArena(
  now,
  geometry = { covers },
  onStart = () => {},
  fillPracticeTeams,
  startDelayMs = 0,
  requireReady = false,
  getMaps = () => [],
) {
  const profiles = new Map();
  function clearProfile(actor) {
    const factor = profile(actor).health;
    if (factor !== 1) {
      actor.maxHealth = Math.round(actor.maxHealth / factor);
      actor.health = Math.min(actor.maxHealth, Math.round(actor.health / factor));
    }
    actor.archetype = null;
    actor.lockedAttackLoadout = null;
    actor.wallRoute = [];
  }
  const teams = new Map();
  const ready = new Set();
  let match = null;
  const fail = (code, message) => {
    throw new HttpError(409, code, message);
  };
  const member = (id) => match?.players.find((p) => p.id === id);
  function active(id) {
    return match?.phase === 'running' && !member(id)?.forfeited && !!member(id);
  }
  function areAllies(a, b) {
    return match?.mode === 'team' && active(a) && active(b) && member(a).team === member(b).team;
  }
  function canPair(fromId, toId) {
    const a = active(fromId),
      b = active(toId);
    if (!a && !b) return true;
    if (!a || !b) return false;
    return match.mode === 'pk' || member(fromId).team !== member(toId).team;
  }
  function canContinueCast(source, actor, time) {
    if ((source.combatEpoch || 0) !== (actor.combatEpoch || 0)) return false;
    if (!source.matchId) return !active(actor.id);
    return match?.id === source.matchId && active(actor.id) && time < match.endsAt;
  }
  function canHit(from, to, time, effect) {
    const targetId = to.ownerId || to.id;
    if ((from.combatEpoch || 0) !== (to.owner?.combatEpoch || to.combatEpoch || 0)) return false;
    if (from.matchId) {
      if (
        match?.id !== from.matchId ||
        match.phase !== 'running' ||
        time < match.startedAt ||
        time >= match.endsAt ||
        !active(from.id) ||
        !active(targetId) ||
        !canPair(from.id, targetId)
      )
        return false;
    } else return !active(from.id) && !active(targetId);
    return damageThroughCover(from, to, effect) > 0;
  }
  function coverImpact(from, to, time, effect) {
    if (
      !from.matchId ||
      from.slot === 'r' ||
      match?.id !== from.matchId ||
      time >= match.endsAt ||
      !active(from.id) ||
      !active(to.ownerId || to.id) ||
      !canPair(from.id, to.ownerId || to.id) ||
      !coveredEffects.includes(attackKind(effect))
    )
      return null;
    const start = { x: from.originX, y: from.originY };
    if (![start.x, start.y, to.x, to.y].every(Number.isFinite)) return null;
    let first = Infinity;
    for (const box of geometry.covers) {
      const entry = entryTime(start, to, box);
      if (entry !== null) first = Math.min(first, entry);
    }
    if (!Number.isFinite(first)) return null;
    return { x: start.x + (to.x - start.x) * first, y: start.y + (to.y - start.y) * first };
  }
  function damageThroughCover(from, to, effect) {
    if (!from.matchId) return 1;
    const multiplier = coverDamageMultiplier(
      { x: from.originX, y: from.originY },
      to,
      effect,
      geometry.covers,
    );
    return from.slot === 'r' && multiplier === 0 ? coverDamage : multiplier;
  }
  function onHit(from, to, time, damage) {
    if (
      !from.matchId ||
      !damage ||
      to.kind === 'fragment' ||
      !from.castId ||
      match?.id !== from.matchId ||
      time >= match.endsAt
    )
      return;
    const key = from.castId + ':' + to.id;
    if (match.scored.has(key)) return;
    match.scored.add(key);
    member(from.id).score++;
  }
  function onDamage(from, to, time, damage) {
    if (
      !damage ||
      to.kind === 'fragment' ||
      !from.matchId ||
      match?.id !== from.matchId ||
      !active(from.id) ||
      !active(to.id) ||
      time < match.startedAt ||
      time >= match.endsAt ||
      !canPair(from.id, to.id)
    )
      return;
    member(from.id).damageDealt += damage;
    member(to.id).damageTaken += damage;
  }
  function onEnvironmentDamage(actor, time, damage) {
    if (!damage || !active(actor.id) || time < match.startedAt || time >= match.endsAt) return;
    member(actor.id).damageTaken += damage;
    member(actor.id).trapDamageTaken += damage;
  }
  function finish(time, visitors) {
    if (match?.phase !== 'running' || time < match.endsAt) return;
    match.phase = 'finished';
    const eligible = match.players.filter((p) => !p.forfeited);
    const red = eligible.filter((p) => p.team === 'red').reduce((n, p) => n + p.score, 0);
    const blue = eligible.filter((p) => p.team === 'blue').reduce((n, p) => n + p.score, 0);
    const remainingTeams = [...new Set(eligible.map((p) => p.team))];
    match.winners = !eligible.length
      ? []
      : match.mode === 'team'
        ? remainingTeams.length === 1
          ? remainingTeams
          : red === blue
            ? ['red', 'blue']
            : [red > blue ? 'red' : 'blue']
        : eligible
            .filter((p) => p.score === Math.max(...eligible.map((p) => p.score)))
            .map((p) => p.id);
    match.scored.clear();
    for (const id of match.practiceBots || []) teams.delete(id);
    for (const actor of visitors.values()) {
      if (actor.matchId !== match.id) continue;
      actor.matchId = null;
      clearProfile(actor);
      actor.combatEpoch = 0;
      actor.drillDot = null;
      actor.pickupSpeedAt =
        actor.pickupSpeedUntil =
        actor.pickupShieldUntil =
        actor.pickupAttackUntil =
          0;
      actor.lastPickup = null;
    }
  }
  function command(user, input, visitors, reset) {
    if (
      !input ||
      typeof input !== 'object' ||
      Object.keys(input).some(
        (key) =>
          ![
            'action',
            'team',
            'mode',
            'matchId',
            'archetype',
            'durationSeconds',
            'ready',
            'mapId',
          ].includes(key),
      )
    )
      throw new HttpError(400, 'INVALID_ARENA', '對戰操作不正確');
    const time = now();
    finish(time, visitors);
    if (input.action === 'archetype') {
      if (!Object.hasOwn(types, input.archetype))
        throw new HttpError(400, 'INVALID_ARCHETYPE', '請選擇有效角色類型');
      if (active(user.id)) fail('ARENA_LOCKED', '對戰中不能更換類型');
      if (profiles.get(user.id) !== input.archetype) ready.delete(user.id);
      profiles.set(user.id, input.archetype);
    } else if (input.action === 'team') {
      if (!['red', 'blue', 'random', null].includes(input.team))
        throw new HttpError(400, 'INVALID_TEAM', '請選擇綠隊或藍隊');
      if (active(user.id)) fail('ARENA_LOCKED', '對戰中不能更換隊伍，請先棄權');
      const counts = { red: 0, blue: 0 };
      for (const [id, team] of teams) if (id !== user.id) counts[team]++;
      let team = input.team;
      if (team === 'random') {
        team =
          counts.red === counts.blue
            ? ['red', 'blue'][randomInt(2)]
            : counts.red < counts.blue
              ? 'red'
              : 'blue';
      }
      if (team && counts[team] >= 8) fail('TEAM_FULL', '這隊已滿 8 人');
      if (teams.get(user.id) !== team) ready.delete(user.id);
      if (team) teams.set(user.id, team);
      else teams.delete(user.id);
    } else if (input.action === 'ready') {
      if (match?.phase === 'running') fail('ARENA_RUNNING', '目前已有一場對戰');
      if (!teams.has(user.id)) fail('ARENA_JOIN_REQUIRED', '請先選隊報名');
      if (typeof input.ready !== 'boolean')
        throw new HttpError(400, 'INVALID_ARENA', '準備狀態不正確');
      if (input.ready) ready.add(user.id);
      else ready.delete(user.id);
    } else if (input.action === 'start') {
      if (match?.phase === 'running') fail('ARENA_RUNNING', '目前已有一場對戰');
      // Expected prior match makes concurrent starts and a retried start safe.
      if ((input.matchId ?? null) !== (match?.id ?? null))
        fail('ARENA_CHANGED', '對戰已更新，請重新確認');
      if (!['pk', 'team'].includes(input.mode))
        throw new HttpError(400, 'INVALID_MODE', '請選擇個人 PK 或團隊戰');
      const duration = input.durationSeconds ?? 60;
      if (![60, 120, 180].includes(duration))
        throw new HttpError(400, 'INVALID_ARENA_DURATION', '請選擇 60、120 或 180 秒');
      const maps = getMaps();
      const map = maps.find((item) => item.id === (input.mapId ?? 1));
      if (maps.length && (!map || (duration === 60 && map.wide)))
        throw new HttpError(400, 'INVALID_ARENA_MAP', '60 秒對戰請選小地圖，其他場次可選任一地圖');
      if (!teams.has(user.id)) fail('ARENA_JOIN_REQUIRED', '請先選隊報名');
      if (requireReady && [...teams.keys()].some((id) => visitors.has(id) && !ready.has(id)))
        fail('ARENA_NOT_READY', '等所有報名玩家按下準備');
      const practiceBots = input.mode === 'team' ? fillPracticeTeams?.(teams, user) : undefined;
      const players = [...teams]
        .filter(([id]) => visitors.has(id))
        .map(([id, team]) => ({
          id,
          team,
          name: visitors.get(id).name,
          archetype: profiles.get(id) || 'attack',
          score: 0,
          damageDealt: 0,
          damageTaken: 0,
          trapDamageTaken: 0,
          forfeited: false,
        }));
      if (input.mode === 'pk' && players.length !== 2)
        fail('ARENA_PLAYERS', '個人 PK 需要剛好兩位報名者');
      if (
        input.mode === 'team' &&
        !['red', 'blue'].every((team) => players.some((p) => p.team === team))
      )
        fail('ARENA_PLAYERS', '團隊戰需要兩隊各至少一人');
      onStart(visitors, players, map);
      ready.clear();
      match = {
        id: randomUUID(),
        phase: 'running',
        mode: input.mode,
        startedAt: time + startDelayMs,
        endsAt: time + startDelayMs + duration * 1000,
        players,
        winners: [],
        scored: new Set(),
        practiceBots,
      };
      for (const p of players) {
        const actor = visitors.get(p.id);
        actor.archetype = p.archetype;
        reset(actor, time);
        actor.lastAttacks = {};
        actor.matchId = actor.combatEpoch = match.id;
      }
    } else if (input.action === 'leave') {
      if (input.matchId !== match?.id || !active(user.id))
        fail('ARENA_CHANGED', '目前沒有可退出的對戰');
      member(user.id).forfeited = true;
      const actor = visitors.get(user.id);
      actor.matchId = null;
      clearProfile(actor);
      actor.combatEpoch = 0;
      actor.drillDot = null;
      actor.pickupSpeedAt =
        actor.pickupSpeedUntil =
        actor.pickupShieldUntil =
        actor.pickupAttackUntil =
          0;
      actor.lastPickup = null;
      teams.delete(user.id);
    } else throw new HttpError(400, 'INVALID_ARENA', '對戰操作不正確');
  }
  function attach(actor) {
    if (active(actor.id)) actor.matchId = actor.combatEpoch = match.id;
  }
  function view(visitors, viewerId) {
    for (const id of profiles.keys()) if (!visitors.has(id) && !active(id)) profiles.delete(id);
    for (const id of teams.keys()) {
      if (visitors.has(id) || active(id)) continue;
      teams.delete(id);
      ready.delete(id);
    }
    return {
      covers: match?.phase === 'running' ? geometry.covers : [],
      coveredEffects,
      ...(requireReady && match?.phase !== 'running'
        ? { maps: getMaps().map(({ id, name, wide, preview }) => ({ id, name, wide, preview })) }
        : {}),
      ...(viewerId ? { ownArchetype: profiles.get(viewerId) || 'attack' } : {}),
      teams: [...teams].map(([id, team]) => ({
        id,
        team,
        archetype: profiles.get(id) || 'attack',
        ready: ready.has(id),
      })),
      match: match
        ? {
            id: match.id,
            phase: match.phase,
            mode: match.mode,
            startedAt: match.startedAt,
            endsAt: match.endsAt,
            remainingMs: Math.max(0, match.endsAt - now()),
            players: match.players.map((p) => ({ ...p })),
            winners: [...match.winners],
          }
        : null,
    };
  }
  return {
    canHit,
    canContinueCast,
    damageThroughCover,
    coverImpact,
    active,
    preparing: (id, time) => active(id) && time < match.startedAt,
    assertStarted(id, time) {
      if (active(id) && time < match.startedAt) fail('ARENA_COUNTDOWN', '倒數結束後即可行動');
    },
    deadline: (id) => (active(id) ? match.endsAt : null),
    onHit,
    onDamage,
    onEnvironmentDamage,
    canPair,
    areAllies,
    command,
    finish,
    attach,
    view,
    pickupScope: () => (match?.phase === 'running' ? match.id : null),
    canCollect: (id, time) =>
      match?.phase === 'running' && time >= match.startedAt && time < match.endsAt && active(id),
  };
}
module.exports = {
  createLobbyArena,
  covers,
  coveredEffects,
  intersects,
  behindCover,
  coverDamageMultiplier,
};
