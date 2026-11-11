'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { openDatabase, SCHEMA_VERSION } = require('../src/db');
const { GACHA_TABLES } = require('../src/gacha/schema');
const { GachaStore, taipeiDay } = require('../src/gacha/store');
const { catalog, poolItems } = require('../src/gacha/catalog');
const Ownership = require('../src/gacha/ownership');
function addUser(db, name = 'member') {
  const id = randomUUID();
  db.prepare(
    'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
  ).run(id, name, '測試玩家', 'unused', 'member', '2026-10-29T00:00:00.000Z');
  return id;
}
function fixture(t, options = {}) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const user = addUser(db),
    other = addUser(db, 'other');
  const store = new GachaStore(db, {
    clock: () => Date.parse('2026-10-29T12:00:00.000Z'),
    ...options,
  });
  return { db, user, other, store };
}
function fund(store, db, user, coins = 2000, fragments = 1000) {
  store.wallet(user);
  db.prepare('UPDATE gacha_wallets SET coins=?,fragments=? WHERE user_id=?').run(
    coins,
    fragments,
    user,
  );
}
test('gacha schema enforces safe nonnegative balances and complete schema shape', (t) => {
  const { db, user, store } = fixture(t);
  assert.equal(SCHEMA_VERSION, 23);
  for (const name of GACHA_TABLES)
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
  store.wallet(user);
  assert.throws(() => db.prepare('UPDATE gacha_wallets SET coins=-1 WHERE user_id=?').run(user));
  assert.throws(() =>
    db.prepare('UPDATE gacha_wallets SET fragments=1.5 WHERE user_id=?').run(user),
  );
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});

