'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { openDatabase } = require('../src/db');
const { GachaStore } = require('../src/gacha/store');
const { poolItems, poolLabels } = require('../src/gacha/catalog');
const { BUILTIN_FRAME_OPTIONS } = require('../src/barrage/builtins');
const Odds = require('../src/gacha/odds');
const { validateGachaDatabase } = require('../src/gacha/validation');
const upgradedStyles = {
  orbit: 'epic',
  holo: 'epic',
  frost: 'epic',
  dragon: 'legendary',
  royal: 'legendary',
};
test('updated entrances and their alternate colors share tiers', () => {
  const arrival = new Map(poolItems('arrival').map((item) => [item.key, item.rarity]));
  for (const [rarity, ids] of Object.entries({
    legendary: ['senbonzakura', 'stand-time', 'black-coffin'],
    epic: ['starburst', 'hyorinmaru', 'explosion', 'stand-fists'],
    rare: ['zanka', 'gilgamesh', 'ulquiorra', 'lightning', 'bungee-gum', 'blue-eyes', 'black-moon'],
    common: ['gentle-kitty', 'pup-parade'],
  })) {
    for (const id of ids) {
      assert.equal(arrival.get('entrances:stitch-' + id), rarity);
      assert.equal(arrival.get('entrances:stitch-' + id + '-alt'), rarity);
    }
  }
});
test('both gacha pools use the configured voice tiers and current display names', () => {
  const voices = require('../public/shared/ping-voices.json');
  const tiers = {
    legendary: ['amazing', 'gay-club', 'butt-party', 'card-check', 'senior'],
    epic: ['what', 'wings', 'god-of-gamblers', 'horn', 'bad', 'i-am-gay'],
    rare: ['poor-thing', 'sleep', 'legacy', 'answer-me', 'coward', 'yare-yare'],
  };
  const expectedTiers = new Map(
    Object.entries(tiers).flatMap(([tier, ids]) => ids.map((id) => [id, tier])),
  );
  const expected = voices.map(({ id, label }) => ({
    id: 'ping-voice-' + id,
    label,
    rarity: expectedTiers.get(id) || 'common',
  }));
  for (const pool of ['all', 'arrival']) {
    const actual = poolItems(pool)
      .filter((item) => item.kind === 'sounds')
      .map(({ id, label, rarity }) => ({ id, label, rarity }));
    const byId = (a, b) => a.id.localeCompare(b.id);
    assert.deepEqual(actual.sort(byId), expected.toSorted(byId));
  }
  const { rewardLabels } = require('../src/achievements/bonus-rewards');
  assert.ok(rewardLabels('gift-first-gift').includes('音效：傳承我的精神'));
  assert.ok(rewardLabels('poker-first-hand').includes('音效：他很壞嘟嘟嘟'));
  assert.ok(rewardLabels('bluff-convincing').includes('音效：不要瞎掰好嗎'));
});
test('bonus sets epic and legendary to 65% and 35% in every current pool', () => {
  for (const pool of Object.keys(poolLabels)) {
    const { tiers, totalWeight } = Odds.distribution(poolItems(pool), Odds.defaults, true);
    const chances = Object.fromEntries(
      tiers.map(({ items, weight }) => [items[0].rarity, weight / totalWeight]),
    );
    assert.deepEqual(chances, { common: 0, rare: 0, epic: 0.65, legendary: 0.35 });
  }
});
test('bonus percentages stay fixed with customized normal odds', () => {
  const { tiers, totalWeight } = Odds.distribution(
    poolItems('all'),
    { common: 15, rare: 10, epic: 50, legendary: 25 },
    true,
  );
  assert.equal(totalWeight, 2500);
  assert.deepEqual(
    tiers.map(({ items, weight }) => [items[0].rarity, weight]),
    [
      ['common', 0],
      ['rare', 0],
      ['epic', 1625],
      ['legendary', 875],
    ],
  );
});
function fixture(t, choose = () => 0) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  for (const [id, role] of [
    ['admin', 'admin'],
    ['member', 'member'],
  ])
    db.prepare(
      'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    ).run(id, id, id, 'unused', role, '2026-11-05T00:00:00.000Z');
  const store = new GachaStore(db, { choose, clock: () => Date.parse('2026-11-05T00:00:00.000Z') });
  store.ledger(
    'fund',
    'member',
    'match',
    2000,
    0,
    createHash('sha256').update('fund').digest('hex'),
    store.at(),
  );
  return { db, store };
}
test('odds preserve defaults, require admin, reject invalid weights and stale admin saves', (t) => {
  const { db, store } = fixture(t);
  const original = store.odds();
  assert.deepEqual(original.weights, { common: 75, rare: 18, epic: 5, legendary: 2 });
  const change = {
    revision: original.revision,
    weights: { common: 50, rare: 30, epic: 10, legendary: 10 },
  };
  assert.throws(() => store.setOdds('member', change), { code: 'ADMIN_REQUIRED' });
  for (const bad of [
    null,
    {},
    [],
    { common: 0, rare: 20, epic: 5, legendary: 2 },
    { common: 1.5, rare: 20, epic: 5, legendary: 2 },
    { common: 1000001, rare: 20, epic: 5, legendary: 2 },
    { common: 100, rare: 20, epic: 5, legendary: 2, extra: 1 },
    { common: 100, rare: 20, legendary: 2 },
  ])
    assert.throws(() => store.setOdds('admin', { ...change, weights: bad }), {
      code: 'INVALID_GACHA_WEIGHTS',
    });
  assert.deepEqual(store.odds(), original);
  const changed = store.setOdds('admin', change);
  assert.notEqual(changed.revision, original.revision);
  assert.equal(changed.updatedBy, 'admin');
  assert.deepEqual(new GachaStore(db).odds(), changed);
  assert.throws(() => store.setOdds('admin', change), { code: 'GACHA_ODDS_CHANGED' });
  validateGachaDatabase(db);
});
test('public odds and exact draw boundaries use the same weight snapshot; stale purchase does not charge', (t) => {
  const samples = [],
    limits = [];
  const { store } = fixture(t, (total) => {
    limits.push(total);
    return samples.shift();
  });
  store.setOdds('admin', {
    revision: store.odds().revision,
    weights: { common: 17, rare: 5, epic: 2, legendary: 1 },
  });
  const state = store.state('member'),
    pool = state.pools.find((p) => p.id === 'combat');
  const rares = poolItems('combat').filter((item) => item.rarity === 'rare');
  const legends = poolItems('combat').filter((item) => item.rarity === 'legendary');
  assert.equal(pool.totalWeight, 25);
  assert.equal(state.items.find((i) => i.rarity === 'legendary').weight, 1);
  samples.push(17, 1);
  const request = {
    requestId: randomUUID(),
    pool: 'combat',
    count: 1,
    oddsRevision: state.odds.revision,
  };
  const receipt = store.draw('member', request);
  assert.deepEqual(limits, [pool.totalWeight, rares.length]);
  assert.equal(receipt.results[0].key, rares[1].key);
  assert.equal(receipt.oddsRevision, state.odds.revision);
  store.setOdds('admin', {
    revision: store.odds().revision,
    weights: { common: 2, rare: 3, epic: 1, legendary: 4 },
  });
  assert.deepEqual(store.draw('member', request), receipt);
  const balance = store.wallet('member');
  assert.throws(() => store.draw('member', { ...request, requestId: randomUUID() }), {
    code: 'GACHA_ODDS_CHANGED',
  });
  assert.deepEqual(store.wallet('member'), balance);
  samples.push(9, legends.length - 1);
  const last = store.draw('member', {
    ...request,
    requestId: randomUUID(),
    oddsRevision: store.odds().revision,
  });
  assert.equal(last.results[0].key, legends.at(-1).key);
});
test('each public pool has the same exact tier chances despite different catalog sizes', () => {
  for (const pool of Object.keys(poolLabels)) {
    const distribution = Odds.distribution(poolItems(pool), Odds.defaults);
    assert.equal(distribution.totalWeight, 100);
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let roll = 0; roll < 100; roll++) {
      const samples = [roll, 0];
      counts[Odds.select(distribution, () => samples.shift()).rarity]++;
    }
    assert.deepEqual(counts, Odds.defaults, pool);
  }
});
test('existing non-achievement styles and the castle enter their pools as separate collectibles', (t) => {
  const samples = [];
  const { store } = fixture(t, () => samples.shift());
  const styles = poolItems('styles');
  for (const { id, achievementId } of BUILTIN_FRAME_OPTIONS) {
    if (achievementId) continue;
    for (const kind of ['frames', 'media']) {
      const item = styles.find((candidate) => candidate.key === kind + ':' + id);
      if (id === 'default') assert.equal(item, undefined);
      else {
        assert.equal(item.rarity, upgradedStyles[id] ?? 'common');
        assert.deepEqual(item.achievementIds, []);
      }
    }
  }
  const castle = poolItems('combat').find((item) => item.key === 'backgrounds:castle');
  assert.equal(castle.rarity, 'common');
  assert.ok(!styles.includes(castle));
  for (const [pool, key, duplicate] of [
    ['styles', 'frames:royal', false],
    ['styles', 'media:royal', false],
    ['combat', castle.key, false],
    ['combat', castle.key, true],
  ]) {
    const entries = poolItems(pool);
    const rarity = entries.find((item) => item.key === key).rarity;
    const { tiers } = Odds.distribution(entries, Odds.defaults);
    const tierIndex = tiers.findIndex((tier) => tier.items[0].rarity === rarity);
    const tierStart = tiers.slice(0, tierIndex).reduce((sum, tier) => sum + tier.weight, 0);
    samples.push(
      tierStart,
      tiers[tierIndex].items.findIndex((item) => item.key === key),
    );
    const receipt = store.draw('member', { requestId: randomUUID(), pool, count: 1 });
    assert.equal(receipt.results[0].key, key);
    assert.equal(receipt.results[0].duplicate, duplicate);
  }
});
test('the legacy weight record is preserved but is not reapplied as tier weights', (t) => {
  const { db, store } = fixture(t);
  const previous = JSON.stringify({
    weights: { common: 100, rare: 30, legendary: 4 },
    updatedAt: store.at(),
    updatedBy: 'admin',
  });
  db.prepare('INSERT INTO gacha_settings VALUES(?,?)').run('draw_odds_v1', previous);
  assert.deepEqual(store.odds().weights, Odds.defaults);
  store.setOdds('admin', {
    revision: store.odds().revision,
    weights: { ...Odds.defaults, epic: 7 },
  });
  assert.equal(store.odds().weights.epic, 7);
  assert.equal(
    db.prepare("SELECT value FROM gacha_settings WHERE name='draw_odds_v1'").get().value,
    previous,
  );
});
test('corrupt stored odds fail database restore validation and draws instead of silently using different odds', (t) => {
  const { db, store } = fixture(t);
  db.prepare('INSERT INTO gacha_settings VALUES(?,?)').run(
    'draw_odds_v1',
    JSON.stringify({
      weights: { common: 0, rare: 20, legendary: 2 },
      updatedAt: store.at(),
      updatedBy: 'admin',
    }),
  );
  assert.throws(() => validateGachaDatabase(db));
  assert.throws(() => store.draw('member', { requestId: randomUUID(), pool: 'all', count: 1 }));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gacha_requests').get().n, 0);
  assert.equal(store.wallet('member').coins, 2000);
});
