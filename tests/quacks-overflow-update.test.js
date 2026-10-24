'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  { randomUUID } = require('node:crypto'),
  { QuacksRoom } = require('../src/games/quacks');
function room() {
  const r = new QuacksRoom('ABCDEF', 'overflow', () => 0),
    a = r.add('A'),
    b = r.add('B');
  r.configure(a.id, { witches: true });
  r.start();
  r.drawFortune();
  r.fortune = { id: 'none' };
  r.phase = 'brewing';
  r.stage = 'drawing';
  for (const p of r.players) {
    p.pending = [];
    p.stopped = false;
  }
  a.position = 50;
  a.pot = [];
  a.overflow = [];
  a.bag = [
    r.chip('orange', 6),
    r.chip('green', 2),
    r.chip('blue', 4),
    r.chip('white', 3),
    r.chip('white', 3),
    r.chip('white', 2),
    r.chip('orange', 1),
  ];
  return { r, a, b };
}
const command = (r, p, action) =>
  r.act(p.id, action, { roundId: r.roundId, requestId: randomUUID(), step: r.step });
test('draw commands reach 52 then continuously enter the basin; white overflow still explodes', () => {
  const { r, a, b } = room();
  command(r, b, 'stop');
  command(r, a, 'draw');
  assert.equal(a.position, 52);
  assert.equal(a.stopped, false);
  assert.equal(a.pot.length, 1);
  assert.equal(a.overflow.length, 0);
  for (let i = 1; i <= 4; i++) {
    assert.equal(r.view(a.id).mine.canDraw, true);
    command(r, a, 'draw');
    assert.equal(a.position, 52);
    assert.equal(a.pot.length, 1);
    assert.equal(a.overflow.length, i);
    assert.equal(a.pending.length, 0);
  }
  assert.equal(r.white(a), 6);
  assert.equal(a.exploded, false);
  command(r, a, 'draw');
  assert.equal(a.overflow.length, 5);
  assert.equal(r.white(a), 8);
  assert.equal(a.exploded, true);
  assert.equal(r.view(a.id).mine.canDraw, false);
  assert.equal(r.phase, 'settlement');
});
test('overflow points round down, stay separate from the cauldron and return to the bag next round', () => {
  const { r, a, b } = room();
  command(r, b, 'stop');
  for (let i = 0; i < 3; i++) command(r, a, 'draw');
  command(r, a, 'stop');
  r.rewardPhase();
  r.enterShopping();
  assert.equal(a.score, a.field.points + 3);
  const ids = [...a.pot, ...a.overflow].map((c) => c.id);
  r.endRound();
  assert.equal(a.overflow.length, 2);
  assert.equal(a.pot.length, 1);
  r.nextRound();
  assert.ok(ids.every((id) => a.bag.some((c) => c.id === id)));
  assert.equal(a.pot.length, 0);
  assert.equal(a.position, a.droplet);
  assert.equal(a.overflow.length, 0);
});
