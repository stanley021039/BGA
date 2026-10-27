export function playAttackArtwork(
  canvas: HTMLCanvasElement,
  options: {
    effect: string;
    ageMs?: number;
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
    damage?: number;
    critical?: boolean;
    aspectRatio?: number;
    hits?: { x: number; y: number; damage: number; critical: boolean }[];
    color: string;
    width: number;
    height: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
  },
): () => void;
