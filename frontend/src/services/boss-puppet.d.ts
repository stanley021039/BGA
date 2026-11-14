export function bossMotionProfile(id: string): {
  gait: string;
  period: number;
  sway: number;
  lift: number;
};
export function createBossPuppet(
  node: HTMLElement,
  id: string,
): {
  update(
    state: {
      moving: boolean;
      facing?: 'left' | 'right';
      intent?: { effect: string; until: number } | null;
      health?: number;
      connected: boolean;
    },
    now: number,
  ): void;
  dispose(): void;
} | null;
