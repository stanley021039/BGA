'use strict';
const match = Object.freeze({
  musicquiz: ['musicquiz-intro-streak', 'musicquiz-rescue'],
  bluff: ['bluff-convincing', 'bluff-lie-detector'],
  minimal: ['minimal-three-shapes'],
  telephone: ['telephone-color-relay'],
  trpg: ['trpg-support-three'],
  quacks: [],
});
const unit = Object.freeze({
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
module.exports = { match, unit, validChallenges };
