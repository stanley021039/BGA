export const ghidorahMouths: { x: number; y: number; rx: number; jaw: string }[];
export function ghidorahMouthsFor(phase?: number): typeof ghidorahMouths;
export const ghidorahMouthPaint: { cavity: string; teeth: string };
export function ghidorahMouthOpenings(
  strikes: { at: number; heads: number[] }[],
  age: number,
  windup: number,
  hold?: number,
): number[];
