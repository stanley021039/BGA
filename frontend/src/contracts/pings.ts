import { record, text } from '../services/validation';
export const pingTypes = ['ping', 'attention', 'question', 'help', 'look'] as const;
export type PingType = (typeof pingTypes)[number];
export type PingTarget =
  | { kind: 'viewport'; x: number; y: number }
  | { kind: 'element'; key: string; x: number; y: number }
  | { kind: 'surface'; key: string; epoch: string; x: number; y: number };
export interface PingContext {
  roomInstanceId: string;
  scene: string;
  serverNow: number;
}
export interface PingEvent {
  id: string;
  roomInstanceId: string;
  scene: string;
  playerId: string;
  name: string;
  type: PingType;
  target: PingTarget;
  at: number;
  expiresAt: number;
}
export interface PingReceipt {
  event: PingEvent;
  serverNow: number;
}
export interface PingPreference {
  imageUrl?: string;
  sound?: { effect: string } | { url: string; durationMs: number } | null;
}
export type PingPreferences = Record<PingType, PingPreference>;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
function invalid(): never {
  throw Error('標記資料格式不正確。');
}
export function readPingContext(value: unknown): PingContext | null {
  if (value === undefined || value === null) return null;
  const row = record(value);
  if (
    !text(row.roomInstanceId) ||
    !text(row.scene) ||
    text(row.scene).length > 512 ||
    !finite(row.serverNow)
  )
    return invalid();
  return {
    roomInstanceId: text(row.roomInstanceId),
    scene: text(row.scene),
    serverNow: row.serverNow,
  };
}
export function readPingTarget(value: unknown): PingTarget {
  const row = record(value);
  if (!finite(row.x) || !finite(row.y) || row.x < 0 || row.x > 1 || row.y < 0 || row.y > 1)
    return invalid();
  const point = { x: row.x, y: row.y };
  if (row.kind === 'viewport') return { kind: 'viewport', ...point };
  const key = text(row.key);
  if (
    row.kind === 'element' &&
    /^(header|chat|players|lobby-stage|game-list|room-list|player:.{1,128})$/.test(key)
  )
    return { kind: 'element', key, ...point };
  if (
    row.kind === 'surface' &&
    (key === 'draw-canvas' || /^race-cell:[0-5]:[0-9]{1,6}$/.test(key)) &&
    text(row.epoch) &&
    text(row.epoch).length <= 512
  )
    return { kind: 'surface', key, epoch: text(row.epoch), ...point };
  return invalid();
}
export function readPingReceipt(value: unknown): PingReceipt {
  const row = record(value),
    item = record(row.event);
  if (
    !finite(row.serverNow) ||
    !finite(item.at) ||
    !finite(item.expiresAt) ||
    item.expiresAt <= item.at ||
    item.expiresAt - item.at > 5000 ||
    !text(item.id) ||
    !text(item.roomInstanceId) ||
    !text(item.scene) ||
    !text(item.playerId) ||
    !text(item.name) ||
    !pingTypes.includes(item.type as PingType)
  )
    return invalid();
  return {
    serverNow: row.serverNow,
    event: {
      id: text(item.id),
      roomInstanceId: text(item.roomInstanceId),
      scene: text(item.scene),
      playerId: text(item.playerId),
      name: text(item.name),
      type: item.type as PingType,
      target: readPingTarget(item.target),
      at: item.at,
      expiresAt: item.expiresAt,
    },
  };
}
export interface PingModel {
  types: Record<PingType, { label: string; icon: string }>;
  pick(dx: number, dy: number, threshold?: number): PingType;
  point(rect: DOMRect, x: number, y: number): { x: number; y: number };
  place(
    rect: { left: number; top: number; width: number; height: number },
    target: { x: number; y: number },
    width: number,
    height: number,
  ): { x: number; y: number; edge: boolean; dx: number; dy: number };
  preferences(value?: unknown): PingPreferences;
}
declare global {
  interface Window {
    PingModel?: PingModel;
    RoomPings?: { setPreferences(value?: unknown): void; disconnect(): void; stop(): void };
  }
}
