'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CeoGame, validateCatalog, INDUSTRIES } = require('../src/games/ceo');

// Synthetic data only: never imported by the server, registry or a playable entry.
function catalog() {
  const common = {
    income: 1,
    score: { kind: 'fixed', points: 0 },
    source: 'synthetic regression fixture',
  };
  return {
    status: 'fixture',
    source: 'Synthetic CEO rules tests; not the published deck',
    groups: INDUSTRIES.map((industry, i) => ({
      ...common,
      id: `g${i}`,
      name: `Group ${i}`,
      industry,
    })),
    companies: Array.from({ length: 48 }, (_, i) => ({
      ...common,
      id: `c${i}`,
      name: `Company ${i}`,
      industry: INDUSTRIES[i % 6],
      assets: 20,
      adjustment: null,
    })),
    adjustments: { up: Array(12).fill(20), down: Array(12).fill(-10) },
  };
}

function game(count = 3, data = catalog(), rng = (n) => n - 1) {
  return new CeoGame({
    playerIds: Array.from({ length: count }, (_, i) => `p${i}`),
    catalog: data,
    rng,
  });
}
const snapshot = (g) => g.view('p0');
function act(g, action) {
  const state = snapshot(g);
  return g.act(state.turnId, action, state.revision);
}
const dividend = (g) => act(g, { type: 'dividend' });
function untilTurn(g, id) {
  for (let i = 0; i < 6 && snapshot(g).turnId !== id; i++) dividend(g);
  assert.equal(snapshot(g).turnId, id);
}
function complete(g, strategy) {
  for (let i = 0; i < 500; i++) {
    const state = snapshot(g);
    if (state.phase === 'finished') return state;
    const actor = state.players.find((p) => p.id === state.turnId);
    const group = state.groups.find((entry) => entry.playerId === actor.id);
    const action =
      strategy?.(state, actor, group) ??
      (actor.cash >= state.market[0].card.assets && group.publicAssets < 100
        ? { type: 'acquire', companyId: state.market[0].card.id }
        : { type: 'dividend' });
    act(g, action);
  }
  assert.fail('The bounded fixture must reach a normal finish');
}
function rejectedUnchanged(g, code, run) {
  const before = snapshot(g);
  assert.throws(run, (error) => error.code === code);
  assert.deepEqual(snapshot(g), before);
}

test('CEO: setup for 3–6 players, public money, seven shares and NPC assets', () => {
  for (const [count, npc] of [
    [3, [100, 120, 140]],
    [4, [100, 130]],
    [5, [100]],
    [6, []],
  ]) {
    const state = snapshot(game(count));
    assert.equal(state.catalogStatus, 'fixture');
    assert.equal(state.players.length, count);
    assert.equal(state.turnId, `p${count - 1}`);
    assert.equal(state.market.length, 6);
    assert.equal(state.remainingCompanies, 42);
    assert.equal(state.countdown, null, 'NPC initial 100 does not trigger ending');
    assert.deepEqual(
      state.groups.filter((entry) => entry.playerId === null).map((entry) => entry.publicAssets),
      npc,
    );
    state.players.forEach((player, index) => {
      assert.equal(player.cash, 30);
      assert.deepEqual(
        player.holdings.map((stock) => stock.count),
        INDUSTRIES.map((_, i) => (i === index ? 7 : 0)),
      );
    });
  }
});

test('CEO: catalog and players are copied; snapshots cannot alter engine state', () => {
  const data = catalog();
  const g = game(3, data);
  data.companies[0].assets = 200;
  data.groups[0].score.points = 999;
  const view = snapshot(g);
  view.market[0].card.assets = 999;
  view.players[0].cash = 999;
  view.groups[0].card.score.points = 999;
  assert.equal(snapshot(g).market[0].card.assets, 20);
  assert.equal(snapshot(g).players[0].cash, 30);
  assert.equal(snapshot(g).groups[0].card.score.points, 0);
});

