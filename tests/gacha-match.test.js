'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Room } = require('../src/games/poker');
const { attachGachaMatch, winners, normalEnd } = require('../src/gacha/match-tracker');
const { captureRoom, restoreRoom } = require('../src/rooms/persistence');
const users = [randomUUID(), randomUUID(), randomUUID()];
function equip(room) {
  attachGachaMatch(room, (r, ids) =>
    ids.map((id) => ({ user_id: users[r.players.findIndex((p) => p.id === id)], seat_id: id })),
  );
  return room;
}
function poker() {
  const r = equip(new Room('GC', 'GC', () => 0));
  r.add('同名');
  r.add('同名');
  return r;
}
function action(r, id, type) {
  return r.gachaMatch.humanAction(id, type, () => r.humanAct(id, type));
}
function finish(r, human = true) {
  let n = 0;
  while (r.phase !== 'showdown' && n++ < 40) {
    const p = r.players[r.turn],
      type = p.bet < r.currentBet ? 'call' : 'check';
    if (human) action(r, p.id, type);
    else r.act(p.id, type);
  }
  assert.equal(r.phase, 'showdown');
}
test('real poker hand freezes identities and credits only explicit human commands', () => {
  const r = poker();
  assert.throws(() => r.start.call({ ...r, players: [] }));
  r.start();
  const first = r.players[r.turn];
  assert.throws(() => action(r, first.id, 'invalid'));
  finish(r, false);
  const result = r.gachaMatch.finish();
  assert.equal(result.participants.length, 2);
  assert.ok(result.participants.every((p) => !p.operated));
  assert.ok(result.participants.some((p) => p.winner));
  assert.ok(r.results.every((p) => p.playerId));
  r.gachaMatch.acknowledge();
  assert.equal(r.gachaMatch.finish(), null);
  r.start();
  finish(r);
  assert.ok(r.gachaMatch.finish().participants.every((p) => p.operated));
});
test('room snapshot preserves actions and receipt identity across restart and retry', () => {
  const r = poker();
  r.start();
  action(r, r.players[r.turn].id, 'call');
  const saved = captureRoom(r, { gacha: r.gachaMatch.snapshot() });
  const restored = restoreRoom(saved, () => equip(new Room('GC', 'GC', () => 0)));
  const next = restored.room;
  next.gachaMatch.restore(restored.extra.gacha);
  assert.equal(next.gachaMatch.snapshot().id, r.gachaMatch.snapshot().id);
  assert.equal(next.gachaMatch.snapshot().operated.size, 1);
  finish(next, false);
  const result = next.gachaMatch.finish();
  assert.equal(result.participants.filter((p) => p.operated).length, 1);
  assert.deepEqual(next.gachaMatch.finish(), result);
});
test('bots, kicked seats, premature games and management-only actions cannot earn coins', () => {
  const r = poker();
  r.add('bot', true);
  r.start();
  r.gachaMatch.humanAction(r.players[0].id, 'chat', () => {});
  finish(r, false);
  assert.equal(r.gachaMatch.finish().participants.length, 2);
  assert.ok(r.gachaMatch.finish().participants.every((p) => !p.operated));
  const interrupted = poker();
  interrupted.start();
  interrupted.players[1].kicked = true;
  finish(interrupted);
  assert.equal(interrupted.gachaMatch.finish(), null);
  assert.equal(normalEnd({ type: 'gift', phase: 'finished', winner: { ids: [] } }), false);
  assert.equal(
    normalEnd({ type: 'trpg', phase: 'finished', round: 5, winner: { restored: true } }),
    false,
  );
  assert.equal(
    normalEnd({
      type: 'quacks',
      phase: 'finished',
      round: 8,
      winner: { score: 30 },
      players: [{ score: 30 }],
    }),
    false,
  );
});
test('cooperative wins, competitive ties and no-winner telephone use authoritative identities', () => {
  assert.deepEqual(
    [
      ...winners({
        type: 'trpg',
        winner: { restored: true },
        players: [{ id: 'a' }, { id: 'b' }, { id: 'c', kicked: true }],
      }),
    ],
    ['a', 'b'],
  );
  assert.equal(winners({ type: 'trpg', winner: { restored: false }, players: [] }).size, 0);
  assert.deepEqual(
    [
      ...winners({
        type: 'quacks',
        winner: { score: 9 },
        players: [
          { id: 'a', score: 9, position: 12 },
          { id: 'b', score: 9, position: 10 },
          { id: 'c', score: 9, position: 12 },
        ],
      }),
    ],
    ['a', 'c'],
  );
  assert.deepEqual(
    [
      ...winners({
        type: 'minimal',
        winner: { score: 5 },
        players: [
          { id: 'a', score: 5 },
          { id: 'b', score: 5 },
        ],
      }),
    ],
    ['a', 'b'],
  );
  assert.equal(
    normalEnd({ type: 'telephone', phase: 'finished', round: 3, roundLimit: 3, books: [{}, {}] }),
    true,
  );
});
