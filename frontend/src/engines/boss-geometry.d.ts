export type BossZone =
  | { shape: 'circle'; x: number; y: number; r: number }
  | { shape: 'ring'; x: number; y: number; r: number; inner: number }
  | { shape: 'line'; x: number; y: number; x2: number; y2: number; w: number };
export function bossZones(
  spec: { geometry: string; motif: string; radius: number; width: number; range: number },
  from: { x: number; y: number },
  aim: { x: number; y: number },
  aspect?: number,
): BossZone[];
export function inBossZones(
  zones: BossZone[],
  actor: { x: number; y: number },
  aspect?: number,
): boolean;
