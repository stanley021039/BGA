export type BossZone =
  | { shape: 'circle'; x: number; y: number; r: number }
  | {
      shape: 'ring';
      x: number;
      y: number;
      r: number;
      inner: number;
      direction?: number;
      gap?: number;
    }
  | { shape: 'sector'; x: number; y: number; r: number; direction: number; angle: number }
  | { shape: 'line'; x: number; y: number; x2: number; y2: number; w: number };
export type BossEffects = Record<string, number | boolean | undefined>;
export type BossStep = {
  delay: number;
  weight: number;
  geometry?: string;
  radius?: number;
  width?: number;
  range?: number;
  innerRatio?: number;
  gapDegrees?: number;
  rotation?: number;
  side?: number;
  spotRadius?: number;
  spacing?: number;
  coneDegrees?: number;
  root?: number;
  pull?: number;
  reverse?: boolean;
  color?: string;
  head?: number;
  motif?: string;
  effects?: BossEffects;
};
export interface BossSpec {
  id: string;
  boss: string;
  slot: string;
  name: string;
  motif: string;
  color: string;
  accent: string;
  windup: number;
  duration: number;
  pulses: number;
  damage: number;
  geometry: string;
  radius: number;
  width: number;
  range: number;
  phase?: number;
  head?: number;
  slow?: number;
  root?: number;
  drain?: number;
  pull?: number;
  steps?: BossStep[];
  effects?: BossEffects;
  stages?: Partial<Record<'1' | '2' | '3', { steps: BossStep[]; effects?: BossEffects }>>;
}
export type BossStrike = {
  index: number;
  at: number;
  damage: number;
  zones: BossZone[];
  effects: BossEffects;
  spec: BossSpec;
  reverse: boolean;
};
export function bossStageSpec(
  spec: BossSpec | undefined,
  phase?: number,
): (BossSpec & { phase: number }) | null;
export function bossAttackPlan(
  spec: BossSpec,
  from: { x: number; y: number },
  aim: { x: number; y: number },
  aspect?: number,
): BossStrike[];
export function bossZones(
  spec: Pick<BossSpec, 'geometry' | 'motif' | 'radius' | 'width' | 'range'>,
  from: { x: number; y: number },
  aim: { x: number; y: number },
  aspect?: number,
): BossZone[];
export function inBossZones(
  zones: BossZone[],
  actor: { x: number; y: number },
  aspect?: number,
): boolean;
export function bossZonePath(zone: BossZone): string;
export function traceBossZone(ctx: CanvasRenderingContext2D, zone: BossZone): void;
