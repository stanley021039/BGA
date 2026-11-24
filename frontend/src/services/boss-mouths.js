// Lip anchors match the three beam emitters in boss-strike-art.js (256px atlas space).
export const ghidorahMouths = [
  { x: 80.64, y: 85.5, rx: 6.2, jaw: 'M73 85Q80 83 88 85L88 92Q85 99 80 100Q74 98 73 92Z' },
  { x: 124.16, y: 69.9, rx: 6, jaw: 'M117 70Q124 68 132 70L132 76Q130 82 124 82Q118 80 117 76Z' },
  {
    x: 173.57,
    y: 87.04,
    rx: 6.1,
    jaw: 'M165 87Q174 85 182 87L182 93Q179 100 174 100Q167 98 165 93Z',
  },
];
export const ghidorahMouthPaint = {
  // ui-check-allow hex: 固定角色口腔貼圖的深色墨色，不能隨網站深淺色主題改變。
  cavity: '#29141b',
  // ui-check-allow hex: 固定角色牙齒貼圖色，屬於角色插畫而非介面控制項。
  teeth: '#e7ddc3',
};
export function ghidorahMouthsFor(phase = 1) {
  const anchors =
    phase === 2
      ? [
          [90.5, 88.5, 5.2],
          [113.5, 77.5, 5],
          [142, 91.5, 5.2],
        ]
      : phase === 3
        ? [
            [106, 78, 4.5],
            [127.5, 74.5, 4.5],
            [151.5, 78.5, 4.5],
          ]
        : null;
  return anchors
    ? anchors.map(([x, y, rx]) => ({
        x,
        y,
        rx,
        jaw: `M${x - rx - 1} ${y}Q${x} ${y - 1} ${x + rx + 1} ${y}L${x + rx + 1} ${y + 5}Q${x} ${y + 11} ${x - rx - 1} ${y + 5}Z`,
      }))
    : ghidorahMouths;
}
const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => {
  const p = clamp(v);
  return p * p * (3 - 2 * p);
};
// Read only the shared attack plan's wave/head assignment; no independent clock or timer.
export function ghidorahMouthOpenings(strikes, age, windup, hold = 350) {
  const open = [0, 0, 0];
  if (!Number.isFinite(age) || age < 0 || age >= 4200 || !Number.isFinite(windup) || windup <= 0)
    return open;
  for (const strike of strikes) {
    const before = strike.at - age;
    if (before > windup || age > strike.at + hold + 200) continue;
    const amount =
      before > 0
        ? smooth(((windup - before) / windup - 0.2) / 0.8)
        : 1 - smooth((age - strike.at - hold) / 200);
    for (const head of strike.heads)
      if (Number.isInteger(head) && head >= 0 && head < 3)
        open[head] = Math.max(open[head], amount);
  }
  return open;
}
