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
      phase?: number;
      paralysed?: boolean;
      arrivalAt?: number;
      facing?: 'left' | 'right';
      intent?: { effect: string; until: number; attackRate?: number } | null;
      health?: number;
      connected: boolean;
    },
    now: number,
  ): void;
  dispose(): void;
} | null;
