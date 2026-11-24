'use strict';
const { randomInt } = require('node:crypto');
const attacks = require('../../public/shared/attack-effects.json');
const palette = require('../../public/shared/entrance-palette.json');
const entrances = [
  ...palette.starters,
  ...require('../../public/shared/entrance-requirements.json'),
  ...palette.variants,
].map((e) => e.id);
const ordinary = attacks.filter((e) => !e.area && !e.ultimate).map((e) => e.id);
const ultimate = attacks.filter((e) => e.area || e.ultimate).map((e) => e.id);
const pick = (items) => items[randomInt(items.length)];
function randomArenaLoadout() {
  const q = pick(ordinary);
  return {
    q,
    e: pick(ordinary.filter((id) => id !== q)),
    r: pick(ultimate),
    entrance: pick(entrances),
  };
}
module.exports = { randomArenaLoadout };