test('CEO: validates catalog IDs, sources, exact industries, score definitions and adjustment signs', () => {
  const invalid = [
    (d) => {
      delete d.status;
    },
    (d) => {
      d.groups.pop();
    },
    (d) => {
      d.groups[0].industry = d.groups[1].industry;
    },
    (d) => {
      d.companies[0].id = d.groups[0].id;
    },
    (d) => {
      d.companies[0].source = '';
    },
    (d) => {
      d.companies[0].assets = 2;
    },
    (d) => {
      d.companies[0].income = Infinity;
    },
    (d) => {
      d.companies[0].adjustment = 'unknown';
    },
    (d) => {
      d.groups[0].score = { kind: 'eval', points: 1 };
    },
    (d) => {
      d.groups[0].score = { kind: 'pair', points: 40, industries: ['retail'] };
    },
    (d) => {
      d.groups[0].score = { kind: 'industry', points: 10, industries: ['retail', 'retail'] };
    },
    (d) => {
      d.adjustments.down[0] = 10;
    },
  ];
  for (const mutate of invalid) {
    const d = catalog();
    mutate(d);
    assert.throws(
      () => validateCatalog(d),
      (error) => error.code === 'INVALID_CATALOG',
    );
  }
  const d = catalog();
  d.status = 'verified';
  assert.equal(validateCatalog(d).status, 'verified');
  d.companies.pop();
  assert.throws(
    () => validateCatalog(d),
    (error) => error.code === 'INVALID_CATALOG',
  );
});

test('CEO: invalid player counts, duplicate IDs and random sources fail before play', () => {
  for (const ids of [
    [],
    ['a', 'b'],
    ['a', 'a', 'c'],
    ['a', 'b', '__proto__'],
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  ]) {
    assert.throws(
      () => new CeoGame({ playerIds: ids, catalog: catalog() }),
      (error) => error.code === 'INVALID_PLAYERS',
    );
  }
  for (const rng of [() => -1, (n) => n, () => 0.5, () => NaN]) {
    assert.throws(
      () => game(3, catalog(), rng),
      (error) => error.code === 'INVALID_RANDOM',
    );
  }
});

test('CEO: permissions, stale revision, invalid command and duplicate send do not mutate state', () => {
  const g = game();
  rejectedUnchanged(g, 'NOT_SEATED', () => g.act('outsider', { type: 'dividend' }, 0));
  assert.throws(
    () => g.view('outsider'),
    (error) => error.code === 'NOT_SEATED',
  );
  rejectedUnchanged(g, 'NOT_YOUR_TURN', () => g.act('p0', { type: 'dividend' }, 0));
  rejectedUnchanged(g, 'STALE_ACTION', () => g.act('p2', { type: 'dividend' }, '0'));
  rejectedUnchanged(g, 'INVALID_ACTION', () => act(g, { type: 'sellStock' }));
  dividend(g);
  rejectedUnchanged(g, 'STALE_ACTION', () => g.act('p2', { type: 'dividend' }, 0));
});

test('CEO: all six market slots charge fees, discard correctly and refill in order', () => {
  for (const [slot, fee, discards] of [
    [0, 0, false],
    [1, 0, true],
    [2, 2, false],
    [3, 4, true],
    [4, 6, true],
    [5, 8, true],
  ]) {
    const g = game();
    const result = act(g, { type: 'acquire', companyId: `c${slot}` });
    const owner = result.groups.find((entry) => entry.playerId === 'p2');
    assert.equal(result.players[2].cash, 10 - fee);
    assert.equal(owner.publicAssets, 20, 'surcharge does not add assets');
    assert.equal(owner.income, 2);
    assert.equal(owner.companies[0].id, `c${slot}`);
    assert.deepEqual(result.discarded, discards ? ['c0'] : []);
    const expected = Array.from({ length: discards ? 8 : 7 }, (_, i) => `c${i}`).filter(
      (id) => id !== `c${slot}` && !(discards && id === 'c0'),
    );
    assert.deepEqual(
      result.market.map((entry) => entry.card.id),
      expected,
    );
    assert.equal(result.remainingCompanies, discards ? 40 : 41);
  }
});

