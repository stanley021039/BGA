export type AttackArtworkOptions = {
  effect: string;
  ageMs?: number;
  coverClips?: readonly Path2D[];
  readCaster?: () => { x: number; y: number } | null;
  readAnchor?: () => { x: number; y: number } | null;
  rays?: { x: number; y: number }[];
  readHits?: () => {
    toId: string;
    x: number;
    y: number;
    damage: number;
    critical: boolean;
    phase?: string;
    delayMs?: number;
    pending?: boolean;
    missed?: boolean;
  }[];
  preview?: boolean;
  previewUnit?: number;
  renderScale?: number;
  damage?: number;
  critical?: boolean;
  aspectRatio?: number;
  hits?: { x: number; y: number; damage: number; critical: boolean }[];
  color: string;
  width: number;
  height: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export function playAttackArtwork(
  canvas: HTMLCanvasElement,
  options: AttackArtworkOptions,
): () => void;

export function createAttackScene(
  context: CanvasRenderingContext2D,
  options: AttackArtworkOptions & { fx?: { density: number; glow: number } },
): { draw(now: number): boolean; dispose(): void };

export function createAttackStage(
  canvas: HTMLCanvasElement,
  options?: { readCamera?: () => { x: number; y: number } },
): {
  add(id: string, options: AttackArtworkOptions): boolean;
  remove(id: string): void;
  clear(): void;
  detail(): { density: number; glow: number; tier: number };
};