test('previous devour Q/E selections migrate to R and cannot bypass its energy category', (t) => {
  const { db, user } = fixture(t);
  db.prepare("INSERT INTO gacha_ownership VALUES(?,?,?,'legacy',?)").run(
    user,
    'attacks',
    'shaohua_devour',
    '2026-10-01T00:00:00.000Z',
  );
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
    JSON.stringify({ attackLoadout: { q: 'shaohua_devour', e: 'beam' } }),
    user,
  );
  const { getAttackSettings, setAttackSettings } = require('../src/profiles/settings');
  assert.deepEqual(getAttackSettings(db, user), { q: 'barrage', e: 'beam', r: 'shaohua_devour' });
  assert.throws(() => setAttackSettings(db, user, { q: 'shaohua_devour', e: 'beam', r: '' }), {
    code: 'INVALID_ATTACK_LOADOUT',
  });
});
test('daily visit and manual claim use Taipei midnight and survive store recreation', (t) => {
  let time = Date.parse('2026-10-29T15:59:59.999Z');
  const { db, user, store } = fixture(t, { clock: () => time });
  assert.equal(taipeiDay(time), '2026-10-29');
  store.daily(user);
  store.daily(user);
  assert.equal(store.wallet(user).coins, 0);
  assert.equal(store.checkin(user).visits, 1);
  assert.equal(store.claimCheckin(user, 'daily').claimed, true);
  assert.equal(store.wallet(user).coins, 1000);
  new GachaStore(db, { clock: () => time }).claimCheckin(user, 'daily');
  assert.equal(store.wallet(user).coins, 1000);
  time++;
  assert.equal(taipeiDay(time), '2026-10-30');
  store.daily(user);
  assert.equal(store.checkin(user).visits, 2);
  assert.equal(store.checkin(user).claimed, false);
  store.claimCheckin(user, 'daily');
  assert.equal(store.wallet(user).coins, 2000);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM gacha_ledger WHERE event_id GLOB 'login:*'").get().n,
    2,
  );
});
test('daily bonuses count old credits without paying them again and repeat after the fifth claim', (t) => {
  let time = Date.parse('2026-10-29T15:59:59.999Z');
  const { db, user, store } = fixture(t, { clock: () => time });
  store.ledger('login:2026-10-29:' + user, user, 'login', 100, 0, 'a'.repeat(64), store.at());
  assert.equal(store.claimCheckin(user, 'daily').visits, 1);
  assert.equal(store.wallet(user).coins, 100);
  time++;
  const expected = [1000, 1500, 1000, 2000, 1000, 1000, 1500];
  for (const coins of expected) {
    const before = store.wallet(user).coins;
    new GachaStore(db, { clock: () => time }).claimCheckin(user, 'daily');
    store.claimCheckin(user, 'daily');
    assert.equal(store.wallet(user).coins - before, coins);
    time += 2 * 86400000;
  }
});
test('seven distinct visits unlock one manually claimed and atomic legendary draw', (t) => {
  let time = Date.parse('2026-10-29T09:00:00Z');
  const { db, user, other, store } = fixture(t, { clock: () => time, choose: () => 0 });
  for (let n = 0; n < 6; n++) {
    store.daily(user);
    store.daily(user);
    time += 2 * 86400000;
  }
  assert.equal(store.checkin(user).visits, 6);
  assert.equal(store.checkin(user).milestone.status, 'locked');
  const input = { requestId: randomUUID(), pool: 'combat', count: 1, voucher: true };
  assert.throws(() => store.draw(user, input), { code: 'GACHA_VOUCHER_REQUIRED' });
  assert.equal(store.claimCheckin(user, 'legendary').milestone.status, 'available');
  assert.equal(store.claimCheckin(user, 'legendary').visits, 7);
  assert.throws(() => store.claimCheckin(other, 'legendary'), { code: 'GACHA_CHECKIN_NOT_READY' });
  const before = store.wallet(user).coins;
  const restarted = new GachaStore(db, { clock: () => time, choose: () => 0 });
  assert.throws(() => restarted.draw(user, { ...input, count: 10 }), {
    code: 'INVALID_GACHA_DRAW',
  });
  const receipt = restarted.draw(user, input);
  assert.equal(receipt.results[0].rarity, 'legendary');
  assert.equal(receipt.cost, 0);
  assert.equal(receipt.wallet.coins, before);
  assert.equal(receipt.drawCount, 0);
  assert.equal(restarted.drawCounts(user).get('combat'), undefined);
  assert.deepEqual(restarted.draw(user, input), receipt);
  assert.throws(() => restarted.draw(user, { ...input, requestId: randomUUID() }), {
    code: 'GACHA_VOUCHER_REQUIRED',
  });
  assert.equal(restarted.claimCheckin(user, 'legendary').milestone.status, 'used');
  require('../src/gacha/validation').validateGachaDatabase(db);
});
test('each pool counts historical draws separately and boosts only milestone cards in ten pulls', (t) => {
  let bonusRoll;
  const { db, user, other, store } = fixture(t, {
    choose: () => {
      const roll = bonusRoll ?? 0;
      bonusRoll = undefined;
      return roll;
    },
  });
  fund(store, db, user, 20_000, 0);
  const draw = (pool, count) => store.draw(user, { pool, count, requestId: randomUUID() });
  for (let n = 0; n < 4; n++) draw('combat', 10);
  for (let n = 0; n < 9; n++) draw('combat', 1);
  db.prepare(
    "UPDATE gacha_requests SET response_json=json_remove(response_json,'$.drawCount')",
  ).run();
  const poolCount = (id, player = user) =>
    store.state(player).pools.find((pool) => pool.id === id).drawCount;
  assert.equal(poolCount('combat'), 49);
  assert.equal(poolCount('combat', other), 0);
  assert.equal(draw('all', 1).results[0].rarity, 'common');
  assert.equal(draw('arrival', 1).results[0].rarity, 'common');
  const request = { pool: 'combat', count: 10, requestId: randomUUID() };
  bonusRoll = 59;
  const receipt = store.draw(user, request);
  assert.equal(receipt.drawCount, 59);
  assert.equal(receipt.results[0].rarity, 'epic');
  assert.ok(receipt.results.slice(1).every((item) => item.rarity === 'common'));
  assert.deepEqual(store.draw(user, request), receipt);
  assert.equal(poolCount('combat'), 59);
  assert.equal(poolCount('all'), 1);
  assert.equal(poolCount('arrival'), 1);
  for (let n = 0; n < 4; n++) draw('combat', 10);
  bonusRoll = 60;
  assert.equal(draw('combat', 1).results[0].rarity, 'legendary');
  assert.equal(poolCount('combat'), 100);
  assert.equal(bonusRoll, undefined);
});
test('ten pulls charge once, deduplicate rewards within the same batch, and replay exactly', (t) => {
  const { db, user, store } = fixture(t, { choose: () => 0 });
  fund(store, db, user, 1000, 0);
  const input = { requestId: randomUUID(), pool: 'attacks', count: 10 };
  const first = store.draw(user, input),
    item = poolItems('attacks')[0];
  assert.equal(first.results.length, 10);
  assert.equal(first.results[0].duplicate, false);
  assert.equal(
    first.results.slice(1).every((r) => r.duplicate),
    true,
  );
  assert.equal(first.wallet.coins, 0);
  assert.equal(first.wallet.fragments, item.duplicateFragments * 9);
  assert.equal(first.results[0].label, item.label);
  assert.notEqual(item.label, item.rarityLabel);
  assert.deepEqual(store.draw(user, input), first);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gacha_requests').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gacha_ledger').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gacha_ownership').get().n, 1);
  assert.throws(
    () => store.draw(user, { ...input, count: 1 }),
    (e) => e.code === 'GACHA_REQUEST_CONFLICT',
  );
});
test('weighted draw respects rarity and uniform item boundaries', (t) => {
  const rolls = [];
  const { db, user, store } = fixture(t, { choose: () => rolls.shift() });
  fund(store, db, user, 1000, 0);
  const entries = poolItems('all');
  for (const [sample, rarity, itemIndex] of [
    [0, 'common', 0],
    [69, 'common', 1],
    [70, 'rare', 0],
    [90, 'epic', 0],
    [97, 'legendary', 0],
    [99, 'legendary', 1],
  ]) {
    rolls.push(sample, itemIndex);
    const r = store.draw(user, { requestId: randomUUID(), pool: 'all', count: 1 });
    assert.equal(r.results[0].key, entries.filter((item) => item.rarity === rarity)[itemIndex].key);
  }
});
test('a failed pull batch rolls back debit, ownership, shards, and request receipt', (t) => {
  let count = 0;
  const { db, user, store } = fixture(t, {
    choose: () => {
      if (++count === 4) throw Error('sample failure');
      return 0;
    },
  });
  fund(store, db, user, 1000, 0);
  assert.throws(
    () => store.draw(user, { requestId: randomUUID(), pool: 'all', count: 10 }),
    /sample failure/,
  );
  assert.deepEqual(store.wallet(user), { coins: 1000, fragments: 0 });
  for (const table of ['gacha_ownership', 'gacha_ledger', 'gacha_requests'])
    assert.equal(db.prepare('SELECT COUNT(*) n FROM ' + table).get().n, 0);
});
test('exchange owns only its category, rejects owned items without spending, and is idempotent', (t) => {
  const { db, user, other, store } = fixture(t);
  fund(store, db, user);
  const item = catalog.find((i) => i.kind === 'frames'),
    input = { requestId: randomUUID(), key: item.key };
  const result = store.exchange(user, input);
  assert.equal(result.wallet.fragments, 1000 - item.exchangeCost);
  assert.deepEqual(store.exchange(user, input), result);
  assert.ok(Ownership.ownedIds(db, user, 'frames').includes(item.id));
  assert.ok(!Ownership.ownedIds(db, user, 'media').includes(item.id));
  assert.throws(
    () => store.exchange(user, { ...input, requestId: randomUUID() }),
    (e) => e.code === 'GACHA_ALREADY_OWNED',
  );
  assert.equal(store.wallet(user).fragments, result.wallet.fragments);
  fund(store, db, other);
  assert.doesNotThrow(() => store.exchange(other, input));
});
test('invalid, insufficient, cross-operation, and unknown requests have no partial effects', (t) => {
  const { db, user, store } = fixture(t, { choose: () => 0 });
  fund(store, db, user, 0, 0);
  assert.throws(
    () => store.draw(user, { requestId: randomUUID(), pool: 'all', count: 1 }),
    (e) => e.code === 'GACHA_COINS_REQUIRED',
  );
  assert.throws(
    () => store.draw(user, { requestId: randomUUID(), pool: {}, count: 1 }),
    (e) => e.code === 'INVALID_GACHA_DRAW',
  );
  assert.throws(
    () => store.draw(user, { requestId: 'bad', pool: 'all', count: 1 }),
    (e) => e.code === 'INVALID_GACHA_REQUEST',
  );
  assert.throws(
    () => store.exchange(user, { requestId: randomUUID(), key: catalog[0].key }),
    (e) => e.code === 'GACHA_FRAGMENTS_REQUIRED',
  );
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gacha_requests').get().n, 0);
  fund(store, db, user);
  const requestId = randomUUID();
  store.draw(user, { requestId, pool: 'all', count: 1 });
  assert.throws(
    () => store.exchange(user, { requestId, key: catalog.find((i) => i.kind === 'frames').key }),
    (e) => e.code === 'GACHA_REQUEST_CONFLICT',
  );
});
test('author codes do not unlock attacks while starter grants remain owned', (t) => {
  const { db, user, other, store } = fixture(t);
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
    JSON.stringify({ achievementRewardCodes: { other: '2026-10-29T00:00:00.000Z' } }),
    user,
  );
  assert.equal(store.owned(user).attacks.size, 0);
  assert.equal(store.owned(user).frames.size, 0);
  const item = catalog.find((i) => i.kind === 'entrances');
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
    JSON.stringify({
      starterRewardPack: {
        version: 1,
        redeemedAt: '2026-10-29T00:00:00.000Z',
        grants: { entrances: [item.id] },
      },
    }),
    other,
  );
  assert.ok(store.owned(other).entrances.has(item.id));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM user_achievements').get().n, 0);
});

