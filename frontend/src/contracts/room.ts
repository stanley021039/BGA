import { array, record, text } from '../services/validation';

export const gameTypes = ['poker', 'thunder', 'majority', 'gift', 'draw', 'trpg', 'telephone', 'musicquiz', 'minimal', 'bluff', 'quacks'] as const;
export type GameType = typeof gameTypes[number];
export const isGameType = (value: unknown): value is GameType => typeof value === 'string' && gameTypes.includes(value as GameType);
export const gamePath = (type: GameType) => type === 'thunder' ? 'race' : type;
export const sessionKey = (type: GameType) => type === 'poker' ? 'ah-session' : 'ah-' + type;
export interface RoomSeat { code: string; type: GameType; reconnected?: boolean }
export interface RoomPlayer extends Record<string, unknown> { id: string; name: string; avatar: string | null; bot: boolean; kicked: boolean; online: boolean; roomRole: string | null }
export interface RoomSnapshot extends Record<string, unknown> {
  code: string; type: GameType; me: string; phase: string; serverNow: number; version?: number;
  host: boolean | string; hostId?: string; players: RoomPlayer[];
}
const validCode = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{6}$/i.test(value);
export function readSeat(value: unknown): RoomSeat {
  const row = record(value);
  if (!validCode(row.code) || !isGameType(row.type)) throw Error('房間座位資料格式不正確');
  return { code: row.code.toUpperCase(), type: row.type, ...(row.reconnected === true ? { reconnected: true } : {}) };
}
export function readRoomSnapshot(value: unknown): RoomSnapshot {
  const row = record(value), type = row.type === undefined ? 'poker' : row.type;
  if (!validCode(row.code) || !isGameType(type) || !text(row.me) || !text(row.phase) || typeof row.serverNow !== 'number' || !Number.isFinite(row.serverNow)) throw Error('房間狀態資料格式不正確');
  // Poker has no room version; do not invent one or confuse it with strokeVersion.
  if (row.version !== undefined && (!Number.isSafeInteger(row.version) || (row.version as number) < 0)) throw Error('房間版本資料格式不正確');
  const players = array(row.players).map(value => {
    const player = record(value);
    if (!text(player.id) || !text(player.name)) throw Error('玩家資料格式不正確');
    return { ...player, id: text(player.id), name: text(player.name), avatar: text(player.avatar) || null,
      bot: player.bot === true, kicked: player.kicked === true, online: player.online !== false,
      roomRole: typeof player.roomRole === 'string' ? player.roomRole : null,
    } satisfies RoomPlayer;
  });
  return { ...row, code: row.code.toUpperCase(), type, me: text(row.me), phase: text(row.phase), serverNow: row.serverNow,
    ...(typeof row.version === 'number' ? { version: row.version } : {}),
    host: typeof row.host === 'string' ? row.host : row.host === true, hostId: typeof row.hostId === 'string' ? row.hostId : undefined, players,
  } as RoomSnapshot;
}
function instance(snapshot: RoomSnapshot, path: 'media' | 'watch') {
  const value = snapshot[path];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>).roomInstanceId : undefined;
}
export function sameRoom(next: RoomSnapshot, current: RoomSnapshot | null): boolean {
  if (!current || next.code !== current.code || next.me !== current.me || next.type !== current.type) return false;
  return [[next.roomInstanceId, current.roomInstanceId], [instance(next, 'media'), instance(current, 'media')], [instance(next, 'watch'), instance(current, 'watch')]].every(([a, b]) => !a || !b || a === b);
}
export function staleSnapshot(next: RoomSnapshot, current: RoomSnapshot | null): boolean {
  if (!sameRoom(next, current) || !current) return false;
  return next.version !== undefined && current.version !== undefined && next.version < current.version ||
    next.version === current.version && next.serverNow < current.serverNow;
}
export function isRoomHost(snapshot: RoomSnapshot | null): boolean {
  return !!snapshot && (snapshot.host === true || snapshot.host === snapshot.me || snapshot.hostId === snapshot.me);
}
