import { record, text } from '../services/validation';

export const maxMediaPosition = 14400;
export interface MediaMarker {
  roomInstanceId: string;
  revision: number;
  hasCurrent: boolean;
}
export interface MediaItem {
  id: string;
  type: 'music' | 'video';
  title: string;
  requestedById: string;
  requestedByName: string;
  trackId?: string;
  videoId?: string;
  durationSec?: number;
}
export interface MediaSnapshot extends MediaMarker {
  schemaVersion: 1;
  playbackSessionId: string;
  current: MediaItem | null;
  queue: MediaItem[];
  playback: {
    state: 'playing' | 'paused';
    anchorPositionSec: number;
    anchorServerMs: number;
    rate: 1;
  };
  serverNowMs: number;
  myPlayerId: string;
  canControl: boolean;
  canManageQueue: boolean;
  isHost: boolean;
  isManager: boolean;
}
export type MediaAction =
  | 'enqueue'
  | 'play'
  | 'pause'
  | 'seek'
  | 'skip'
  | 'remove'
  | 'reorder'
  | 'ended'
  | 'duration'
  | 'stop';
export interface MediaOrderIntent {
  scope: number;
  itemId: string;
  roomInstanceId: string;
  session: string;
  revision: number;
  orderIds: string[];
}
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0;
function invalid(): never {
  throw Error('媒體資料格式不正確，請重新開啟媒體視窗。');
}
export function readMediaMarker(value: unknown): MediaMarker | null {
  if (value === undefined || value === null) return null;
  const row = record(value);
  if (
    !text(row.roomInstanceId) ||
    !Number.isSafeInteger(row.revision) ||
    (row.revision as number) < 0 ||
    typeof row.hasCurrent !== 'boolean'
  )
    return invalid();
  return {
    roomInstanceId: text(row.roomInstanceId),
    revision: row.revision as number,
    hasCurrent: row.hasCurrent,
  };
}
function readItem(value: unknown): MediaItem {
  const row = record(value);
  if (
    !text(row.id) ||
    !text(row.title) ||
    !text(row.requestedById) ||
    !text(row.requestedByName) ||
    !['music', 'video'].includes(text(row.type))
  )
    return invalid();
  if (
    row.durationSec !== undefined &&
    (!finite(row.durationSec) || row.durationSec <= 0 || row.durationSec > maxMediaPosition)
  )
    return invalid();
  if (
    (row.type === 'music' && (!text(row.trackId) || row.durationSec === undefined)) ||
    (row.type === 'video' && !/^[a-zA-Z0-9_-]{11}$/.test(text(row.videoId)))
  )
    return invalid();
  return {
    id: text(row.id),
    type: row.type as MediaItem['type'],
    title: text(row.title),
    requestedById: text(row.requestedById),
    requestedByName: text(row.requestedByName),
    ...(row.type === 'music' ? { trackId: text(row.trackId) } : { videoId: text(row.videoId) }),
    ...(row.durationSec === undefined ? {} : { durationSec: row.durationSec as number }),
  };
}
export function readMediaSnapshot(value: unknown): MediaSnapshot {
  const row = record(value),
    playback = record(row.playback);
  const marker = readMediaMarker({ ...row, hasCurrent: row.current !== null });
  if (
    !marker ||
    row.schemaVersion !== 1 ||
    !text(row.playbackSessionId) ||
    !text(row.myPlayerId) ||
    !nonnegative(row.serverNowMs) ||
    !Array.isArray(row.queue) ||
    row.queue.length > 50 ||
    !['playing', 'paused'].includes(text(playback.state)) ||
    !nonnegative(playback.anchorPositionSec) ||
    playback.anchorPositionSec > maxMediaPosition ||
    !nonnegative(playback.anchorServerMs) ||
    playback.rate !== 1
  )
    return invalid();
  for (const key of ['canControl', 'canManageQueue', 'isHost', 'isManager'])
    if (typeof row[key] !== 'boolean') return invalid();
  const current = row.current === null ? null : readItem(row.current),
    queue = row.queue.map(readItem);
  const ids = [current, ...queue].flatMap((item) => (item ? [item.id] : []));
  if (new Set(ids).size !== ids.length) return invalid();
  return {
    ...marker,
    schemaVersion: 1,
    playbackSessionId: text(row.playbackSessionId),
    current,
    queue,
    playback: {
      state: playback.state as 'playing' | 'paused',
      anchorPositionSec: playback.anchorPositionSec,
      anchorServerMs: playback.anchorServerMs,
      rate: 1,
    },
    serverNowMs: row.serverNowMs,
    myPlayerId: text(row.myPlayerId),
    canControl: row.canControl === true,
    canManageQueue: row.canManageQueue === true,
    isHost: row.isHost === true,
    isManager: row.isManager === true,
  };
}
export const mediaMarkerKey = (value: MediaMarker | null) =>
  value ? `${value.roomInstanceId}:${value.revision}` : '';
export const mediaCurrentKey = (value: MediaSnapshot | null) =>
  value?.current ? `${value.roomInstanceId}:${value.playbackSessionId}:${value.current.id}` : '';
export const mediaPlaybackKey = (value: MediaSnapshot | null) =>
  value
    ? JSON.stringify([
        mediaCurrentKey(value),
        value.playback.state,
        value.playback.anchorPositionSec,
        value.playback.anchorServerMs,
      ])
    : '';
export function mediaPosition(value: MediaSnapshot | null, serverNow: number) {
  if (!value?.current) return 0;
  return Math.min(
    value.current.durationSec || maxMediaPosition,
    Math.max(
      0,
      value.playback.anchorPositionSec +
        (value.playback.state === 'playing'
          ? Math.max(0, serverNow - value.playback.anchorServerMs) / 1000
          : 0),
    ),
  );
}
export function formatMediaTime(value: number) {
  const seconds = Math.floor(Math.max(0, value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export interface MediaPlayerView {
  videoTitle?: string;
  videoTitleId?: string;
  videoWanted: boolean;
  ready: boolean;
  nativeVideo: boolean;
  videoFallback: boolean;
  loading: boolean;
  publishReason: string;
}
export interface MediaPlayer {
  relocate?(): void;
  update(value: MediaSnapshot, marker: MediaMarker | null, serverNow: number): void;
  setWindow(open: boolean, collapsed?: boolean, keepVideo?: boolean): void;
  setMarker(value: MediaMarker | null): void;
  joinVideo(): void;
  exitVideo(message?: string): void;
  resume(): void;
  align(): void;
  useNativeVideo(): void;
  readPosition(): Promise<number | null>;
  disconnect(): void;
  dispose(): void;
}
declare global {
  interface Window {
    RoomMediaPlayer?: {
      create(options: {
        audioHost: HTMLElement;
        videoHost: HTMLElement;
        onStatus(message: string): void;
        onChange(value: MediaPlayerView): void;
        onReport(action: 'duration' | 'ended', extra: Record<string, unknown>): void;
      }): MediaPlayer;
    };
  }
}
