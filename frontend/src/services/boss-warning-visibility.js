// Presentation only. Actual windup, damage, locked direction and safe gaps stay
// in bossAttackPlan; both renderers share this short, restrained floor cue.
export function bossWarningOpacity(slot, windup, strikeAt, age, rate = 1) {
  if (
    ![windup, strikeAt, age, rate].every(Number.isFinite) ||
    windup <= 0 ||
    rate < 1 ||
    rate > 1.3
  )
    return 0;
  const lead = Math.min(windup, (slot === 'r' ? 850 : 550) * rate);
  const remaining = strikeAt - age;
  if (remaining > lead + 0.000001 || remaining <= -120 * rate) return 0;
  return remaining >= 0
    ? 0.1 + 0.07 * (1 - remaining / lead)
    : 0.12 * (1 + remaining / (120 * rate));
}