for (const saved of [
  { achievementRewardCodes: { other: '2026-10-29T00:00:00.000Z' } },
  { achievementRewardCodeAt: '2026-10-01T00:00:00.000Z' },
]) {
  const format = saved.achievementRewardCodes ? 'grouped' : 'legacy';
  test(`${format} author code holders must acquire attacks before equipping them`, (t) => {
    const { db, user, store } = fixture(t, { choose: () => 0 });
    const { getAttackSettings, setAttackSettings } = require('../src/profiles/settings');
    db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
      JSON.stringify({ ...saved, attackLoadout: { q: 'shield', e: 'beam', r: 'bijuu_beam' } }),
      user,
    );
    assert.deepEqual(getAttackSettings(db, user), { q: 'barrage', e: 'beam', r: '' });
    assert.throws(() => setAttackSettings(db, user, { q: 'shield', e: 'beam', r: 'bijuu_beam' }), {
      code: 'ATTACK_REWARD_LOCKED',
    });
    const achievements = new (require('../src/achievements/store').AchievementStore)(db);
    achievements.redeem(user, '我愛作者');
    assert.deepEqual(achievements.list(user).bonusRewards.attacks, ['barrage', 'beam']);
    fund(store, db, user);
    const drawn = store.draw(user, { pool: 'attacks', count: 1, requestId: randomUUID() })
      .results[0];
    assert.equal(drawn.duplicate, false);
    assert.ok(store.owned(user).attacks.has(drawn.id));
    store.exchange(user, { key: 'attacks:bijuu_beam', requestId: randomUUID() });
    const loadout = { q: drawn.id, e: 'beam', r: 'bijuu_beam' };
    assert.deepEqual(setAttackSettings(db, user, loadout), loadout);
    achievements.redeem(user, '我愛作者');
    assert.deepEqual(getAttackSettings(db, user), loadout);
    assert.equal(new GachaStore(db).owned(user).attacks.size, 2);
    assert.ok(require('../src/achievements/redemption').redeemedAt(db, user, 'other'));
  });
}

