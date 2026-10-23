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
export interface LobbyVisitor {
  id: string;
  name: string;
  image: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  moveId: number;
  teleportId: number;
  remainingMs: number;
  moving: boolean;
  facing: 'left' | 'right';
  emote: LobbyEmote | null;
  entrance: EntranceEffectId;
}
export interface LobbySnapshot {
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
      ![item.x, item.y, item.targetX, item.targetY].every(coordinate) ||
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
      id: text(item.id),
      name: text(item.name),
      image: text(item.image),
      x: Number(item.x),
      y: Number(item.y),
      targetX: Number(item.targetX),
      targetY: Number(item.targetY),
      moveId: Number(item.moveId),
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
