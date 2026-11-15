const { playerInteractions: rules, finalCycle } = require('../../public/shared/boss-rules.json');
const fields = [
  'bossControlImmuneUntil',
  'bossParalysisProtectUntil',
  'bossInterruptedAt',
  'bossSealProtectUntil',
  'bossRDelayMs',
  'bossEquationUntil',
  'bossArmorUntil',
  'bossBurstUntil',
  'bossBlinkSafeUntil',
];
function resetBossInteractions(actor) {
  for (const field of fields) actor[field] = 0;
  actor.bossFinalCycle = null;
}
const immune = (actor, time) => !!actor.bossId && time < (actor.bossControlImmuneUntil || 0);
function clearControl(actor) {
  actor.bossParalysisProtectUntil = 0;
  for (const field of [
    'immobileUntil',
    'stasisUntil',
    'sealedUntil',
    'slowUntil',
    'strongSlowUntil',
    'orangeSlowUntil',
    'bijuuSlowUntil',
    'teleportBlockedUntil',
  ])
    actor[field] = 0;
  actor.knockback = null;
  actor.targetX = actor.x;
  actor.targetY = actor.y;
}
function newCycle(start, index, random) {
  const ms = ([min, max]) =>
    1000 * (min + Math.min(max - min, Math.floor(random() * (max - min + 1))));
  const immuneUntil = start + ms(finalCycle.immuneSeconds);
  const burstUntil = immuneUntil + ms(finalCycle.burstSeconds);
  return { start, index, immuneUntil, burstUntil, until: burstUntil + ms(finalCycle.rageSeconds) };
}
function beginPhaseImmunity(actor, time, phase, random = Math.random) {
  if (!actor.bossId || phase < 2) return;
  clearControl(actor);
  if (phase === 3) {
    actor.bossFinalCycle = newCycle(time, 0, random);
    actor.bossControlImmuneUntil = actor.bossFinalCycle.immuneUntil;
  } else actor.bossControlImmuneUntil = time + rules.secondPhaseControlImmunityMs;
}
function cycleState(actor, time) {
  const cycle = actor.bossFinalCycle;
  if (!actor.bossId || actor.bossPhase !== 3 || !cycle || !actor.health) return null;
  if (time < cycle.immuneUntil) return { mode: 'immune', until: cycle.immuneUntil };
  if (time < cycle.burstUntil)
    return {
      mode: finalCycle.teleportBosses.includes(actor.bossId) ? 'teleport' : 'dash',
      until: cycle.burstUntil,
    };
  return { mode: 'rage', until: cycle.until };
}
function advanceCycle(actor, time, random = Math.random) {
  if (!actor.bossId || actor.bossPhase !== 3 || !actor.health) return;
  if (!actor.bossFinalCycle) beginPhaseImmunity(actor, time, 3, random);
  let cycle = actor.bossFinalCycle,
    loops = 0;
  while (time >= cycle.until && loops++ < 16)
    cycle = newCycle(cycle.until, cycle.index + 1, random);
  if (time >= cycle.until) cycle = newCycle(time, cycle.index + 1, random);
  if (cycle !== actor.bossFinalCycle) {
    clearControl(actor);
    actor.bossFinalCycle = cycle;
    actor.bossControlImmuneUntil = cycle.immuneUntil;
  }
  const state = cycleState(actor, time);
  actor.bossBurstUntil = ['dash', 'teleport'].includes(state.mode) ? state.until : 0;
}
const burstSpeed = (actor, time) =>
  cycleState(actor, time)?.mode === 'dash' ? finalCycle.speedMultiplier : 1;
function paralysisDuration(actor, time, duration) {
  if (!actor.bossId) return duration;
  if (immune(actor, time) || time < (actor.bossParalysisProtectUntil || 0)) return 0;
  const effective = Math.max(
    1,
    Math.round(duration * rules.paralysisScale[(actor.bossPhase || 1) - 1]),
  );
  actor.bossParalysisProtectUntil = time + effective + rules.paralysisProtectionMs;
  actor.bossInterruptedAt = time;
  return effective;
}
function sealBoss(actor, time, duration) {
  if (immune(actor, time) || time < (actor.bossSealProtectUntil || 0)) return;
  actor.sealedUntil = Math.max(
    actor.sealedUntil || 0,
    time + Math.min(duration, rules.sealMaximumMs),
  );
  actor.bossSealProtectUntil = actor.sealedUntil + rules.sealProtectionMs;
}
function drainBossCharge(actor, amount) {
  if (!actor.bossId || actor.bossIntent?.ultimate || !actor.health) return 0;
  const drained = Math.min(Math.max(0, actor.bossCharge || 0), Math.max(0, amount));
  actor.bossCharge = Math.max(0, (actor.bossCharge || 0) - drained);
  actor.bossRDelayMs = Math.min(
    rules.drainDelayMaximumMs,
    (actor.bossRDelayMs || 0) + drained * rules.drainDelayPerEnergyMs,
  );
  return drained;
}
const vulnerability = (actor, time) =>
  !actor.bossId
    ? 0
    : Math.max(
        time < (actor.bossEquationUntil || 0) ? rules.equationBonus : 0,
        time < (actor.bossArmorUntil || 0) ? rules.armorBonus : 0,
      );
module.exports = {
  rules,
  finalCycle,
  resetBossInteractions,
  beginPhaseImmunity,
  immune,
  paralysisDuration,
  sealBoss,
  drainBossCharge,
  vulnerability,
  cycleState,
  advanceCycle,
  burstSpeed,
};
