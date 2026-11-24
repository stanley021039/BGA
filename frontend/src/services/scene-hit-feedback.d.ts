import type { LobbySnapshot } from '../contracts/lobby';
export function createSceneHitFeedback(options: {
  root: () => HTMLElement | null;
  now?: () => number;
}): {
  update(
    snapshot: LobbySnapshot | null,
    options?: { connected?: boolean; motion?: boolean; scope?: string },
  ): void;
  stopVisuals(): void;
  reset(): void;
  destroy(): void;
  size(): { seen: number; bossReceipts: number; reactions: number; bursts: number; shakes: number };
};