test('author codes cannot unlock attacks in the pre-gacha ownership path', (t) => {
  const { db, user } = fixture(t);
  for (const table of GACHA_TABLES) db.exec('DROP TABLE ' + table);
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
    JSON.stringify({ achievementRewardCodeAt: '2026-10-01T00:00:00.000Z' }),
    user,
  );
  assert.deepEqual(require('../src/achievements/attack-rewards').ownedAttacks(db, user), [
    'barrage',
    'beam',
  ]);
});
test('normal completed matches reward active humans once, preserve winners and exclude tests, bots, and AFK', (t) => {
  const { db, user, other, store } = fixture(t),
    afk = addUser(db, 'afk');
  const facts = {
    id: randomUUID(),
    game: 'draw',
    purpose: 'production',
    normalEnd: true,
    completedAt: '2026-10-29T12:00:00.000Z',
    participants: [
      { userId: user, operated: true, winner: true },
      { userId: other, operated: true },
      { userId: afk, operated: false },
      { bot: true, operated: true },
    ],
  };
  assert.deepEqual(store.awardMatch(facts), [
    { userId: user, coins: 500 },
    { userId: other, coins: 300 },
  ]);
  assert.deepEqual(store.awardMatch(facts), []);
  assert.equal(store.wallet(user).coins, 500);
  assert.equal(store.wallet(other).coins, 300);
  assert.equal(store.wallet(afk).coins, 0);
  assert.deepEqual(store.matchReward(facts, user), { id: facts.id, coins: 500, winner: true });
  assert.deepEqual(store.matchReward(facts, other), { id: facts.id, coins: 300, winner: false });
  assert.deepEqual(store.matchReward(facts, afk), { id: facts.id, coins: 0, winner: false });
  assert.deepEqual(store.awardMatch({ ...facts, id: randomUUID(), purpose: 'test' }), []);
  assert.deepEqual(store.awardMatch({ ...facts, id: randomUUID(), normalEnd: false }), []);
  assert.deepEqual(
    store.awardMatch({
      ...facts,
      id: randomUUID(),
      participants: [facts.participants[0], { bot: true, operated: true }],
    }),
    [],
  );
  assert.throws(
    () =>
      store.awardMatch({
        ...facts,
        participants: facts.participants.map((p) => ({ ...p, winner: false })),
      }),
    (e) => e.code === 'GACHA_EVENT_CONFLICT',
  );
  assert.equal(store.wallet(user).coins, 500);
});
test('schema21 migration snapshots legacy ownership exactly once; later achievements do not grant rewards', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bga-gacha-'));
  const file = path.join(dir, 'users.sqlite');
  let db = openDatabase(file);
  t.after(() => {
    db.close();
    const target = path.resolve(dir);
    assert.equal(path.dirname(target), path.resolve(tmpdir()));
    assert.match(path.basename(target), /^bga-gacha-/);
    rmSync(target, { recursive: true, force: true });
  });
  const user = addUser(db, 'legacy');
  db.prepare(
    'INSERT INTO coc_receipts(user_id,request_id,scope,fingerprint,response_json,created_at) VALUES(?,?,?,?,?,?)',
  ).run(
    user,
    'prior-coc-operation',
    'character',
    'unchanged',
    '{"ok":true}',
    '2026-10-01T00:00:00.000Z',
  );
  const priorCoc = db.prepare('SELECT * FROM coc_receipts').all();
  const old = catalog.find((i) => i.kind === 'attacks' && i.achievementIds.length);
  const later = catalog.find(
    (i) =>
      i.kind === 'attacks' &&
      i.achievementIds.length &&
      !i.achievementIds.includes(old.achievementIds[0]),
  );
  for (const name of GACHA_TABLES) db.exec('DROP TABLE ' + name);
  db.exec('PRAGMA user_version=21');
  db.prepare(
    'INSERT INTO user_achievements(user_id,achievement_id,source_key,unlocked_at) VALUES(?,?,?,?)',
  ).run(user, old.achievementIds[0], 'old', '2026-10-01T00:00:00.000Z');
  db.close();
  db = openDatabase(file);
  assert.deepEqual(db.prepare('SELECT * FROM coc_receipts').all(), priorCoc);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
  assert.ok(Ownership.ownedIds(db, user, 'attacks').includes(old.id));
  db.prepare(
    'INSERT INTO user_achievements(user_id,achievement_id,source_key,unlocked_at) VALUES(?,?,?,?)',
  ).run(user, later.achievementIds[0], 'new', '2026-10-01T00:00:00.000Z');
  assert.ok(
    !Ownership.ownedIds(db, user, 'attacks').includes(later.id),
    'even backdated new achievements cannot award after migration',
  );
  require('../src/gacha/legacy').snapshotLegacyRewards(db);
  assert.ok(!Ownership.ownedIds(db, user, 'attacks').includes(later.id));
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});

