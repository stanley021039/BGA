export function sceneCorrection(
  previous: { x: number; y: number },
  next: { x: number; y: number },
  enabled: boolean,
): { x: number; y: number } | null;
export function reconcileScenePosition<T extends { x: number; y: number }>(
  position: T,
  correction: { x: number; y: number } | null,
  elapsed: number,
): T;
export function createSceneSnapshotClock(): {
  sample(serverNow: number, start: number, end: number): void;
  age(serverNow: number, now: number): number;
  reset(): void;
};
