// Age comes from the server entity. No extra animation clock survives the canvas.
export function homingScale(ageMs = 0) {
  const age = Number.isFinite(ageMs) ? Math.max(0, ageMs) : 0;
  return 1 + 1.5 * Math.min(1, age / 15000);
}
