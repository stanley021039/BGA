import type { Point } from '../contracts/drawing';

// Online, error-bounded thinning of freehand input (#264). Raw input records every
// grid cell the pointer crosses, so fast or long strokes used the round's 30,000-point
// quota within a minute. Kept points are always original samples, so the wire format,
// server validation and the quadratic renderer stay unchanged.
// - Every dropped sample stays within TOLERANCE grid units of the kept polyline.
// - Segments stay at most MAX_SEGMENT long, keeping quadratic corner rounding small.
// - After a turn sharper than CORNER_COS the next segment is at most CORNER_SEGMENT,
//   so the renderer cannot round a sharp corner by more than about one grid unit.
export const SIMPLIFY_TOLERANCE = 0.9;
export const SIMPLIFY_MAX_SEGMENT = 8;
export const SIMPLIFY_CORNER_SEGMENT = 2;
export const SIMPLIFY_CORNER_COS = 0.8;
const MAX_RUN = 32,
  TURN_SPAN = 3;

function distanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}

// The last point of a stroke is a provisional tip until it is committed. `fits(point)`
// says whether a new sample may replace the tip; `push` records the caller's choice.
export function createStrokeSimplifier(start: Point) {
  // `before` is the nearest earlier fixed point at least TURN_SPAN away, so grid
  // staircase steps between short segments do not read as corners.
  let before: Point | null = null,
    base: Point = start,
    run: Point[] = [];
  function fits(point: Point) {
    if (!run.length || run.length >= MAX_RUN) return false;
    const dx = point[0] - base[0],
      dy = point[1] - base[1],
      length = Math.hypot(dx, dy);
    if (length > SIMPLIFY_MAX_SEGMENT) return false;
    if (before && length > SIMPLIFY_CORNER_SEGMENT) {
      const ix = base[0] - before[0],
        iy = base[1] - before[1];
      if ((ix * dx + iy * dy) / (Math.hypot(ix, iy) * length) < SIMPLIFY_CORNER_COS) return false;
    }
    return run.every((sample) => distanceToSegment(sample, base, point) <= SIMPLIFY_TOLERANCE);
  }
  function commit() {
    if (!run.length) return;
    const tip = run[run.length - 1]!;
    if (Math.hypot(tip[0] - base[0], tip[1] - base[1]) >= TURN_SPAN) before = base;
    else if (before && Math.hypot(tip[0] - before[0], tip[1] - before[1]) < TURN_SPAN)
      before = null;
    base = tip;
    run = [];
  }
  function push(point: Point, replace: boolean) {
    if (!replace) commit();
    run.push(point);
  }
  return { fits, push, commit };
}

// Batch form for tests and offline traces: the points an input stroke would keep.
export function simplifyStroke(points: Point[]): Point[] {
  if (!points.length) return [];
  const kept: Point[] = [points[0]!],
    simplifier = createStrokeSimplifier(points[0]!);
  for (const point of points.slice(1)) {
    const replace = simplifier.fits(point);
    simplifier.push(point, replace);
    if (replace) kept[kept.length - 1] = point;
    else kept.push(point);
  }
  return kept;
}
