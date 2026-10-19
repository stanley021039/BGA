import { readRoomSnapshot } from './room';
import type { RoomSeat, RoomSnapshot } from './room';
import { array, record, text } from '../services/validation';

export type DrawingTool = 'brush' | 'erase' | 'line' | 'rect' | 'ellipse' | 'fill';
export type Point = [number, number];
export interface DrawingStyle { tool: DrawingTool; color: string; size: number; filled: boolean }
export interface DrawingDraft extends DrawingStyle { strokeId: string; points: Point[]; curve?: 'quadratic' }
export interface DrawingStroke extends DrawingDraft { version: number; pointTimes?: number[] }
export interface DrawingQuota { usedFills: number; usedBatches: number; usedPoints: number }
export interface CanvasSnapshot { canvasEpoch: string; round: number; version: number; strokes: DrawingStroke[]; quota?: DrawingQuota }
export interface DrawQuestion extends Record<string, unknown> { id?: string; title: string; category: string; topicLabel: string }
export interface DrawSnapshot extends RoomSnapshot {
  type: 'draw'; phase: 'waiting' | 'choosing' | 'drawing' | 'reveal' | 'finished';
  round: number; roundLimit: number; presenterId: string | null; deadline: number | null; canvasEpoch: string; strokeVersion: number;
  participantIds: string[]; guessedIds: string[]; candidates: DrawQuestion[]; question: DrawQuestion | null;
}
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
function question(value: unknown): DrawQuestion {
  const row = record(value);
  if (!text(row.title)) throw Error('題目資料格式不正確');
  return { ...row, title: text(row.title), category: text(row.category), topicLabel: text(row.topicLabel), ...(typeof row.id === 'string' ? { id: row.id } : {}) } as DrawQuestion;
}
function ids(value: unknown): string[] {
  const values = array(value);
  if (!values.every(value => typeof value === 'string')) throw Error('參與玩家資料格式不正確');
  return values as string[];
}
export function readDrawSnapshot(value: unknown): DrawSnapshot {
  const room = readRoomSnapshot(value);
  if (room.type !== 'draw' || !['waiting', 'choosing', 'drawing', 'reveal', 'finished'].includes(room.phase)) throw Error('這不是你畫我猜房間');
  if (!integer(room.version) || !integer(room.round) || !integer(room.roundLimit) || !integer(room.strokeVersion) || !text(room.canvasEpoch) ||
    room.presenterId !== null && typeof room.presenterId !== 'string' || room.deadline !== null && (typeof room.deadline !== 'number' || !Number.isFinite(room.deadline))) throw Error('畫猜回合資料格式不正確');
  return { ...room, round: room.round, roundLimit: room.roundLimit, strokeVersion: room.strokeVersion, canvasEpoch: text(room.canvasEpoch),
    participantIds: ids(room.participantIds), guessedIds: ids(room.guessedIds), candidates: array(room.candidates).map(question), question: room.question === null ? null : question(room.question),
  } as DrawSnapshot;
}
export interface DrawingView {
  version: number; round: number; strokeCount: number; pointCount: number; draftCount: number; pendingBatches: number;
  quota: DrawingQuota; commandBusy: boolean; recovering: boolean; error: Error | null;
}
export interface DrawingSession {
  view(): DrawingView; canDraw(): boolean; hasCapacity(extra?: number): boolean;
  beginDraft(draft: DrawingDraft): boolean; appendDraft(id: string, point: Point, shape?: boolean): void; finishDraft(id: string, failed?: boolean): void;
  enqueue(points: Point[], id: string, style: DrawingStyle, times?: number[]): Promise<unknown>;
  schedulePreview(): void; cancelPreview(): void; redraw(): unknown;
  transition(snapshot: DrawSnapshot): void; applySnapshot(value: unknown, reset?: boolean): boolean; receiveStroke(value: unknown): void;
  command(name: 'undo' | 'clear'): Promise<void>; whenIdle(): Promise<void>; suspend(): void; dispose(): void; finishPlayback(): void;
}
export interface DrawingRequestOptions { signal?: AbortSignal }
export type DrawingRequest = (route: string, data?: Record<string, unknown>, options?: DrawingRequestOptions) => Promise<unknown>;
export interface DrawingController {
  start(): void; dispose(): void; cancel(options?: { cancelSync?: boolean }): void; cancelSync(): void;
  syncCanvas(): Promise<unknown>; poll(): Promise<void>; connectEvents(): void;
}
export interface DrawingEngines {
  create(options: {
    canvas: HTMLCanvasElement; request: DrawingRequest; syncCanvas: () => Promise<unknown>;
    cancelInput: (failed?: boolean) => void; cancelNetwork: (options?: { cancelSync?: boolean }) => void;
    feedback: (message: string, kind?: string, options?: { onlyRecovering?: boolean }) => void; notify: (message: string) => void;
    onRendered?: () => void; onBusy?: () => void; onQuota?: () => void; now?: () => number;
  }): DrawingSession;
  validSnapshot(value: unknown): boolean;
}
declare global {
  interface Window {
    StrokeCanvas?: { redraw(canvas: HTMLCanvasElement, values: unknown[]): void; strokeId(): string; iconMarkup(key: string): string };
    DrawCanvasSession?: DrawingEngines;
    DrawController?: { create(options: {
      context: () => { room: string; session: RoomSeat | null; busy: boolean; epoch?: string; round?: number; version: number };
      request: DrawingRequest; receive: (value: unknown) => void; applySnapshot: (value: unknown, reset?: boolean) => unknown; receiveStroke: (value: unknown) => void;
      onSyncError?: (error: Error) => void; onSyncSuccess?: () => void; onPollError?: (error: Error) => void; onPollSuccess?: () => void;
      onStreamReady?: () => void; onStreamError?: () => void; cancelWork?: () => void; tick?: () => void;
      createStream?: (url: string) => EventSource;
    }): DrawingController };
  }
}
