export const bossTransformMaterials: Record<string, string>;
export function bossTransformPlan(
  id: string,
  phase: number,
  remainingMs: number,
): { material: string; duration: number; elapsed: number; revealAt: number; shards: number } | null;
export function playBossTransformation(
  node: HTMLElement,
  id: string,
  phase: number,
  remainingMs: number,
  reveal?: () => void,
): (() => void) | null;
