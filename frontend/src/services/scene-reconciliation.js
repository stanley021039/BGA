const wrapDelta = (value) => ((value + 150) % 100) - 50;
export function sceneCorrection(previous, next, enabled) {
  if (!enabled) return null;
  const x = wrapDelta(previous.x - next.x),
    y = wrapDelta(previous.y - next.y);
  const distance = Math.hypot(x, y);
  return distance > 0.01 && distance <= 12 ? { x, y } : null;
}
export function reconcileScenePosition(position, correction, elapsed) {
  if (!correction) return position;
  const remaining = Math.max(0, 1 - elapsed / 160);
  return {
    ...position,
    x: position.x + correction.x * remaining,
    y: position.y + correction.y * remaining,
  };
}
// Monotonic clock estimate from the fastest recent HTTP sample. It never uses
// the user's wall clock, and never extrapolates more than 500ms of snapshot age.
export function createSceneSnapshotClock() {
  let anchor = null;
  return {
    sample(serverNow, start, end) {
      const rtt = end - start;
      if (![serverNow, start, end].every(Number.isFinite) || rtt < 0) return;
      if (!anchor || end - anchor.at > 30000 || rtt <= anchor.rtt)
        anchor = { server: serverNow + Math.min(500, rtt / 2), at: end, rtt };
    },
    age(serverNow, now) {
      if (!anchor || !Number.isFinite(serverNow) || !Number.isFinite(now)) return 0;
      return Math.max(0, Math.min(500, anchor.server + now - anchor.at - serverNow));
    },
    reset() {
      anchor = null;
    },
  };
}
