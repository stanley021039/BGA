import attackEffects from '../../../public/shared/attack-effects.json';
import attackTiming from '../../../public/shared/attack-timing.json';
import { validPassage, type Passage } from '../engines/scene-path.js';
import backgrounds from '../../../public/shared/lobby-backgrounds.json';
import { readBarrages, type BarrageEvent } from './social';
import { array, record, text } from '../services/validation';
import { isGameType, type GameType } from './room';
import { readPingContext, type PingContext } from './pings';
import { isEntranceEffect, type EntranceEffectId } from '../services/entrance-effects';

export interface PublicRoom {
  code: string;
  name: string;
  type: GameType;
  phase: string;
  playerCount: number;
  maxPlayers: number;
  seated: boolean;
  kicked: boolean;
  joinable: boolean;
}
export interface LobbyEmote {
  id: string;
  image: string;
  label: string;
  at: number;
  until: number;
  sound?: { url: string; durationMs: number };
}
export interface SceneCombatStatus {
  authorBonus: boolean;
  guanyin: boolean;
  excalibur: boolean;
  shield: 'none' | 'full' | 'residual';
  regenerating: boolean;
  regenWaitMs: number;
  regenBlockedMs?: number;
  regenPerSecond: number;
}
export interface LobbyVisitor {
  energy?: number;
  energyMaximum?: number;
  combatStatus?: SceneCombatStatus;
  severed?: boolean;
  immobileUntil?: number;
  knockback?: { id: string; fromX: number; fromY: number; at: number } | null;
  dotPulse?: { id: string; damage: number; critical: boolean; at: number } | null;
  fragment?: { id: string; x: number; y: number; health: number; maxHealth: number } | null;
  kda?: { kills: number; deaths: number; assists: number };
  passage?: Passage | null;
  health?: number;
  maxHealth?: number;
  respawnAt?: number;
  respawnRemainingMs?: number;
  id: string;
  name: string;
  image: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  moveId: number;
  teleportId: number;
  wrapId: number;
  remainingMs: number;
  moving: boolean;
  facing: 'left' | 'right';
  emote: LobbyEmote | null;
  entrance: EntranceEffectId;
}
export interface LobbyAttackHit {
  aimX?: number;
  aimY?: number;
  phase?: string;
  delayMs?: number;
  pending?: boolean;
  missed?: boolean;
  toId: string;
  toX: number;
  toY: number;
  damage: number;
  critical: boolean;
}
export interface LobbyAttack {
  rays?: { x: number; y: number }[];
  ageMs?: number;
  hits?: LobbyAttackHit[];
  aspectRatio?: number;
  damage?: number;
  critical?: boolean;
  effect: string;
  slot: 'q' | 'e' | 'r';
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  at: number;
  until: number;
}
export interface LobbySnapshot {
  attacks: LobbyAttack[];
  background: { id: string; changedAt: number; nextChangeAt: number };
  barrages: BarrageEvent[];
  selfId: string;
  serverNow: number;
  visitors: LobbyVisitor[];
  pingContext: PingContext | null;
}
export interface LobbyExpression {
  expression: string;
  image: string;
  label: string;
}
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const coordinate = (value: unknown): value is number => finite(value) && value >= 0 && value <= 100;
const counter = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
export function readPublicRooms(value: unknown): PublicRoom[] {
  return array(record(value).rooms).map((value) => {
    const row = record(value);
    if (
      !/^[a-f0-9]{6}$/i.test(text(row.code)) ||
      !isGameType(row.type) ||
      !text(row.name) ||
      !text(row.phase) ||
      !Number.isSafeInteger(row.playerCount) ||
      Number(row.playerCount) < 0 ||
      !Number.isSafeInteger(row.maxPlayers) ||
      Number(row.maxPlayers) < 1 ||
      !['seated', 'kicked', 'joinable'].every((key) => typeof row[key] === 'boolean')
    )
      throw Error('房間列表資料格式不正確。');
    return {
      code: text(row.code).toUpperCase(),
      type: row.type,
      name: text(row.name),
      phase: text(row.phase),
      playerCount: Number(row.playerCount),
      maxPlayers: Number(row.maxPlayers),
      seated: row.seated === true,
      kicked: row.kicked === true,
      joinable: row.joinable === true,
    };
  });
}
export function readLobbySnapshot(value: unknown): LobbySnapshot {
  const row = record(value);
  if (!text(row.selfId) || !finite(row.serverNow)) throw Error('大廳身分資料格式不正確。');
  const visitors = array(row.visitors).map((value) => {
    const item = record(value);
    if (
      !text(item.id) ||
      !text(item.name) ||
      !text(item.image) ||
      ![item.x, item.y].every(coordinate) ||
      ![item.targetX, item.targetY].every((v) => finite(v) && v >= -5 && v <= 105) ||
      !Number.isSafeInteger(item.moveId) ||
      Number(item.moveId) < 0 ||
      !finite(item.remainingMs) ||
      item.remainingMs < 0 ||
      typeof item.moving !== 'boolean' ||
      !['left', 'right'].includes(text(item.facing))
    )
      throw Error('大廳角色資料格式不正確。');
    let emote: LobbyEmote | null = null;
    if (item.emote) {
      const entry = record(item.emote);
      if (
        !text(entry.id) ||
        !text(entry.image) ||
        !text(entry.label) ||
        !finite(entry.at) ||
        !finite(entry.until) ||
        entry.until <= entry.at
      )
        throw Error('大廳表情資料格式不正確。');
      const sound = entry.sound ? record(entry.sound) : null;
      if (
        sound &&
        (!text(sound.url) ||
          !finite(sound.durationMs) ||
          sound.durationMs <= 0 ||
          sound.durationMs > 10000)
      )
        throw Error('大廳音效資料格式不正確。');
      emote = {
        id: text(entry.id),
        image: text(entry.image),
        label: text(entry.label),
        at: entry.at,
        until: entry.until,
        ...(sound ? { sound: { url: text(sound.url), durationMs: Number(sound.durationMs) } } : {}),
      };
    }
    return {
      kda: {
        kills: counter(item.kda && record(item.kda).kills),
        deaths: counter(item.kda && record(item.kda).deaths),
        assists: counter(item.kda && record(item.kda).assists),
      },
      immobileUntil: finite(item.immobileUntil) ? item.immobileUntil : 0,
      severed: item.severed === true,
      fragment: (() => {
        if (!item.fragment) return null;
        const part = record(item.fragment);
        if (
          !text(part.id) ||
          !coordinate(part.x) ||
          !coordinate(part.y) ||
          !finite(part.health) ||
          !finite(part.maxHealth) ||
          part.health <= 0 ||
          part.health > part.maxHealth
        )
          throw Error('下半身資料格式不正確。');
        return {
          id: text(part.id),
          x: part.x,
          y: part.y,
          health: part.health,
          maxHealth: part.maxHealth,
        };
      })(),
      knockback: (() => {
        if (!item.knockback) return null;
        const pulse = record(item.knockback);
        if (
          !text(pulse.id) ||
          !coordinate(pulse.fromX) ||
          !coordinate(pulse.fromY) ||
          !finite(pulse.at)
        )
          throw Error('擊飛資料格式不正確。');
        return { id: text(pulse.id), fromX: pulse.fromX, fromY: pulse.fromY, at: pulse.at };
      })(),
      dotPulse: (() => {
        if (!item.dotPulse) return null;
        const pulse = record(item.dotPulse);
        if (
          !text(pulse.id) ||
          !Number.isSafeInteger(pulse.damage) ||
          Number(pulse.damage) < 0 ||
          !finite(pulse.at) ||
          typeof pulse.critical !== 'boolean'
        )
          throw Error('持續傷害資料格式不正確。');
        return {
          id: text(pulse.id),
          damage: Number(pulse.damage),
          critical: pulse.critical,
          at: pulse.at,
        };
      })(),
      passage: validPassage(item.passage) ? item.passage : null,
      respawnRemainingMs: finite(item.respawnAt)
        ? Math.max(0, item.respawnAt - Number(row.serverNow))
        : 0,
      combatStatus: (() => {
        if (item.combatStatus === undefined) return undefined;
        const status = record(item.combatStatus);
        if (
          !['authorBonus', 'guanyin', 'excalibur', 'regenerating'].every(
            (key) => typeof status[key] === 'boolean',
          ) ||
          !['none', 'full', 'residual'].includes(text(status.shield)) ||
          !finite(status.regenWaitMs) ||
          status.regenWaitMs < 0 ||
          status.regenWaitMs > 5000 ||
          (status.regenBlockedMs !== undefined &&
            (!finite(status.regenBlockedMs) ||
              status.regenBlockedMs < 0 ||
              status.regenBlockedMs > 5000)) ||
          !Number.isSafeInteger(status.regenPerSecond) ||
          Number(status.regenPerSecond) <= 0
        )
          throw Error('自身戰鬥狀態格式不正確。');
        return {
          authorBonus: status.authorBonus === true,
          guanyin: status.guanyin === true,
          excalibur: status.excalibur === true,
          shield: status.shield as SceneCombatStatus['shield'],
          regenerating: status.regenerating === true,
          regenWaitMs: status.regenWaitMs,
          regenBlockedMs: Number(status.regenBlockedMs || 0),
          regenPerSecond: Number(status.regenPerSecond),
        };
      })(),
      energy: Math.min(100, counter(item.energy)),
      energyMaximum: 100,
      health: finite(item.health) ? item.health : undefined,
      maxHealth: finite(item.maxHealth) ? item.maxHealth : undefined,
      respawnAt: finite(item.respawnAt) ? item.respawnAt : undefined,
      id: text(item.id),
      name: text(item.name),
      image: text(item.image),
      x: Number(item.x),
      y: Number(item.y),
      targetX: Number(item.targetX),
      targetY: Number(item.targetY),
      moveId: Number(item.moveId),
      wrapId:
        Number.isSafeInteger(item.wrapId) && Number(item.wrapId) >= 0 ? Number(item.wrapId) : 0,
      teleportId:
        Number.isSafeInteger(item.teleportId) && Number(item.teleportId) >= 0
          ? Number(item.teleportId)
          : 0,
      remainingMs: item.remainingMs,
      moving: item.moving,
      facing: item.facing as 'left' | 'right',
      emote,
      entrance: isEntranceEffect(item.entrance) ? item.entrance : 'classic',
    };
  });
  if (
    new Set(visitors.map((visitor) => visitor.id)).size !== visitors.length ||
    !visitors.some((visitor) => visitor.id === row.selfId)
  )
    throw Error('大廳角色身分不一致。');
  return {
    // Older lobby servers sent plain messages without the room event discriminator.
    barrages: readBarrages(
      array(row.barrages).map((value) => {
        const item = record(value);
        return item.kind === undefined ? { ...item, kind: 'barrage' } : item;
      }),
    ),
    attacks: array(row.attacks || [])
      .slice(-40)
      .map((value) => {
        const a = record(value);
        if (
          !['id', 'fromId', 'toId', 'fromName', 'toName'].every((k) => text(a[k])) ||
          ![a.fromX, a.fromY, a.toX, a.toY].every(coordinate) ||
          !finite(a.at) ||
          !finite(a.until) ||
          ![1800, 4400].includes(a.until - a.at)
        )
          throw Error('大廳攻擊資料格式不正確。');
        return {
          ...(a.rays !== undefined
            ? (() => {
                if (a.effect !== 'bijuu_beam' || !Array.isArray(a.rays) || a.rays.length !== 3)
                  throw Error('尾獸玉射線資料格式不正確。');
                return {
                  rays: a.rays.map((value) => {
                    const ray = record(value);
                    if (!coordinate(ray.x) || !coordinate(ray.y))
                      throw Error('尾獸玉射線方向不正確。');
                    return { x: ray.x, y: ray.y };
                  }),
                };
              })()
            : {}),
          ...(a.hits !== undefined
            ? (() => {
                const stages = attackTiming[a.effect as keyof typeof attackTiming] || [];
                if (
                  !Array.isArray(a.hits) ||
                  a.hits.length > Math.min(160, Math.max(1, stages.length) * 32)
                )
                  throw Error('範圍攻擊資料格式不正確。');
                const hits = a.hits.map((value) => {
                  const hit = record(value);
                  if (
                    !text(hit.toId) ||
                    hit.toId === a.fromId ||
                    ![hit.toX, hit.toY].every(coordinate) ||
                    !Number.isSafeInteger(hit.damage) ||
                    Number(hit.damage) < 0 ||
                    typeof hit.critical !== 'boolean' ||
                    ((hit.aimX !== undefined || hit.aimY !== undefined) &&
                      ![hit.aimX, hit.aimY].every(coordinate))
                  )
                    throw Error('範圍攻擊目標資料格式不正確。');
                  return {
                    ...(hit.aimX !== undefined && coordinate(hit.aimX) && coordinate(hit.aimY)
                      ? { aimX: hit.aimX, aimY: hit.aimY }
                      : {}),
                    ...(hit.phase !== undefined
                      ? (() => {
                          if (
                            !stages.some((stage) => stage[2] === hit.phase) ||
                            !finite(hit.delayMs) ||
                            hit.delayMs < 0 ||
                            hit.delayMs > 4100 ||
                            typeof hit.pending !== 'boolean' ||
                            (hit.missed !== undefined && typeof hit.missed !== 'boolean')
                          )
                            throw Error('攻擊階段資料格式不正確。');
                          return {
                            phase: text(hit.phase),
                            delayMs: Number(hit.delayMs),
                            pending: hit.pending,
                            ...(hit.missed !== undefined ? { missed: hit.missed === true } : {}),
                          };
                        })()
                      : {}),
                    toId: text(hit.toId),
                    toX: Number(hit.toX),
                    toY: Number(hit.toY),
                    damage: Number(hit.damage),
                    critical: hit.critical,
                  };
                });
                if (
                  new Set(hits.map((hit) => hit.toId + ':' + (hit.phase || 'legacy'))).size !==
                    hits.length ||
                  new Set(hits.map((hit) => hit.toId)).size > 32 ||
                  !finite(a.aspectRatio) ||
                  a.aspectRatio < 0.2 ||
                  a.aspectRatio > 5
                )
                  throw Error('範圍攻擊目標重複或比例不正確。');
                return { hits, aspectRatio: a.aspectRatio };
              })()
            : {}),
          damage: finite(a.damage) ? Math.max(0, a.damage) : undefined,
          critical: a.critical === true,
          effect: attackEffects.some((e) => e.id === a.effect) ? String(a.effect) : 'barrage',
          slot: a.slot === 'r' ? 'r' : a.slot === 'e' ? 'e' : 'q',
          id: text(a.id),
          fromId: text(a.fromId),
          toId: text(a.toId),
          fromName: text(a.fromName),
          toName: text(a.toName),
          fromX: Number(a.fromX),
          fromY: Number(a.fromY),
          toX: Number(a.toX),
          toY: Number(a.toY),
          at: a.at,
          until: a.until,
        };
      }),
    selfId: text(row.selfId),
    background: (() => {
      const bg = record(row.background || {});
      return {
        id: backgrounds.some((item) => item.id === bg.id) ? String(bg.id) : 'default',
        changedAt: finite(bg.changedAt) ? bg.changedAt : 0,
        nextChangeAt: finite(bg.nextChangeAt) ? bg.nextChangeAt : 0,
      };
    })(),
    serverNow: row.serverNow,
    visitors,
    pingContext: readPingContext(row.pingContext),
  };
}
export function readLobbyExpressions(value: unknown): LobbyExpression[] {
  return array(record(value).emotes).map((value) => {
    const row = record(value);
    if (
      !text(row.expression) ||
      row.expression === 'neutral' ||
      !text(row.image) ||
      !text(row.label)
    )
      throw Error('大廳表情選項格式不正確。');
    return { expression: text(row.expression), image: text(row.image), label: text(row.label) };
  });
}
