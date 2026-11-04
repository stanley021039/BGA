'use strict';
const definitions = require('../../public/shared/attack-effects.json');
const kinds = new Map(definitions.map((e) => [e.id, e.variantOf || e.id]));
const attackKind = (effect) => kinds.get(effect) || effect;
module.exports = { attackKind };