test('CEO: missing card and insufficient cash cannot buy; legal turn remains available', () => {
  const d = catalog();
  d.companies[0].assets = 35;
  const g = game(3, d);
  rejectedUnchanged(g, 'COMPANY_UNAVAILABLE', () =>
    act(g, { type: 'acquire', companyId: 'missing' }),
  );
  rejectedUnchanged(g, 'INSUFFICIENT_CASH', () => act(g, { type: 'acquire', companyId: 'c0' }));
  assert.equal(dividend(g).revision, 1);
});

test('CEO: own adjustment visible, opponents and logs conceal value and future decks', () => {
  for (const [kind, value] of [
    ['up', 20],
    ['down', -10],
  ]) {
    const d = catalog();
    d.companies[0].adjustment = kind;
    const g = game(3, d);
    act(g, { type: 'acquire', companyId: 'c0' });
    const ownerView = g.view('p2');
    assert.deepEqual(ownerView.groups[2].adjustments, [value]);
    const other = snapshot(g);
    assert.equal(other.groups[2].adjustmentCount, 1);
    assert.equal(other.groups[2].adjustments, null);
    assert.equal(other.groups[2].publicAssets, 20);
    assert.equal(Object.hasOwn(other, 'deck'), false);
    assert.equal(Object.hasOwn(other, 'adjustments'), false);
    assert.deepEqual(other.events[0], {
      type: 'acquire',
      playerId: 'p2',
      companyId: 'c0',
      price: 20,
      revision: 1,
    });
  }
});

test('CEO: unresolved company deck exhaustion rolls back cash, discard and hidden draw', () => {
  const d = catalog();
  d.companies = d.companies.slice(0, 6);
  d.companies[1].adjustment = 'up';
  const g = game(3, d);
  rejectedUnchanged(g, 'RULE_DATA_EXHAUSTED', () => act(g, { type: 'acquire', companyId: 'c1' }));
  assert.deepEqual(g.view('p2').groups[2].adjustments, []);
});

test('CEO: adjustment pile exhaustion cannot spend, acquire or consume a turn', () => {
  const d = catalog();
  d.adjustments.up = [15];
  d.companies[0].adjustment = 'up';
  d.companies[1].adjustment = 'up';
  const g = game(3, d);
  act(g, { type: 'acquire', companyId: 'c0' });
  rejectedUnchanged(g, 'RULE_DATA_EXHAUSTED', () => act(g, { type: 'acquire', companyId: 'c1' }));
  assert.deepEqual(g.view('p2').groups[2].adjustments, [15]);
});

test('CEO: stock money goes to issuer, price increases and shares remain conserved', () => {
  const g = game();
  let state = act(g, { type: 'buyStock', issuerId: 'g0' });
  assert.equal(state.players[2].cash, 25);
  assert.equal(state.players[0].cash, 35);
  assert.equal(state.players[2].holdings[0].count, 1);
  assert.equal(state.players[0].holdings[0].count, 6);
  assert.equal(state.groups[0].nextStockPrice, 8);
  untilTurn(g, 'p1');
  state = act(g, { type: 'buyStock', issuerId: 'g0' });
  assert.equal(state.players[1].holdings[0].count, 1);
  assert.equal(state.groups[0].nextStockPrice, 11);
  assert.equal(
    state.players.reduce((sum, player) => sum + player.holdings[0].count, 0),
    7,
  );
});

test('CEO: cannot buy own/NPC/missing shares or resell bought shares', () => {
  const g = game();
  for (const issuerId of ['g2', 'g3', 'missing'])
    rejectedUnchanged(g, 'INVALID_ISSUER', () => act(g, { type: 'buyStock', issuerId }));
  rejectedUnchanged(g, 'INVALID_ACTION', () => act(g, { type: 'resell', issuerId: 'g0' }));
});

