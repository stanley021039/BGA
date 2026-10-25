'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { CeoRoom } = require('../src/games/ceo-room');
const { CeoGame, validateCatalog, INDUSTRIES } = require('../src/games/ceo');
const { provisionalCatalog } = require('../src/games/ceo-catalog');

function room() {
  const r = new CeoRoom('ABC123', 'CEO 測試', (n) => n - 1);
  for (let i = 0; i < 3; i++) r.add(`玩家${i}`);
  return r;
}
function step(r, action, extra = {}) {
  const s = r.view(r.host);
  const data = {
    roundId: s.roundId,
    requestId: randomUUID(),
    expectedRevision: s.game.revision,
    ...extra,
  };
  r.act(s.game.turnId, action, data);
  return data;
}

test('CEO provisional catalog: 48 unique cards, six industries, equal adjustment distribution and replaceable IDs', () => {
  const data = provisionalCatalog();
  assert.equal(data.status, 'provisional');
  assert.match(data.source, /非原版/);
  assert.equal(data.companies.length, 48);
  assert.equal(new Set([...data.groups, ...data.companies].map((card) => card.id)).size, 54);
  for (const industry of INDUSTRIES) {
    const cards = data.companies.filter((card) => card.industry === industry);
    assert.equal(cards.length, 8);
    assert.deepEqual(
      cards.map((card) => card.assets),
      [10, 15, 20, 25, 30, 35, 40, 50],
    );
    assert.equal(cards.filter((card) => card.adjustment === 'up').length, 2);
    assert.equal(cards.filter((card) => card.adjustment === 'down').length, 2);
  }
  assert.deepEqual(data.adjustments.up, [10, 10, 10, 10, 15, 15, 15, 15, 20, 20, 20, 20]);
  data.adjustments.up[0] = 20;
  assert.equal(provisionalCatalog().adjustments.up[0], 10);
  data.companies[2].adjustment = 'up';
  assert.throws(
    () => validateCatalog(data),
    (error) => error.code === 'INVALID_CATALOG',
  );
});

test('CEO provisional catalog: complete 3–6 player games finish with diverse deterministic draws', () => {
  for (let count = 3; count <= 6; count++) {
    for (let seed = 1; seed <= 6; seed++) {
      let value = seed;
      const rng = (n) => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value % n;
      };
      const g = new CeoGame({
        playerIds: Array.from({ length: count }, (_, i) => `p${i}`),
        catalog: provisionalCatalog(),
        rng,
      });
      for (let turn = 0; turn < 500; turn++) {
        const s = g.view('p0');
        if (s.phase === 'finished') break;
        const p = s.players.find((p) => p.id === s.turnId);
        const choices = s.market.filter((entry) => entry.card.assets + entry.extraCost <= p.cash);
        const buy = choices[0];
        g.act(
          p.id,
          buy ? { type: 'acquire', companyId: buy.card.id } : { type: 'dividend' },
          s.revision,
        );
      }
      const result = g.view('p0');
      assert.equal(result.phase, 'finished', `${count} players, seed ${seed}`);
      assert.equal(result.catalogStatus, 'provisional');
      assert.ok(result.results.winners.length);
    }
  }
});

test('CEO room: minimum, preparation, provisional disclosure and idempotent action receipt', () => {
  const r = new CeoRoom('ABC123', 'CEO', (n) => n - 1);
  r.add('甲');
  r.add('乙');
  assert.throws(
    () => r.start(),
    (error) => error.code === 'NEED_PLAYERS',
  );
  assert.equal(r.phase, 'waiting');
  r.add('丙');
  r.start();
  const before = r.view(r.host);
  assert.equal(before.catalogStatus, 'provisional');
  assert.match(before.catalogNotice, /原版不同/);
  const id = before.game.turnId;
  const data = step(r, 'dividend');
  const after = r.view(r.host);
  r.act(id, 'dividend', data);
  assert.deepEqual(r.view(r.host), after, 'retry must not pay twice or create a second event');
  assert.throws(
    () => r.act(id, 'dividend', { ...data, expectedRevision: 999 }),
    (e) => e.code === 'REQUEST_CONFLICT',
  );
  assert.throws(
    () => r.start(),
    (e) => e.code === 'MATCH_STARTED',
  );
});

