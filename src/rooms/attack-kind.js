'use strict';
const definitions = require('../../public/shared/attack-effects.json');
const kinds = new Map(definitions.map((e) => [e.id, e.variantOf || e.id]));
const attackKind = (effect) => kinds.get(effect) || effect;
const reflectable = new Set(
  definitions.filter((e) => !e.area && !e.ultimate && e.damageMultiplier !== 0).map((e) => e.id),
);
const isReflectableAttack = (effect) => reflectable.has(effect);
module.exports = { attackKind, isReflectableAttack };
