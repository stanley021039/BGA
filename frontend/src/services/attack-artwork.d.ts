export function playAttackArtwork(
  canvas: HTMLCanvasElement,
  options: {
    effect: string;
    color: string;
    width: number;
    height: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
  },
): () => void;