test('CEO provisional market: exhaustion below 100 assets starts two final rounds instead of stalling', () => {
  let value = 3;
  const rng = (n) => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value % n;
  };
  const g = new CeoGame({
    playerIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    catalog: provisionalCatalog(),
    rng,
  });
  for (let turn = 0; turn < 500; turn++) {
    const s = g.view('a');
    if (s.endingTriggered) break;
    const player = s.players.find((entry) => entry.id === s.turnId);
    const group = s.groups.find((entry) => entry.playerId === player.id);
    const card = s.market
      .filter(
        (entry) =>
          entry.card.assets + entry.extraCost <= player.cash &&
          group.publicAssets + entry.card.assets < 100,
      )
      .at(-1);
    g.act(
      player.id,
      card ? { type: 'acquire', companyId: card.card.id } : { type: 'dividend' },
      s.revision,
    );
  }
  const exhausted = g.view('a');
  assert.equal(exhausted.market.length, 0);
  assert.ok(exhausted.groups.every((group) => group.publicAssets < 100));
  assert.equal(exhausted.endingReason, 'provisional-market-exhausted');
  for (let i = 0; i < 18 && g.view('a').phase !== 'finished'; i++) {
    const s = g.view('a');
    g.act(s.turnId, { type: 'dividend' }, s.revision);
  }
  assert.equal(g.view('a').phase, 'finished');
});

test('CEO room: retired history hook stays absent and public state hides future draws', () => {
  const r = room();
  r.start();
  const s = r.view(r.host);
  const cheap = s.game.market.find(
    (entry) => entry.card.adjustment !== null && entry.card.assets + entry.extraCost <= 30,
  );
  assert.ok(cheap);
  step(r, 'acquire', { companyId: cheap.card.id });
  const json = JSON.stringify(r.view(r.players[1].id));
  assert.ok(!json.includes('"changes"'));
  assert.ok(!json.includes('"deck"'));
  assert.ok(!json.includes('"secret"'));
  assert.equal(typeof r.historyState, 'undefined');
  assert.equal(r.view(r.host).catalogStatus, 'provisional');
  assert.ok(Buffer.byteLength(json) < 128 * 1024);
});

test('CEO room: leaving interrupts the game, hides engine, permits new seats and a clean restart', () => {
  const r = room();
  r.start();
  const oldRound = r.roundId;
  r.kick(r.host, r.players[1].id);
  assert.equal(r.phase, 'finished');
  assert.equal(r.interrupted, true);
  assert.equal(r.view(r.host).game, null);
  const next = r.add('新玩家');
  assert.equal(r.view(next.id).game, null);
  r.start();
  assert.notEqual(r.roundId, oldRound);
  assert.equal(r.view(next.id).game.revision, 0);
  assert.equal(r.view(next.id).game.players.length, 3);
  assert.equal(r.interrupted, false);
});

test('CEO room: complete match scores, history results and new game reset consistently', () => {
  const r = room();
  r.start();
  for (let turn = 0; turn < 500 && r.phase === 'playing'; turn++) {
    const s = r.view(r.host).game;
    const p = s.players.find((p) => p.id === s.turnId);
    const buy = s.market.find((entry) => entry.card.assets + entry.extraCost <= p.cash);
    step(r, buy ? 'acquire' : 'dividend', buy ? { companyId: buy.card.id } : {});
  }
  assert.equal(r.phase, 'finished');
  assert.equal(r.interrupted, false);
  assert.equal(r.results.length, 1);
  assert.deepEqual(
    r.players.map((player) => player.score),
    r.results[0].players.map((player) => player.total),
  );
  assert.deepEqual(
    r.winner.names,
    r.players
      .filter((player) => r.results[0].winners.includes(player.id))
      .map((player) => player.name),
  );
  const newcomer = r.add('旁觀下一局');
  assert.equal(r.view(newcomer.id).game, null);
  r.start();
  assert.equal(r.results.length, 0);
  assert.equal(r.players.length, 4);
  assert.equal(
    r.view(newcomer.id).game.players.every((p) => p.cash === 30),
    true,
  );
});