test('CEO: dividends pay all stockholders from the bank using group card and all companies', () => {
  const g = game();
  act(g, { type: 'buyStock', issuerId: 'g0' });
  act(g, { type: 'acquire', companyId: 'c0' });
  untilTurn(g, 'p0');
  const before = snapshot(g);
  const after = dividend(g);
  assert.equal(after.players[0].cash - before.players[0].cash, 12, 'income 2 × six own shares');
  assert.equal(after.players[2].cash - before.players[2].cash, 2, 'income 2 × one investor share');
  assert.equal(after.players[1].cash, before.players[1].cash);
});

test('CEO: seven sequential shares sell at 5/8/11/15/20/30/99, then cannot sell more', () => {
  const g = game();
  let bought = 0;
  for (let i = 0; i < 250 && bought < 7; i++) {
    const state = snapshot(g);
    const actor = state.players.find((p) => p.id === state.turnId);
    const price = state.groups[0].nextStockPrice;
    if (actor.id === 'p2' && actor.cash >= price) {
      const after = act(g, { type: 'buyStock', issuerId: 'g0' });
      assert.equal(after.events.at(-1).price, [5, 8, 11, 15, 20, 30, 99][bought++]);
    } else dividend(g);
  }
  assert.equal(bought, 7);
  assert.equal(snapshot(g).groups[0].nextStockPrice, null);
  untilTurn(g, 'p2');
  rejectedUnchanged(g, 'STOCK_UNAVAILABLE', () => act(g, { type: 'buyStock', issuerId: 'g0' }));
  assert.equal(snapshot(g).players[2].holdings[0].count, 7);
});

test('CEO: 100 triggers after full round; exactly two more rounds, final round disallows stock', () => {
  const d = catalog();
  d.companies[0].assets = 100;
  const g = game(3, d);
  while (snapshot(g).players[2].cash < 100 || snapshot(g).turnId !== 'p2') dividend(g);
  const triggerRound = snapshot(g).round;
  let state = act(g, { type: 'acquire', companyId: 'c0' });
  assert.equal(state.endingTriggered, true);
  assert.equal(state.countdown, null);
  dividend(g);
  state = dividend(g);
  assert.equal(state.round, triggerRound + 1);
  assert.equal(state.countdown, 2);
  for (let i = 0; i < 3; i++) dividend(g);
  state = snapshot(g);
  assert.equal(state.countdown, 1);
  assert.equal(state.phase, 'playing');
  rejectedUnchanged(g, 'FINAL_ROUND', () => act(g, { type: 'buyStock', issuerId: 'g0' }));
  dividend(g);
  dividend(g);
  assert.equal(snapshot(g).phase, 'playing');
  state = dividend(g);
  assert.equal(state.phase, 'finished');
  assert.equal(state.turnId, null);
  assert.equal(state.round, triggerRound + 2);
  rejectedUnchanged(g, 'INVALID_PHASE', () => g.act('p2', { type: 'dividend' }, state.revision));
});

test('CEO: a middle-of-round trigger still waits for the original round boundary', () => {
  const d = catalog();
  d.companies[0].assets = 100;
  const g = game(3, d);
  while (snapshot(g).players[0].cash < 100 || snapshot(g).turnId !== 'p0') dividend(g);
  const round = snapshot(g).round;
  act(g, { type: 'acquire', companyId: 'c0' });
  assert.equal(snapshot(g).countdown, null);
  assert.equal(snapshot(g).turnId, 'p1');
  dividend(g);
  assert.equal(snapshot(g).countdown, 2);
  assert.equal(snapshot(g).round, round + 1);
  assert.equal(snapshot(g).turnId, 'p2');
});

