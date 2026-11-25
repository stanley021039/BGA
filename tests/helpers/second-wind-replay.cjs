'use strict';

// Keep production crypto unchanged. Each simulation gets an isolated module
// with recorded entropy, so parallel tests never patch the shared crypto API.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

module.exports = function replayGame(seed, replay) {
  const file = path.resolve(__dirname, '../../src/games/second-wind/game.js');
  const loaded = new Module(file, module);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  let state = seed >>> 0;
  const entropy = { seed: state, draws: [], uuidCount: 0 };
  loaded.require = (id) =>
    id === 'node:crypto'
      ? {
          ...crypto,
          randomInt(min, max) {
            if (max === undefined) {
              max = min;
              min = 0;
            }
            state = (Math.imul(1664525, state) + 1013904223) >>> 0;
            let value = min + Math.floor((state / 0x100000000) * (max - min));
            if (replay) {
              const recorded = replay[entropy.draws.length];
              assert.ok(recorded, 'replay entropy exhausted');
              assert.equal(recorded.min, min);
              assert.equal(recorded.max, max);
              value = recorded.value;
              assert.ok(Number.isInteger(value) && value >= min && value < max);
            }
            entropy.draws.push({ min, max, value });
            return value;
          },
          randomUUID() {
            return `00000000-0000-4000-8000-${String(++entropy.uuidCount).padStart(12, '0')}`;
          },
        }
      : Module.prototype.require.call(loaded, id);
  loaded._compile(fs.readFileSync(file, 'utf8'), file);
  return { Game: loaded.exports.SecondWindGame, entropy };
};
