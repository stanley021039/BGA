'use strict';
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { types, profile } = require('./archetypes');
const covers = Object.freeze([
  Object.freeze({ id: 'west', x: 18, y: 83, width: 5, height: 5 }),
  Object.freeze({ id: 'center', x: 43, y: 90, width: 6, height: 4 }),
  Object.freeze({ id: 'east', x: 70, y: 82, width: 5, height: 5 }),
]);
// Explicit first-version contract: all other artwork bypasses cover.
const coveredEffects = Object.freeze([
  'barrage',
  'beam',
  'blade_aura',
  'blade_aura_crimson',
  'bijuu_beam',
]);
function intersects(from, to, box) {
  let low = 0,
    high = 1;
  for (const [axis, size] of [
    ['x', 'width'],
    ['y', 'height'],
  ]) {
    const delta = to[axis] - from[axis];
    if (Math.abs(delta) < 1e-10) {
      if (from[axis] < box[axis] || from[axis] > box[axis] + box[size]) return false;
    } else {
      const a = (box[axis] - from[axis]) / delta;
      const b = (box[axis] + box[size] - from[axis]) / delta;
      low = Math.max(low, Math.min(a, b));
      high = Math.min(high, Math.max(a, b));
      if (low > high) return false;
    }
  }
  return true;
}
function behindCover(from, to, effect) {
  return (
    [from.x, from.y, to.x, to.y].every(Number.isFinite) &&
    coveredEffects.includes(effect) &&
    covers.some((box) => intersects(from, to, box))
  );
}
function createLobbyArena(now, geometry = { covers }, onStart = () => {}) {
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
  let match = null;
  const fail = (code, message) => {
    throw new HttpError(409, code, message);
  };
  const member = (id) => match?.players.find((p) => p.id === id);
  function active(id) {
    return match?.phase === 'running' && !member(id)?.forfeited && !!member(id);
  }
  function canPair(fromId, toId) {
    const a = active(fromId),
      b = active(toId);
    if (!a && !b)
      return !teams.has(fromId) || !teams.has(toId) || teams.get(fromId) !== teams.get(toId);
    if (!a || !b) return false;
    return match.mode === 'pk' || member(fromId).team !== member(toId).team;
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
    } else if (active(from.id) || active(targetId) || !canPair(from.id, targetId)) return false;
    return !(
      [from.originX, from.originY, to.x, to.y].every(Number.isFinite) &&
      coveredEffects.includes(effect) &&
      geometry.covers.some((box) => intersects({ x: from.originX, y: from.originY }, to, box))
    );
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
        (key) => !['action', 'team', 'mode', 'matchId', 'archetype'].includes(key),
      )
    )
      throw new HttpError(400, 'INVALID_ARENA', '對戰操作不正確');
    const time = now();
    finish(time, visitors);
    if (input.action === 'archetype') {
      if (!Object.hasOwn(types, input.archetype))
        throw new HttpError(400, 'INVALID_ARCHETYPE', '請選擇有效角色類型');
      if (active(user.id)) fail('ARENA_LOCKED', '對戰中不能更換類型');
      profiles.set(user.id, input.archetype);
    } else if (input.action === 'team') {
      if (!['red', 'blue', null].includes(input.team))
        throw new HttpError(400, 'INVALID_TEAM', '請選擇紅隊或藍隊');
      if (active(user.id)) fail('ARENA_LOCKED', '對戰中不能更換隊伍，請先棄權');
      if (
        input.team &&
        teams.get(user.id) !== input.team &&
        [...teams.values()].filter((t) => t === input.team).length >= 8
      )
        fail('TEAM_FULL', '這隊已滿 8 人');
      if (input.team) teams.set(user.id, input.team);
      else teams.delete(user.id);
    } else if (input.action === 'start') {
      if (match?.phase === 'running') fail('ARENA_RUNNING', '目前已有一場對戰');
      // Expected prior match makes concurrent starts and a retried start safe.
      if ((input.matchId ?? null) !== (match?.id ?? null))
        fail('ARENA_CHANGED', '對戰已更新，請重新確認');
      if (!['pk', 'team'].includes(input.mode))
        throw new HttpError(400, 'INVALID_MODE', '請選擇個人 PK 或團隊戰');
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
      if (!teams.has(user.id)) fail('ARENA_JOIN_REQUIRED', '請先選隊報名');
      if (input.mode === 'pk' && players.length !== 2)
        fail('ARENA_PLAYERS', '個人 PK 需要剛好兩位報名者');
      if (
        input.mode === 'team' &&
        !['red', 'blue'].every((team) => players.some((p) => p.team === team))
      )
        fail('ARENA_PLAYERS', '團隊戰需要兩隊各至少一人');
      onStart(visitors, players);
      match = {
        id: randomUUID(),
        phase: 'running',
        mode: input.mode,
        startedAt: time,
        endsAt: time + 60000,
        players,
        winners: [],
        scored: new Set(),
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
  function view(visitors) {
    for (const id of profiles.keys()) if (!visitors.has(id) && !active(id)) profiles.delete(id);
    for (const id of teams.keys()) if (!visitors.has(id) && !active(id)) teams.delete(id);
    return {
      covers: geometry.covers,
      coveredEffects,
      teams: [...teams].map(([id, team]) => ({
        id,
        team,
        archetype: profiles.get(id) || 'attack',
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
    active,
    deadline: (id) => (active(id) ? match.endsAt : null),
    onHit,
    onDamage,
    onEnvironmentDamage,
    canPair,
    command,
    finish,
    attach,
    view,
    pickupScope: () => (match?.phase === 'running' ? match.id : null),
    canCollect: (id, time) => match?.phase !== 'running' || (time < match.endsAt && active(id)),
  };
}
module.exports = { createLobbyArena, covers, coveredEffects, intersects, behindCover };
