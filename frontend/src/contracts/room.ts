import { array, record, text } from '../services/validation';

export const gameTypes = [
  'poker',
  'thunder',
  'majority',
  'gift',
  'draw',
  'trpg',
  'telephone',
  'musicquiz',
  'minimal',
  'bluff',
  'quacks',
  'ceo',
] as const;
export type GameType = (typeof gameTypes)[number];
export const isGameType = (value: unknown): value is GameType =>
  typeof value === 'string' && gameTypes.includes(value as GameType);
export const gamePath = (type: GameType) => (type === 'thunder' ? 'race' : type);
export const sessionKey = (type: GameType) => (type === 'poker' ? 'ah-session' : 'ah-' + type);
export interface RoomSeat {
  code: string;
  type: GameType;
  reconnected?: boolean;
}
export interface RoomPlayer extends Record<string, unknown> {
  id: string;
  name: string;
  avatar: string | null;
  bot: boolean;
  kicked: boolean;
  online: boolean;
  roomRole: string | null;
}
export interface RoomSnapshot extends Record<string, unknown> {
  code: string;
  type: GameType;
  me: string;
  phase: string;
  serverNow: number;
  version?: number;
  host: boolean | string;
  hostId?: string;
  players: RoomPlayer[];
}
const validCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{6}$/i.test(value);
export function readSeat(value: unknown): RoomSeat {
  const row = record(value);
  if (!validCode(row.code) || !isGameType(row.type)) throw Error('房間座位資料格式不正確');
  return {
    code: row.code.toUpperCase(),
    type: row.type,
    ...(row.reconnected === true ? { reconnected: true } : {}),
  };
}
export function readRoomSnapshot(value: unknown): RoomSnapshot {
  const row = record(value),
    type = row.type === undefined ? 'poker' : row.type;
  if (
    !validCode(row.code) ||
    !isGameType(type) ||
    !text(row.me) ||
    !text(row.phase) ||
    typeof row.serverNow !== 'number' ||
    !Number.isFinite(row.serverNow)
  )
    throw Error('房間狀態資料格式不正確');
  // Poker has no room version; do not invent one or confuse it with strokeVersion.
  if (
    row.version !== undefined &&
    (!Number.isSafeInteger(row.version) || (row.version as number) < 0)
  )
    throw Error('房間版本資料格式不正確');
  const players = array(row.players).map((value) => {
    const player = record(value);
    if (!text(player.id) || !text(player.name)) throw Error('玩家資料格式不正確');
    return {
      ...player,
      id: text(player.id),
      name: text(player.name),
      avatar: text(player.avatar) || null,
      bot: player.bot === true,
      kicked: player.kicked === true,
      online: player.online !== false && player.offline !== true,
      roomRole: typeof player.roomRole === 'string' ? player.roomRole : null,
    } satisfies RoomPlayer;
  });
  return {
    ...row,
    code: row.code.toUpperCase(),
    type,
    me: text(row.me),
    phase: text(row.phase),
    serverNow: row.serverNow,
    ...(typeof row.version === 'number' ? { version: row.version } : {}),
    host: typeof row.host === 'string' ? row.host : row.host === true,
    hostId: typeof row.hostId === 'string' ? row.hostId : undefined,
    players,
  } as RoomSnapshot;
}
function instance(snapshot: RoomSnapshot, path: 'media' | 'watch') {
  const value = snapshot[path];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>).roomInstanceId
    : undefined;
}
export function sameRoom(next: RoomSnapshot, current: RoomSnapshot | null): boolean {
  if (
    !current ||
    next.code !== current.code ||
    next.me !== current.me ||
    next.type !== current.type
  )
    return false;
  return [
    [next.roomInstanceId, current.roomInstanceId],
    [instance(next, 'media'), instance(current, 'media')],
    [instance(next, 'watch'), instance(current, 'watch')],
  ].every(([a, b]) => !a || !b || a === b);
}
export function staleSnapshot(next: RoomSnapshot, current: RoomSnapshot | null): boolean {
  if (!sameRoom(next, current) || !current) return false;
  return (
    (next.version !== undefined &&
      current.version !== undefined &&
      next.version < current.version) ||
    (next.version === current.version && next.serverNow < current.serverNow)
  );
}
export function isRoomHost(snapshot: RoomSnapshot | null): boolean {
  return (
    !!snapshot &&
    (snapshot.host === true || snapshot.host === snapshot.me || snapshot.hostId === snapshot.me)
  );
}
export type RoomRole = 'host' | 'manager' | 'member' | null;
export function myRoomRole(snapshot: RoomSnapshot | null): RoomRole {
  if (!snapshot) return null;
  const permissions = snapshot.permissions;
  if (permissions && typeof permissions === 'object') {
    const role = (permissions as Record<string, unknown>).role;
    return role === 'host' || role === 'manager' || role === 'member' ? role : null;
  }
  return isRoomHost(snapshot) ? 'host' : 'member';
}
function permission(snapshot: RoomSnapshot, name: string): boolean {
  return (
    !snapshot.permissions ||
    (typeof snapshot.permissions === 'object' &&
      (snapshot.permissions as Record<string, unknown>)[name] === true)
  );
}
export function canManagePlayers(snapshot: RoomSnapshot | null): boolean {
  return (
    !!snapshot &&
    ['host', 'manager'].includes(myRoomRole(snapshot) || '') &&
    permission(snapshot, 'canManagePlayers')
  );
}
export function playerRoomRole(player: RoomPlayer, snapshot: RoomSnapshot): RoomRole {
  if (player.bot) return null;
  if (player.roomRole === 'host' || player.roomRole === 'manager' || player.roomRole === 'member')
    return player.roomRole;
  return player.id === snapshot.hostId || (player.id === snapshot.me && isRoomHost(snapshot))
    ? 'host'
    : 'member';
}
export function mayKickPlayer(
  player: RoomPlayer | undefined,
  snapshot: RoomSnapshot | null,
): boolean {
  if (
    !snapshot ||
    !canManagePlayers(snapshot) ||
    !player ||
    player.kicked ||
    player.id === snapshot.me ||
    playerRoomRole(player, snapshot) === 'host'
  )
    return false;
  return (
    myRoomRole(snapshot) === 'host' ||
    (!player.bot && playerRoomRole(player, snapshot) === 'member')
  );
}
export function maySetPlayerRole(
  player: RoomPlayer | undefined,
  snapshot: RoomSnapshot | null,
): boolean {
  return (
    !!snapshot &&
    canManagePlayers(snapshot) &&
    myRoomRole(snapshot) === 'host' &&
    permission(snapshot, 'canPromote') &&
    !!player &&
    !player.kicked &&
    !player.bot &&
    player.id !== snapshot.me &&
    playerRoomRole(player, snapshot) !== 'host'
  );
}
export function leaveEffect(snapshot: RoomSnapshot): string {
  const setup = ['waiting', 'finished', 'showdown'].includes(snapshot.phase);
  if (snapshot.type === 'trpg' && !setup)
    return '離席會移除自己的未結算行動；領隊離席時移交領隊，其他玩家可繼續。已揭曉的結果保留。離開後返回遊戲大廳。';
  return ['telephone', 'musicquiz', 'minimal', 'bluff', 'quacks'].includes(snapshot.type) && !setup
    ? '離席會中止本場遊戲，保留已完成內容。離開後返回遊戲大廳。'
    : snapshot.type === 'draw' && !setup
      ? '畫者離席會揭曉本輪；人數不足時本場結束。離開後返回遊戲大廳。'
      : '離開後返回遊戲大廳；房主離開時依遊戲規則移交房主或結束房間。';
}
export function kickEffect(snapshot: RoomSnapshot): string {
  if (snapshot.phase === 'waiting') return '玩家將從等待室移除。';
  if (snapshot.type === 'majority')
    return '尚未結算的答案與預備題目將移除；人數不足時會提前結束本局。';
  if (snapshot.type === 'gift') return '玩家的未揭曉禮物與喜好將移除；人數不足時本局提前結束。';
  if (snapshot.type === 'draw') return '畫者離開會揭曉本輪；人數不足時本局提前結束。';
  if (['telephone', 'musicquiz', 'minimal', 'bluff', 'quacks'].includes(snapshot.type))
    return '玩家離席會中止本場遊戲，保留已完成內容。';
  if (snapshot.type === 'trpg')
    return '玩家的未結算行動將移除；領隊離席時移交領隊，其他玩家可繼續。已揭曉的結果保留。';
  if (snapshot.type === 'poker' && snapshot.phase === 'showdown') return '玩家將從牌桌移除。';
  return '對局中的車隊或牌手將由電腦接手，其他玩家繼續遊戲。';
}
