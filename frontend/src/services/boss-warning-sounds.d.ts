export function createBossWarningSounds(): {
  update(
    arrivals: ReadonlyArray<{ id: string; spawnAt: number }>,
    now: number,
    connected: boolean,
  ): void;
  destroy(): void;
};
