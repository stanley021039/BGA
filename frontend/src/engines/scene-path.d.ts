export interface Passage {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface Point {
  x: number;
  y: number;
}
export function validPassage(value: unknown): value is Passage;
export function passageTarget(from: Point, target: Point, box?: Passage | null): Point;
export function sceneWalk(
  from: Point,
  target: Point,
  elapsedMs: number,
  box?: Passage | null,
): Point & { remainingMs: number; crossed: boolean };
