'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('fs'),
  vm = require('vm');
function fixture() {
  let time = 0,
    id = 0,
    busy = false;
  const timers = new Map(),
    events = {},
    calls = [],
    body = {
      children: [],
      append(n) {
        this.children.push(n);
      },
    };
  const element = () => ({
    hidden: false,
    children: [],
    setAttribute() {},
    append(...nodes) {
      this.children.push(...nodes);
    },
    remove() {
      this.removed = true;
    },
  });
  const document = {
      body,
      hidden: false,
      createElement: element,
      addEventListener: (k, f) => (events[k] = f),
      removeEventListener: (k) => delete events[k],
    },
    window = {};
  let draw = async (key) => {
    calls.push(key);
  };
  vm.runInNewContext(fs.readFileSync('public/quacks-auto-fortune.js', 'utf8'), {
    window,
    document,
    setTimeout(fn, delay) {
      timers.set(++id, { fn, at: time + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  const c = window.QuacksAutoFortune.create({
      draw: (key) => draw(key),
      isBusy: () => busy,
      delay: 50,
    }),
    s = { code: 'ABC123', roundId: 'round1', phase: 'fortune', me: 'a', roundStarterId: 'a' };
  return {
    c,
    s,
    calls,
    body,
    document,
    timers,
    events,
    host: body.children[0],
    busy: (v) => (busy = v),
    draw: (fn) => (draw = fn),
    async tick(ms) {
      time += ms;
      for (const [id, t] of [...timers]) if (t.at <= time && timers.delete(id)) await t.fn();
    },
  };
}
test('fixed fortune receipts cannot consume a second card in the same round', () => {
  const { QuacksRoom } = require('../src/games/quacks'),
    r = new QuacksRoom('ABCDEF', 'auto', () => 0),
    a = r.add('A');
  r.add('B');
  r.start();
  const data = { roundId: r.roundId, requestId: 'fortune-' + r.roundId };
  const n = r.deck.length;
  r.act(a.id, 'draw-fortune', data);
  const id = r.fortuneRevealId;
  r.act(a.id, 'draw-fortune', data);
  assert.equal(r.deck.length, n - 1);
  assert.equal(r.fortuneRevealId, id);
});
