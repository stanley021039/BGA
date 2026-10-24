'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SecondWindGame } = require('../src/games/second-wind/game');
const { SecondWindRoom } = require('../src/games/second-wind/room');
const { randomUUID } = require('node:crypto');

function advance(game, players, choose = 0) {
  const v = game.view(players[0]);
  let id, action;
  if (['draft-rolloff', 'race-rolloff'].includes(v.phase)) {
    id = players.find((p) => !Object.hasOwn(v.rolls, p));
    action = { type: 'roll' };
  } else if (v.phase === 'drafting') {
    id = v.turnId;
    action = { type: 'draft', racerId: v.market[choose % v.market.length] };
  } else if (v.phase === 'choosing') {
    id = players.find((p) => !v.selectedIds.includes(p));
    action = { type: 'select', racerId: v.teams[id][0] };
  } else if (v.pending) {
    id = v.pending.playerId;
    const q = game.view(id).pending;
    action = {
      type: 'choice',
      choiceId: q.id,
      value:
        q.options.find((o) => o.value === 'skip')?.value ||
        q.options[choose % q.options.length].value,
    };
  } else if (v.phase === 'racing') {
    id = v.turnId;
    action = { type: 'roll' };
  } else if (v.phase === 'race-result') {
    id = v.first;
    action = { type: 'next-race' };
  } else return false;
  game.act(id, action, v.revision);
  return true;
}
test('complete four races across seeded rosters, private choices and preserved racer counts', () => {
  for (let seed = 0; seed < 60; seed++) {
    const players = Array.from({ length: 3 + (seed % 4) }, (_, i) => 'p' + i),
      game = new SecondWindGame({ playerIds: players, seed });
    let steps = 0;
    while (game.view(players[0]).phase !== 'finished' && steps++ < 1800)
      advance(game, players, steps);
    const v = game.view(players[0]);
    assert.equal(
      v.phase,
      'finished',
      JSON.stringify({
        seed,
        phase: v.phase,
        steps,
        pending: v.pending,
        events: v.events?.slice(-5),
      }),
    );
    assert.equal(v.results.length, 4);
    assert.ok(v.winners.length);
    assert.ok(Object.values(v.scores).every(Number.isSafeInteger));
    assert.ok(Object.values(v.teams).every((cards) => !cards.length));
    assert.equal(JSON.stringify(v).includes('randomKey'), false);
    assert.equal(JSON.stringify(v).includes('secretNumber'), false);
  }
});
test('invalid choice, outsider and stale revision leave game unchanged', () => {
  const game = new SecondWindGame({ playerIds: ['a', 'b', 'c'], seed: 7 });
  while (!game.state) advance(game, ['a', 'b', 'c']);
  const before = game.view('a');
  assert.throws(() => game.act('outsider', { type: 'roll' }, before.revision), {
    code: 'NOT_SEATED',
  });
  assert.throws(() => game.act('a', { type: 'roll' }, before.revision - 1), {
    code: 'STALE_REVISION',
  });
  assert.throws(() =>
    game.act('a', { type: 'choice', choiceId: 'fake', value: 'fake' }, before.revision),
  );
  assert.deepEqual(game.view('a'), before);
});
test('room receipts are idempotent and leaving interrupts without private history', () => {
  const room = new SecondWindRoom('ABCDEF', '試玩'),
    a = room.add('甲'),
    b = room.add('乙');
  room.add('丙');
  room.start();
  const s = room.view(a.id),
    data = { roundId: s.roundId, requestId: randomUUID(), expectedRevision: s.game.revision };
  room.act(a.id, 'roll', data);
  const after = room.view(a.id);
  room.act(a.id, 'roll', data);
  assert.deepEqual(room.view(a.id), after);
  assert.equal('game' in room.historyState(), false);
  assert.equal(JSON.stringify(room.historyState()).includes('secret'), false);
  room.kick(a.id, b.id);
  assert.equal(room.view(a.id).game, null);
  assert.equal(room.interrupted, true);
});
module.exports = { advance };
