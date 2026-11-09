'use strict';
const newMatchActions = Object.freeze({
  brainwave: ['shape', 'guess'],
  'drama-bar': ['performed', 'guess'],
  decrypto: ['clues', 'decode', 'intercept', 'keywords'],
  'second-wind': ['roll', 'draft', 'select', 'choice'],
  ceo: ['acquire', 'buyStock', 'dividend'],
});
const match = Object.freeze({
  musicquiz: ['musicquiz-intro-streak', 'musicquiz-rescue'],
  bluff: ['bluff-convincing', 'bluff-lie-detector'],
  minimal: ['minimal-three-shapes'],
  telephone: ['telephone-color-relay'],
  trpg: ['trpg-support-three'],
  quacks: [],
  arena: ['arena-first-win', 'arena-five-points'],
  brainwave: ['brainwave-first-win', 'brainwave-quick-read'],
  'drama-bar': ['drama-bar-first-win', 'drama-bar-unanimous'],
  decrypto: ['decrypto-first-win', 'decrypto-interception'],
  'second-wind': ['second-wind-first-win', 'second-wind-two-races'],
  ceo: ['ceo-first-win', 'ceo-three-transactions'],
});
const unit = Object.freeze({
  draw: ['draw-fastest-correct'],
  poker: ['poker-showdown-straight'],
  thunder: ['thunder-race-winner'],
});
function validChallenges(game, value, scope) {
  return (
    Array.isArray(value) &&
    value.length <= 4 &&
    new Set(value).size === value.length &&
    value.every((id) => (scope[game] || []).includes(id))
  );
}
module.exports = { match, unit, validChallenges, newMatchActions };
