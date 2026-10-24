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
test('only the starter gets a center card and no request is sent until it is clicked', async () => {
  const f = fixture();
  const card = f.host.children[0].children[1];
  f.c.update({ ...f.s, me: 'b' });
  await card.onclick();
  assert.equal(f.host.hidden, true);
  assert.equal(f.calls.length, 0);
  f.c.update(f.s);
  await f.tick(1000);
  assert.equal(f.host.hidden, false);
  assert.equal(f.calls.length, 0);
  await card.onclick();
  await card.onclick();
  assert.deepEqual(f.calls, ['fortune-round1']);
  assert.equal(f.host.hidden, true);
  f.c.update(f.s);
  await f.tick(1000);
  assert.equal(f.calls.length, 1);
  f.c.reset();
  f.c.update(f.s);
  await card.onclick();
  assert.deepEqual(f.calls, ['fortune-round1', 'fortune-round1']);
  f.c.destroy();
  assert.equal(f.timers.size, 0);
});
test('busy, hidden and wrong-phase clicks do not draw; next round needs its own click', async () => {
  const f = fixture(),
    card = f.host.children[0].children[1];
  f.busy(true);
  f.c.update(f.s);
  await card.onclick();
  assert.equal(f.calls.length, 0);
  f.busy(false);
  f.document.hidden = true;
  f.events.visibilitychange();
  await card.onclick();
  assert.equal(f.host.hidden, true);
  assert.equal(f.calls.length, 0);
  f.document.hidden = false;
  f.c.update({ ...f.s, phase: 'brewing' });
  await card.onclick();
  assert.equal(f.calls.length, 0);
  f.c.update({ ...f.s, roundId: 'round2' });
  await f.tick(1000);
  assert.equal(f.calls.length, 0);
  await card.onclick();
  assert.deepEqual(f.calls, ['fortune-round2']);
  f.c.destroy();
});
test('failed manual draws can be retried by clicking without automatic retry loops', async () => {
  const f = fixture(),
    card = f.host.children[0].children[1];
  let attempts = 0;
  f.draw(async () => {
    attempts++;
    throw Error('offline');
  });
  f.c.update(f.s);
  await card.onclick();
  assert.equal(attempts, 1);
  assert.equal(f.host.hidden, false);
  f.c.update(f.s);
  await f.tick(1000);
  assert.equal(attempts, 1);
  f.draw(async () => {
    attempts++;
    return false;
  });
  await card.onclick();
  assert.equal(attempts, 2);
  assert.equal(f.host.hidden, false);
  f.c.destroy();
});
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