test('former starter entrances are obtainable from the arrival pool or by fragment exchange', (t) => {
  const locked = ['smoke', 'sparks', 'ink', 'rift', 'particles'];
  const entries = poolItems('arrival').filter((item) => item.rarity === 'common');
  const smoke = entries.findIndex((item) => item.key === 'entrances:smoke');
  const rolls = [0, smoke];
  const { db, store, user, other } = fixture(t, { choose: () => rolls.shift() });
  fund(store, db, user);
  assert.ok(locked.every((id) => !store.owned(user).entrances.has(id)));
  assert.ok(locked.every((id) => entries.some((item) => item.key === 'entrances:' + id)));
  assert.ok(
    ['classic', 'runes'].every((id) => !entries.some((item) => item.key === 'entrances:' + id)),
  );
  assert.equal(
    store.draw(user, { pool: 'arrival', count: 1, requestId: randomUUID() }).results[0].id,
    'smoke',
  );
  store.exchange(user, { key: 'entrances:ink', requestId: randomUUID() });
  assert.deepEqual([...store.owned(user).entrances].sort(), ['ink', 'smoke']);
  assert.equal(store.owned(other).entrances.size, 0);
});

test('every new palette is an independent draw and exchange reward with the original rarity', (t) => {
  const { starters, variants } = require('../public/shared/entrance-palette.json');
  const entrances = require('../public/shared/entrance-requirements.json');
  const attacks = require('../public/shared/attack-effects.json');
  const palettes = attacks.filter((e) => 'paletteHue' in e);
  assert.equal(palettes.length, 39);
  for (const id of [
    'crystal_reflection',
    'crystal_reflection_alt',
    'sakura_swarm',
    'sakura_swarm_alt',
    'venom_thorn',
    'venom_thorn_alt',
  ]) {
    assert.equal(poolItems('attacks').find((item) => item.id === id)?.rarity, 'epic', id);
  }
  assert.equal(variants.length, 31);
  assert.deepEqual(
    new Set(variants.map((e) => e.variantOf)),
    new Set([...starters, ...entrances].map((e) => e.id)),
  );
  const covered = new Set(attacks.map((e) => e.variantOf).filter(Boolean));
  assert.ok(
    attacks.every(
      (e) =>
        covered.has(e.id) || e.variantOf || ['blade_aura', 'blade_aura_crimson'].includes(e.id),
    ),
  );
  for (const [kind, entries] of [
    ['attacks', palettes],
    ['entrances', variants],
  ]) {
    const items = poolItems(kind);
    for (const e of entries) {
      const item = items.find((item) => item.id === e.id);
      const parent = items.find((item) => item.id === e.variantOf);
      assert.equal(item.rarity, parent?.rarity || 'common');
      assert.deepEqual(item.achievementIds, []);
      assert.equal(item.legacy, false);
      assert.equal(item.gachaExclusive, true);
    }
  }
  const attack = poolItems('attacks').find((item) => item.id === 'shield_alt');
  const entrance = poolItems('entrances').find((item) => item.id === 'classic-alt');
  const pick = poolItems('attacks')
    .filter((item) => item.rarity === attack.rarity)
    .indexOf(attack);
  const rolls = [0, pick];
  const { db, store, user, other } = fixture(t, { choose: () => rolls.shift() });
  fund(store, db, user);
  assert.equal(
    store.draw(user, { pool: 'attacks', count: 1, requestId: randomUUID() }).results[0].id,
    attack.id,
  );
  assert.ok(store.owned(user).attacks.has(attack.id));
  assert.ok(!store.owned(user).attacks.has('shield'));
  assert.ok(!store.owned(user).entrances.has(entrance.id));
  store.exchange(user, { key: entrance.key, requestId: randomUUID() });
  assert.ok(store.owned(user).entrances.has(entrance.id));
  assert.ok(!store.owned(other).attacks.has(attack.id));
  assert.ok(!store.owned(other).entrances.has(entrance.id));
  const { setAttackSettings, getAttackSettings } = require('../src/profiles/settings');
  const loadout = { q: attack.id, e: 'beam', r: '' };
  assert.throws(() => setAttackSettings(db, other, loadout));
  setAttackSettings(db, user, loadout);
  assert.deepEqual(getAttackSettings(db, user), loadout);
});

