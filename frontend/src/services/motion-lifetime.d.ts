export function motionAllowed(): boolean;
export function watchMotionCancellation(cancel: () => void): () => void;
export function acquireEffectContext(canvas: HTMLCanvasElement): (() => void) | null;
