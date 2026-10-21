'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { QuacksRoom } = require('../src/games/quacks');
test('accepted manual draw gets a private sound event before peers decide, with no retry duplication', () => {
  const room = new QuacksRoom('ABCDEF', 'audio', () => 0);
  const a = room.add('A'),
    b = room.add('B');
  room.start();
  room.drawFortune();
  a.bag = [room.chip('orange')];
  b.bag = [room.chip('orange')];
  const payload = { step: room.step, roundId: room.roundId, requestId: randomUUID() };
  room.act(a.id, 'draw', payload);
  assert.equal(a.drawEvents.length, 0, 'no chip is resolved before the peer chooses');
  assert.equal(a.drawDecisionEvents.length, 1);
  assert.equal(room.view(a.id).mine.drawDecisionEvents[0].decision, true);
  assert.equal(room.view(b.id).mine.drawDecisionEvents.length, 0);
  assert.equal(
    Object.hasOwn(
      room.view(b.id).recipes.find((p) => p.id === a.id),
      'drawDecisionEvents',
    ),
    false,
  );
  room.act(a.id, 'draw', payload);
  assert.equal(a.drawDecisionEvents.length, 1);
  room.act(b.id, 'stop', { step: room.step, roundId: room.roundId, requestId: randomUUID() });
  assert.equal(a.drawEvents.length, 1);
  assert.equal(a.drawDecisionEvents.length, 1, 'resolution does not create a second voice event');
  assert.equal(b.stopEvents.length, 1);
  assert.equal(b.drawDecisionEvents.length, 0);
});
