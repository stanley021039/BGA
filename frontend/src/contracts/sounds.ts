import type { RoomSnapshot } from './room';
export interface GameSoundOwner {
  update(value: Pick<RoomSnapshot, 'code' | 'version'>, options: { connected: boolean }): boolean;
  play(
    cue: string,
    key: string,
    options: { live: boolean; epoch?: number; retryIfUnavailable?: boolean },
  ): void;
  epoch(): number;
  disconnect(): void;
  stop(): void;
  destroy(): void;
}
declare global {
  interface Window {
    GameSounds?: {
      create(options?: { now?: () => number; maxSeen?: number; maxGapMs?: number }): GameSoundOwner;
    };
  }
}
