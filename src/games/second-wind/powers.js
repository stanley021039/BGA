'use strict';

const { fail } = require('../party-base');
const { allRacers: catalog } = require('./catalog');
const known = new Set(catalog.map((racer) => racer.id));
const present = (racer) => !racer.finished && !racer.eliminated;
function listed(racer) {
  // A copied power is supplied only after its separate before-race decision resolves.
  const powers = [racer.racerId, ...(racer.copiedPowers || [])];
  if (!powers.every((id) => known.has(id))) fail('UNKNOWN_POWER', '角色能力資料不正確', 400);
  return [...new Set(powers)];
}
function expanded(racer, racers, beforeRace = false, seen = new Set()) {
  const powers = listed(racer);
  if (beforeRace || !powers.includes('copy-cat') || seen.has(racer.id)) return powers;
  const nextSeen = new Set([...seen, racer.id]);
  const active = racers.filter(present),
    lead = Math.max(...active.map((r) => r.position));
  const leaders = active.filter((r) => r.position === lead);
  const target =
    leaders.find((r) => r.id === racer.copyTarget) || (leaders.length === 1 ? leaders[0] : null);
  return target && target.id !== racer.id
    ? [...new Set([...powers, ...expanded(target, racers, false, nextSeen)])]
    : powers;
}
function validate(racers) {
  if (
    !Array.isArray(racers) ||
    new Set(racers.map((racer) => racer?.id)).size !== racers.length ||
    racers.some(
      (racer) =>
        !racer ||
        typeof racer.id !== 'string' ||
        !racer.id ||
        !Number.isSafeInteger(racer.position) ||
        racer.position < 0 ||
        racer.position > 30 ||
        (racer.copiedPowers !== undefined && !Array.isArray(racer.copiedPowers)),
    )
  )
    fail('INVALID_POWER_STATE', '能力投影狀態不正確', 400);
  racers.forEach(listed);
}
function effectivePowers(racers, racerId, { outsideRace = false, beforeRace = false } = {}) {
  validate(racers);
  const racer = racers.find((racer) => racer.id === racerId);
  if (!racer) fail('RACER_NOT_FOUND', '找不到角色', 400);
  // Re-Runner's own persistent after-race effect survives finish, elimination and NULL.
  // Copying Re-Runner never grants that outside-race effect (PDF pp.24–27).
  if (outsideRace) return racer.racerId === 're-runner' ? ['re-runner'] : [];
  if (!present(racer)) return [];
  const disabled = racers.some(
    (other) =>
      present(other) &&
      other.position < racer.position &&
      expanded(other, racers, beforeRace).includes('null'),
  );
  return disabled ? [] : expanded(racer, racers, beforeRace);
}
function rollConstraints(racers, racerId) {
  validate(racers);
  const racer = racers.find((racer) => racer.id === racerId);
  if (!racer || !present(racer)) fail('RACER_INACTIVE', '角色目前不在賽道上');
  const sources = racers
    .filter(
      (other) =>
        other.id !== racerId &&
        Math.abs(other.position - racer.position) <= 1 &&
        effectivePowers(racers, other.id).includes('stunner'),
    )
    .map((other) => other.id);
  return {
    fixedValue: sources.length ? 1 : null,
    stunnerIds: sources,
    rerollSixFor: racers
      .filter((other) => effectivePowers(racers, other.id).includes('party-pooper'))
      .map((other) => other.id),
  };
}
/** One mandatory die step. Optional Critic rerolls must still resolve before committing a roll. */
function mandatoryDieStep(racers, racerId, rolledValue) {
  if (!Number.isInteger(rolledValue) || rolledValue < 1 || rolledValue > 6)
    fail('INVALID_DIE', '骰值必須為 1–6', 400);
  const constraints = rollConstraints(racers, racerId);
  const value = constraints.fixedValue ?? rolledValue;
  const reroll = value === 6 && constraints.rerollSixFor.length > 0;
  return {
    racerId,
    rolledValue,
    candidateValue: reroll ? null : value,
    reroll,
    requiresOptionalRerollWindow: !reroll,
    // Resolve each reaction (and its landing effects) BEFORE asking for the replacement die.
    reactions: reroll
      ? constraints.rerollSixFor.map((id) => ({
          type: 'move',
          racerId: id,
          distance: 1,
          source: 'party-pooper',
        }))
      : [],
  };
}
module.exports = { effectivePowers, rollConstraints, mandatoryDieStep };