test('retired achievement ownership can be reacquired through the prize machine', (t) => {
  const { db, user, other, store } = fixture(t, { choose: () => 0 });
  const item = poolItems('frames')[0];
  const seed = db.prepare("INSERT INTO gacha_ownership VALUES(?,?,?,'legacy',?)");
  for (const id of [user, other]) {
    seed.run(id, item.kind, item.id, store.at());
    assert.ok(!Ownership.ownedIds(db, id, item.kind).includes(item.id));
    fund(store, db, id);
  }
  store.draw(user, { pool: 'frames', count: 1, requestId: randomUUID() });
  store.exchange(other, { key: item.key, requestId: randomUUID() });
  const source = db.prepare(
    'SELECT source FROM gacha_ownership WHERE user_id=? AND kind=? AND reward_id=?',
  );
  assert.equal(source.get(user, item.kind, item.id).source, 'draw');
  assert.equal(source.get(other, item.kind, item.id).source, 'exchange');
});

test('Susanoo has two reward records and their separate style sets share the correct ownership', (t) => {
  const { db, store, user, other } = fixture(t);
  fund(store, db, user, 2000, 2000);
  fund(store, db, other, 2000, 2000);
  const settings = require('../src/profiles/settings');
  const susanoo = poolItems('attacks').filter((item) => item.id.startsWith('susanoo'));
  assert.deepEqual(
    susanoo.map((item) => item.id),
    ['susanoo', 'susanoo_alt'],
  );
  store.exchange(user, { key: 'attacks:susanoo', requestId: randomUUID() });
  store.exchange(other, { key: 'attacks:susanoo_alt', requestId: randomUUID() });
  const loadout = { q: 'barrage', e: 'beam' };
  for (const [owner, allowed, locked] of [
    [user, ['susanoo', 'susanoo_orange'], 'susanoo_blue'],
    [other, ['susanoo_alt', 'susanoo_blue', 'susanoo_cyan'], 'susanoo_orange'],
  ]) {
    for (const r of allowed) {
      settings.setAttackSettings(db, owner, { ...loadout, r });
      assert.equal(settings.getAttackSettings(db, owner).r, r);
    }
    assert.throws(() => settings.setAttackSettings(db, owner, { ...loadout, r: locked }), {
      code: 'ATTACK_REWARD_LOCKED',
    });
  }
});

test('legendary frames and player styles require independent ownership', (t) => {
  const { AchievementStore } = require('../src/achievements/store');
  const { db, store, user, other } = fixture(t);
  const achievements = new AchievementStore(db);
  for (const member of [user, other]) fund(store, db, member, 2000, 2000);
  for (const id of ['observatory', 'abyssal-glass', 'eclipse-theatre']) {
    assert.throws(() => achievements.assertFrame(user, id), { code: 'FRAME_LOCKED' });
    store.exchange(user, { key: 'media:' + id, requestId: randomUUID() });
    assert.throws(() => achievements.assertFrame(user, id), { code: 'FRAME_LOCKED' });
    assert.ok(achievements.list(user).bonusRewards.media.includes(id));
    assert.ok(!achievements.list(user).bonusRewards.frames.includes(id));
    store.exchange(other, { key: 'frames:' + id, requestId: randomUUID() });
    achievements.assertFrame(other, id);
    assert.ok(!achievements.list(other).bonusRewards.media.includes(id));
  }
});
