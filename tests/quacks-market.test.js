'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { QuacksRoom } = require('../src/games/quacks'),
  { BOARD, WITCHES } = require('../src/games/quacks-catalog');
const art = require('../public/quacks-art');
const act = (r, p, action, data = {}) =>
  r.act(p.id, action, { roundId: r.roundId, requestId: randomUUID(), ...data });
function fixture(n = 2) {
  const r = new QuacksRoom(
    'ABCDEF',
    'market',
    () => 0,
    () => 1000,
  );
  for (let i = 0; i < n; i++) r.add('P' + i);
  r.configure(r.host, { witches: true });
  r.start();
  r.round = 4;
  r.phase = 'settlement';
  r.stage = 'shopping';
  r.fortune = { id: 'none' };
  for (const p of r.players)
    Object.assign(p, {
      ready: false,
      pending: [],
      canBuy: true,
      budget: 200,
      extraBudget: 200,
      extraBought: [],
      field: BOARD[10],
    });
  r.beginMarketTurns();
  return r;
}
test('one purchase rotates seats, rejects out-of-turn without mutation, and receipt retries do not consume supply twice', () => {
  const r = fixture(),
    a = r.player(r.marketTurn()),
    b = r.players.find((p) => p !== a),
    stock = r.marketStock('orange', 1);
  const before = JSON.stringify(r.view(b.id));
  assert.throws(
    () => act(r, b, 'buy', { color: 'orange', value: 1 }),
    (e) => e.code === 'NOT_SHOP_TURN',
  );
  assert.equal(JSON.stringify(r.view(b.id)), before);
  const data = { roundId: r.roundId, requestId: randomUUID(), color: 'orange', value: 1 };
  r.act(a.id, 'buy', data);
  assert.equal(r.marketTurn(), b.id);
  r.act(a.id, 'buy', data);
  assert.equal(r.marketTurn(), b.id);
  assert.equal(r.marketStock('orange', 1), stock - 1);
  assert.equal(a.bought.length, 1);
  assert.equal(r.view(b.id).market.notices.at(-1).playerId, a.id);
  act(r, b, 'shop-ready');
  assert.equal(r.marketTurn(), a.id);
  act(r, a, 'unbuy', { color: 'orange', value: 1 });
  assert.equal(r.marketStock('orange', 1), stock);
  assert.equal(a.budget, 200);
});
test('sold-out offers and insufficient budgets never charge or rotate; each color/value has independent finite stock', () => {
  const r = fixture(),
    p = r.player(r.marketTurn());
  r.marketSupply['red:1'] = 0;
  const budget = p.budget;
  assert.throws(
    () => act(r, p, 'buy', { color: 'red', value: 1 }),
    (e) => e.code === 'SOLD_OUT',
  );
  assert.equal(p.budget, budget);
  assert.equal(r.marketTurn(), p.id);
  p.budget = 0;
  const stock = r.marketStock('blue', 2);
  assert.throws(
    () => act(r, p, 'buy', { color: 'blue', value: 2 }),
    (e) => e.code === 'CANNOT_BUY',
  );
  assert.equal(r.marketStock('blue', 2), stock);
  assert.ok(r.marketStock('red', 2) > 0);
});
test('fixed full expansion stock persists across rounds, resets for a new match and extra budgets share it', () => {
  for (const n of [2, 6, 8]) {
    const r = fixture(n),
      p = r.player(r.marketTurn()),
      stock = r.marketStock('orange', 1);
    assert.equal(r.marketCapacity['orange:1'], 32);
    assert.equal(stock, 32 - n);
    act(r, p, 'extra-buy', { color: 'orange', value: 1 });
    assert.equal(r.marketStock('orange', 1), stock - 1);
    assert.equal(p.budget, 200);
    r.endRound();
    r.nextRound();
    assert.equal(r.marketStock('orange', 1), stock - 1);
    r.phase = 'finished';
    r.start();
    assert.equal(r.marketStock('orange', 1), stock);
  }
});
test('effect purchases share stock and dynamically disable sold-out choices before applying any operation', () => {
  const r = fixture(),
    p = r.player(r.marketTurn());
  r.marketSupply['orange:1'] = 1;
  r.queue(p, '額外購買', [
    r.option('南瓜1', [{ op: 'extraBuy', color: 'orange', value: 1 }]),
    r.option('略過', []),
  ]);
  let q = r.view(p.id).mine.pending;
  act(r, p, 'choice', { choiceId: q.id, optionId: q.options[0].id });
  assert.equal(r.marketStock('orange', 1), 0);
  r.queue(p, '額外購買', [
    r.option('南瓜1', [{ op: 'extraBuy', color: 'orange', value: 1 }]),
    r.option('略過', []),
  ]);
  q = r.view(p.id).mine.pending;
  assert.equal(q.options[0].disabled, true);
  const count = p.bag.length;
  assert.throws(
    () => act(r, p, 'choice', { choiceId: q.id, optionId: q.options[0].id }),
    (e) => e.code === 'CHOICE_UNAVAILABLE',
  );
  assert.equal(p.bag.length, count);
  assert.equal(r.marketStock('orange', 1), 0);
});
test('copper upgrade is offered only before shopping completion with eligible pot chips; visiting it preserves paid coins', () => {
  const r = fixture(),
    p = r.players[0];
  r.witches.copper = WITCHES.copper.find((w) => w.id === 'upgrade');
  p.coins.copper = true;
  p.pot = [];
  assert.equal(r.witchAllowed(p, 'copper'), false);
  assert.throws(
    () => act(r, p, 'witch', { color: 'copper' }),
    (e) => e.code === 'WITCH_UNAVAILABLE',
  );
  assert.equal(p.coins.copper, true);
  const c = { ...r.chip('blue', 1), position: 5 };
  p.pot = [c];
  assert.equal(r.witchAllowed(p, 'copper'), true);
  r.fortune = { id: 'witch-visit' };
  r.visitingWitch = { color: 'copper', ...r.witches.copper };
  act(r, p, 'free-witch');
  assert.equal(p.coins.copper, true);
  assert.equal(p.visitorUsed, true);
  const q = r.view(p.id).mine.pending,
    o = q.options.find((o) => o.ingredient?.color === 'blue');
  act(r, p, 'choice', { choiceId: q.id, optionId: o.id });
  assert.ok(p.bag.some((x) => x.color === 'blue' && x.value === 2));
  assert.equal(p.pot.length, 0);
  assert.equal(r.visitorAllowed(p), false);
  p.ready = true;
  assert.equal(r.witchAllowed(p, 'copper'), false);
  assert.match(r.witches.copper.text, /購物階段/);
  assert.match(r.witches.copper.text, /1→2、2→4/);
});
test('all player snapshots retain their own droplet, rat start and chip locations over nine round transitions', () => {
  const r = fixture(3);
  r.round = 0;
  for (const p of r.players) {
    p.pot = [];
    p.overflow = [];
    p.bag = [];
    p.score = 0;
  }
  for (let round = 1; round <= 9; round++) {
    r.nextRound();
    r.phase = 'brewing';
    r.stage = 'drawing';
    r.fortune = { id: 'none' };
    for (const [i, p] of r.players.entries()) {
      p.droplet = i * 3;
      p.rat = i + 1;
      p.roundStartPosition = p.droplet + p.rat;
      p.position = p.roundStartPosition;
      r.place(p, r.chip('orange', 1));
    }
    for (const viewer of r.players) {
      const s = r.view(viewer.id);
      for (const [i, p] of r.players.entries()) {
        const q = s.recipes.find((x) => x.id === p.id);
        assert.equal(q.droplet, i * 3);
        assert.equal(q.startPosition, i * 3 + i + 1);
        assert.equal(q.position, q.startPosition + 1);
        assert.equal(q.pot.at(-1).position, q.position);
        assert.deepEqual(art.markerPositions(q), { droplet: q.droplet, start: q.startPosition });
      }
    }
    for (const p of r.players) p.field = BOARD[p.position + 1];
    r.endRound();
    assert.equal(r.phase, round === 9 ? 'finished' : 'between');
    if (round < 9) {
      assert.equal(r.auto(Date.now() + 1e6), false);
      assert.ok(r.players.every((p) => p.pot.length === 1));
    }
  }
  assert.equal(r.results.length, 9);
  assert.ok(r.winner);
});

test('every seat count uses the same complete colour/value totals, never a reduced player formula', () => {
  const { INGREDIENT_SUPPLY } = require('../src/games/quacks-market');
  const expected = {
    orange: { 1: 32, 6: 20 },
    green: { 1: 25, 2: 15, 4: 18 },
    blue: { 1: 22, 2: 15, 4: 15 },
    red: { 1: 18, 2: 13, 4: 15 },
    yellow: { 1: 19, 2: 11, 4: 15 },
    purple: { 1: 23 },
    black: { 1: 26 },
    locoweed: { 1: 25 },
  };
  assert.deepEqual(INGREDIENT_SUPPLY, expected);
  for (const seats of [2, 3, 4, 5, 6, 7, 8]) {
    const r = fixture(seats);
    let total = 0;
    for (const [color, values] of Object.entries(expected))
      for (const [value, count] of Object.entries(values)) {
        const key = color + ':' + value;
        assert.equal(r.marketCapacity[key], count, key);
        assert.equal(
          r.marketSupply[key],
          count - (['orange', 'green'].includes(color) && value === '1' ? seats : 0),
          key,
        );
        total += count;
      }
    assert.equal(total, 327);
    assert.equal(r.marketStock('white', 1), null);
  }
});
