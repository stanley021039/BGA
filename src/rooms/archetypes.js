'use strict';
const types = Object.freeze({
  attack: Object.freeze({ name: '攻擊型', damage: 1.15, speed: 1, defense: 1, health: 1 }),
  speed: Object.freeze({ name: '速度型', damage: 1, speed: 1.3, defense: 1, health: 1 }),
  defense: Object.freeze({ name: '防禦型', damage: 1, speed: 1, defense: 0.75, health: 1 }),
  health: Object.freeze({ name: '生命型', damage: 1, speed: 1, defense: 1, health: 1.35 }),
  energy: Object.freeze({
    name: '能量型',
    damage: 1,
    speed: 1,
    defense: 1,
    health: 1,
    energyGain: 1.2,
  }),
});
const neutral = Object.freeze({ name: '均衡', damage: 1, speed: 1, defense: 1, health: 1 });
function profile(actor) {
  return Object.hasOwn(types, actor.archetype) ? types[actor.archetype] : neutral;
}
module.exports = { types, profile };
