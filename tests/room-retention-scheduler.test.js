const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs');
test('offline room still advances a due phase but does not run test AI', () => {
  let ai = 0,
    auto = 0;
  const callbacks = [];
  const r = {
    type: 'majority',
    phase: 'answering',
    players: [{ lastSeen: 0 }],
    deadline: 1,
    auto() {
      auto++;
      this.deadline = null;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/rooms/scheduler'), 'utf8'), {
    module,
    console,
    Date: { now: () => 200000 },
    setInterval: (cb) => {
      callbacks.push(cb);
      return { unref() {} };
    },
    clearInterval() {},
    require: (n) =>
      n === '../ai'
        ? {
            runTestAIStep() {
              ai++;
            },
          }
        : n === './lifecycle'
          ? require('../src/rooms/lifecycle')
          : { createRoomTransitions: () => ({ transact: (room, op, run) => run() }) },
  });
  const stop = module.exports.startRoomScheduler({ rooms: new Map([['A', r]]) });
  callbacks[1]();
  callbacks[1]();
  assert.equal(auto, 1);
  assert.equal(ai, 0);
  r.players[0].lastSeen = Date.now();
  callbacks[1]();
  assert.equal(ai, 1);
  stop();
});
