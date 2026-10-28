// One movement clock for the server and avatar interpolation. The covered part
// of a segment costs no walking time: enter one edge and appear at the other.
export function validPassage(box) {
  return (
    box !== null &&
    typeof box === 'object' &&
    !Array.isArray(box) &&
    Object.keys(box).length === 4 &&
    ['left', 'right', 'top', 'bottom'].every(
      (k) => Number.isFinite(box[k]) && box[k] >= 0 && box[k] <= 100,
    ) &&
    box.left < box.right &&
    box.top < box.bottom
  );
}

function crossing(from, to, box) {
  if (!validPassage(box) || (from.x === to.x && from.y === to.y)) return null;
  let enter = 0,
    exit = 1;
  for (const [axis, low, high] of [
    ['x', 'left', 'right'],
    ['y', 'top', 'bottom'],
  ]) {
    const delta = to[axis] - from[axis];
    if (!delta) {
      // Sliding along an edge must not trigger a portal.
      if (from[axis] <= box[low] || from[axis] >= box[high]) return null;
    } else {
      const a = (box[low] - from[axis]) / delta,
        b = (box[high] - from[axis]) / delta;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
  }
  return exit > enter && exit > 0 && enter < 1 ? { enter, exit } : null;
}

export function passageTarget(from, target, box) {
  if (
    !validPassage(box) ||
    target.x <= box.left ||
    target.x >= box.right ||
    target.y <= box.top ||
    target.y >= box.bottom
  )
    return target;
  const dx = target.x - from.x,
    dy = target.y - from.y;
  if (!dx && !dy) return target;
  const exits = [];
  if (dx) exits.push(((dx > 0 ? box.right : box.left) - from.x) / dx);
  if (dy) exits.push(((dy > 0 ? box.bottom : box.top) - from.y) / dy);
  const t = Math.min(...exits.filter((value) => value > 0));
  return { x: from.x + dx * t, y: from.y + dy * t };
}

export function sceneWalk(from, target, elapsedMs, box = null) {
  const dx = target.x - from.x,
    dy = target.y - from.y;
  const duration = Math.hypot(dx / 12, dy / 16) * 1000;
  const skip = crossing(from, target, box);
  const gap = skip ? skip.exit - skip.enter : 0;
  const remainingMs = duration * (1 - gap);
  let progress = duration ? Math.min(1 - gap, Math.max(0, elapsedMs) / duration) : 1;
  // Percent coordinates come from DOM pixels. At an exact entry/exit, binary
  // rounding must not report zero remaining time while leaving us at entry.
  const completed = elapsedMs >= remainingMs - 1e-7;
  const crossed = !!skip && (completed || progress + 1e-10 >= skip.enter);
  if (completed) progress = 1;
  else if (crossed) progress += gap;
  if (!duration) progress = 1;
  return {
    x: from.x + dx * progress,
    y: from.y + dy * progress,
    remainingMs: Math.max(0, remainingMs - Math.max(0, elapsedMs)),
    crossed,
  };
}
