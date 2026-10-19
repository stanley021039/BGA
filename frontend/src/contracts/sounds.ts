import type { RoomSnapshot } from './room';
export interface GameSoundOwner {
  update(value: RoomSnapshot, options: { connected: boolean }): boolean;
  play(cue: string, key: string, options: { live: boolean; epoch?: number }): void;
  epoch(): number;
  disconnect(): void;
  stop(): void;
  destroy(): void;
}
declare global {
  interface Window {
    GameSounds?: { create(): GameSoundOwner };
  }
}