test('CEO: hidden changes are revealed before NPC-inclusive ranking; ties average occupied ranks', () => {
  const d = catalog();
  d.companies.slice(0, 5).forEach((card) => {
    card.adjustment = 'up';
  });
  const g = game(3, d);
  const result = complete(g, (state, player, group) => {
    if (player.id === 'p2' && player.cash >= 20 && group.publicAssets < 100)
      return { type: 'acquire', companyId: state.market[0].card.id };
    return { type: 'dividend' };
  });
  const ranking = result.results.ranking;
  assert.equal(ranking[0].groupId, 'g2');
  assert.equal(ranking[0].assets, 200);
  assert.equal(ranking[0].stockValue, 50);
  assert.deepEqual(result.groups[2].adjustments, [20, 20, 20, 20, 20]);
  assert.equal(ranking.find((entry) => entry.groupId === 'g5').stockValue, 40);
  assert.equal(ranking.find((entry) => entry.groupId === 'g0').stockValue, 5);
  assert.equal(ranking.find((entry) => entry.groupId === 'g1').stockValue, 5);
  assert.equal(result.results.players[2].stockScore, 350);
  assert.equal(result.results.players[0].cashScore, 50);
  assert.deepEqual(result.results.winners, ['p2']);
});

test('CEO: fixed/industry/either-industry/pair scoring counts group card and repeated sets', () => {
  const d = catalog();
  d.groups[2].score = { kind: 'industry', points: 10, industries: ['hardware', 'entertainment'] };
  const rules = [
    ['technology', { kind: 'fixed', points: 30 }],
    ['entertainment', { kind: 'fixed', points: 60 }],
    ['entertainment', { kind: 'pair', points: 40, industries: ['mobile', 'technology'] }],
    ['mobile', { kind: 'industry', points: 20, industries: ['hardware'] }],
    ['hardware', { kind: 'fixed', points: 50 }],
  ];
  rules.forEach(([industry, score], i) => Object.assign(d.companies[i], { industry, score }));
  const result = complete(game(3, d), (state, player, group) =>
    player.id === 'p2' && player.cash >= 20 && group.publicAssets < 100
      ? { type: 'acquire', companyId: state.market[0].card.id }
      : { type: 'dividend' },
  );
  assert.deepEqual(
    result.results.players[2].companies.map((card) => card.score),
    [40, 30, 60, 40, 40, 50],
  );
  assert.equal(
    result.results.players[2].companiesScore,
    260,
    'matches rulebook company-score example',
  );
});

test('CEO: six-player full match supports a six-way asset tie and shared victory', () => {
  const result = complete(game(6));
  assert.equal(result.phase, 'finished');
  assert.equal(result.results.ranking.length, 6);
  for (const entry of result.results.ranking) {
    assert.equal(entry.assets, 100);
    assert.equal(entry.rank, 1);
    assert.equal(entry.stockValue, 25);
  }
  for (const player of result.results.players) {
    assert.equal(player.stockScore, 175);
    assert.equal(player.cashScore, 50);
    assert.equal(player.total, 225);
  }
  assert.deepEqual(result.results.winners, ['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
  assert.ok(result.events.length <= 60);
});

test('CEO: many deterministic seeds preserve card and stock conservation through every turn', () => {
  for (let seed = 1; seed <= 8; seed++) {
    let value = seed;
    const rng = (n) => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value % n;
    };
    const g = game(3 + (seed % 4), catalog(), rng);
    const done = complete(g, (state, player, group) => {
      for (const entry of state.groups.filter((entry) => entry.playerId !== null)) {
        const index = state.groups.findIndex((group) => group.id === entry.id);
        assert.equal(
          state.players.reduce((sum, p) => sum + p.holdings[index].count, 0),
          7,
        );
      }
      const held = state.groups.flatMap((entry) => entry.companies.map((card) => card.id));
      const visible = [...held, ...state.market.map((entry) => entry.card.id), ...state.discarded];
      assert.equal(new Set(visible).size, visible.length);
      assert.equal(visible.length + state.remainingCompanies, 48);
      assert.ok(state.players.every((p) => p.cash >= 0 && Number.isSafeInteger(p.cash)));
      return player.cash >= 20 && group.publicAssets < 100
        ? { type: 'acquire', companyId: state.market[0].card.id }
        : { type: 'dividend' };
    });
    assert.equal(done.phase, 'finished');
  }
});
