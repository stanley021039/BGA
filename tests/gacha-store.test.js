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
  assert.equal(SCHEMA_VERSION, 22);
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
test('daily credit uses Taipei midnight, survives store recreation, and cannot double grant', (t) => {
  let time = Date.parse('2026-10-29T15:59:59.999Z');
  const { db, user, store } = fixture(t, { clock: () => time });
  assert.equal(taipeiDay(time), '2026-10-29');
  store.daily(user);
  store.daily(user);
  assert.equal(store.wallet(user).coins, 100);
  new GachaStore(db, { clock: () => time }).daily(user);
  assert.equal(store.wallet(user).coins, 100);
  time++;
  assert.equal(taipeiDay(time), '2026-10-30');
  store.daily(user);
  assert.equal(store.wallet(user).coins, 200);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM gacha_ledger WHERE reason='login'").get().n, 2);
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
test('weighted draw respects item boundaries and the combined pool uses item weights directly', (t) => {
  let roll = 0;
  const { db, user, store } = fixture(t, { choose: () => roll });
  fund(store, db, user, 1000, 0);
  const entries = poolItems('all'),
    total = entries.reduce((n, i) => n + i.weight, 0);
  for (const [sample, expected] of [
    [0, entries[0]],
    [entries[0].weight - 1, entries[0]],
    [entries[0].weight, entries[1]],
    [total - 1, entries.at(-1)],
  ]) {
    roll = sample;
    const r = store.draw(user, { requestId: randomUUID(), pool: 'all', count: 1 });
    assert.equal(r.results[0].key, expected.key);
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
test('existing reward codes and starter grants stay owned without granting achievements', (t) => {
  const { db, user, other, store } = fixture(t);
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
    JSON.stringify({ achievementRewardCodes: { other: '2026-10-29T00:00:00.000Z' } }),
    user,
  );
  assert.equal(
    store.owned(user).attacks.size,
    poolItems('attacks').filter((item) => !item.gachaExclusive).length,
  );
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
    { userId: user, coins: 75 },
    { userId: other, coins: 50 },
  ]);
  assert.deepEqual(store.awardMatch(facts), []);
  assert.equal(store.wallet(user).coins, 75);
  assert.equal(store.wallet(other).coins, 50);
  assert.equal(store.wallet(afk).coins, 0);
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
  assert.equal(store.wallet(user).coins, 75);
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
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 22);
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

test('every new palette is an independent draw and exchange reward with the original rarity', (t) => {
  const { starters, variants } = require('../public/shared/entrance-palette.json');
  const entrances = require('../public/shared/entrance-requirements.json');
  const attacks = require('../public/shared/attack-effects.json');
  const palettes = attacks.filter((e) => 'paletteHue' in e);
  assert.equal(palettes.length, 21);
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
    .slice(0, poolItems('attacks').indexOf(attack))
    .reduce((total, item) => total + item.weight, 0);
  const { db, store, user, other } = fixture(t, { choose: () => pick });
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
