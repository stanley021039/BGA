// Source PNGs share this geometry. Mirror World reverses progress, not the art.
export function trackPoint(progress: number, direction = 1): { left: string; top: string } {
  const p = direction === -1 ? 30 - progress : progress;
  const [x, y] =
    p === 0
      ? [10.5, 17]
      : p === 30
        ? [5.5, 51]
        : p <= 12
          ? [22.55 + (p - 1) * 6.62, 17]
          : p === 13
            ? [95.4, 39.5]
            : p === 14
              ? [95.4, 61.5]
              : [95.4 - (p - 15) * 6.42, 83.5];
  return { left: `${x}%`, top: `${y}%` };
}
