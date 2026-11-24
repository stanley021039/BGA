const kinds = ['armor', 'healing', 'recovery', 'dimension', 'stone'];
const percent = (actor, kind, time) =>
  time < (actor.bossAilments?.[kind]?.until || 0) ? actor.bossAilments[kind].percent : 0;
function mark(actor, kind, value, time, ms) {
  if (!kinds.includes(kind)) return;
  actor.bossAilments ||= {};
  const old = actor.bossAilments[kind];
  if (!old || old.until <= time || old.percent <= value)
    actor.bossAilments[kind] = { percent: value, until: time + Math.min(3000, ms) };
}
const healingFactor = (actor, time) =>
  1 -
  Math.max(time < (actor.regenDebuffUntil || 0) ? 10 : 0, percent(actor, 'healing', time)) / 100;
const recoveryFactor = (actor, time) =>
  1 -
  Math.max(time < (actor.energyDebuffUntil || 0) ? 10 : 0, percent(actor, 'recovery', time)) / 100;
const view = (actor, time) =>
  !actor.health
    ? []
    : kinds.flatMap((type) =>
        percent(actor, type, time)
          ? [
              {
                type,
                percent: percent(actor, type, time),
                remainingMs: actor.bossAilments[type].until - time,
              },
            ]
          : [],
      );
module.exports = { percent, mark, healingFactor, recoveryFactor, view };
