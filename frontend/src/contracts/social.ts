import { array, record, text } from '../services/validation';
import type { RoomSnapshot } from './room';
export interface ChatMessage { id: string; name: string; message: string; at: number }
export interface ChatReceipt { channel: 'table'; code: string; viewerId: string; messages: ChatMessage[]; roomState?: unknown }
export interface BuiltinFrame { kind: 'builtin'; version: 1; id: string }
export interface BarrageEvent { id: string; kind: 'emoji' | 'barrage'; name: string; at: number; playerId?: string; emoji: string; message: string; frame: BuiltinFrame }
export interface ExpressionEvent { id: string; kind: 'expression'; at: number; sound?: unknown; [key: string]: unknown }
export interface BarrageController { update(snapshot: RoomSnapshot): void; disconnect(): void; clear(): void; dispose(): void; size(): number }
export type BarrageRenderer = (item: BarrageEvent, lane: number, options: { moving: boolean; finish: () => void }) => false | (() => void);
export interface ExpressionPlayback { update(value: { contextId: string; serverNow: number; events: ExpressionEvent[] }): void; reset(): void; stop(): void; destroy(): void }
export function readChatReceipt(value: unknown): ChatReceipt {
  const row = record(value);
  if (row.channel !== 'table' || !/^[a-f0-9]{6}$/i.test(text(row.code)) || !text(row.viewerId)) throw Error('聊天室資料格式不正確');
  const messages = array(row.messages).slice(-50).map(value => {
    const item = record(value);
    if (!text(item.id) || typeof item.name !== 'string' || typeof item.message !== 'string' || typeof item.at !== 'number' || !Number.isFinite(new Date(item.at).getTime())) throw Error('聊天訊息資料格式不正確');
    return { id: text(item.id), name: item.name, message: item.message, at: item.at };
  });
  return { channel: 'table', code: text(row.code).toUpperCase(), viewerId: text(row.viewerId), messages, ...(row.roomState ? { roomState: row.roomState } : {}) };
}
export function readEmojis(value: unknown): string[] {
  const emojis = array(record(value).emojis);
  if (!emojis.every(value => typeof value === 'string' && value.length > 0)) throw Error('表情選項資料格式不正確');
  return [...new Set(emojis as string[])];
}
export function readBarrages(value: unknown): BarrageEvent[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-50).flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    if ((item.kind !== 'emoji' && item.kind !== 'barrage') || !text(item.id) || typeof item.at !== 'number' || !Number.isFinite(item.at)) return [];
    const frame = item.frame && typeof item.frame === 'object' ? item.frame as Record<string, unknown> : {};
    return [{ id: text(item.id), kind: item.kind, name: text(item.name), at: item.at, playerId: text(item.playerId), emoji: text(item.emoji), message: text(item.message), frame: { kind: 'builtin', version: 1, id: frame.kind === 'builtin' && frame.version === 1 ? text(frame.id, 'default') : 'default' } } satisfies BarrageEvent];
  });
}
export function readExpressions(value: unknown): ExpressionEvent[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-256).flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    return item.kind === 'expression' && text(item.id) && typeof item.at === 'number' && Number.isFinite(item.at) ? [{ ...item, id: text(item.id), kind: 'expression' as const, at: item.at }] : [];
  });
}
