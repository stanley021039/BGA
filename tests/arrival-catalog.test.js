const { test } = require('node:test');
const assert = require('node:assert/strict');
const { catalog: items } = require('../src/gacha/catalog');
const entries = require('../public/shared/entrance-palette.json').starters.filter((e) =>
  e.id.startsWith('arrival-'),
);
test('nine new entrances have the approved rarity, gacha ownership and no retroactive achievement grant', () => {
  assert.equal(entries.length, 9);
  assert.deepEqual(
    entries.map((e) => e.rarity),
    ['rare', 'epic', 'legendary', 'legendary', 'common', 'rare', 'common', 'rare', 'legendary'],
  );
  for (const effect of entries) {
    const item = items.find((i) => i.key === 'entrances:' + effect.id);
    assert.ok(item, effect.id);
    assert.equal(item.rarity, effect.rarity);
    assert.equal(item.gachaExclusive, true);
    assert.equal(item.legacy, false);
    assert.deepEqual(item.achievementIds, []);
    assert.ok(item.exchangeCost > 0);
  }
});

test('each arrival alternate keeps its approved rarity and unlocks independently from its original', (t) => {
  const { randomUUID } = require('node:crypto'),
    { openDatabase } = require('../src/db'),
    { GachaStore } = require('../src/gacha/store');
  const { variants } = require('../public/shared/entrance-palette.json');
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  for (const base of entries) {
    const alt = variants.find((v) => v.variantOf === base.id);
    assert.ok(alt, base.id);
    assert.ok(Object.entries(alt.colors).some(([a, b]) => a !== b));
    assert.equal(items.find((i) => i.id === alt.id && i.kind === 'entrances').rarity, base.rarity);
    const id = randomUUID();
    db.prepare(
      'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    ).run(id, 'variant_' + base.id.slice(8), '測試', 'unused', 'member', new Date().toISOString());
    const pool = require('../src/gacha/catalog')
        .poolItems('arrival')
        .filter((i) => i.rarity === base.rarity),
      rolls = [
        { common: 0, rare: 70, epic: 90, legendary: 97 }[base.rarity],
        pool.findIndex((i) => i.id === alt.id),
      ];
    const store = new GachaStore(db, { choose: () => rolls.shift() });
    store.wallet(id);
    db.prepare('UPDATE gacha_wallets SET coins=100 WHERE user_id=?').run(id);
    assert.equal(
      store.draw(id, { pool: 'arrival', count: 1, requestId: randomUUID() }).results[0].id,
      alt.id,
    );
    assert.ok(store.owned(id).entrances.has(alt.id));
    assert.equal(store.owned(id).entrances.has(base.id), false);
  }
});

test('each new entrance can actually be drawn and exchanged, persisting independent ownership', (t) => {
  const { randomUUID } = require('node:crypto');
  const { openDatabase } = require('../src/db');
  const { GachaStore } = require('../src/gacha/store');
  const { poolItems } = require('../src/gacha/catalog');
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  for (const effect of entries) {
    const ids = [randomUUID(), randomUUID()];
    for (const [index, id] of ids.entries())
      db.prepare(
        'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
      ).run(
        id,
        effect.id.slice(0, 18) + index,
        '測試',
        'unused',
        'member',
        new Date().toISOString(),
      );
    const tierRoll = { common: 0, rare: 70, epic: 90, legendary: 97 }[effect.rarity];
    const eligible = poolItems('arrival').filter((item) => item.rarity === effect.rarity);
    const rolls = [tierRoll, eligible.findIndex((item) => item.id === effect.id)];
    const store = new GachaStore(db, { choose: () => rolls.shift() });
    for (const id of ids) {
      store.wallet(id);
      db.prepare('UPDATE gacha_wallets SET coins=1000,fragments=1000 WHERE user_id=?').run(id);
    }
    const draw = store.draw(ids[0], { pool: 'arrival', count: 1, requestId: randomUUID() });
    assert.equal(draw.results[0].id, effect.id);
    assert.equal(draw.results[0].rarity, effect.rarity);
    assert.equal(store.owned(ids[1]).entrances.has(effect.id), false);
    store.exchange(ids[1], { key: 'entrances:' + effect.id, requestId: randomUUID() });
    for (const id of ids) assert.ok(store.owned(id).entrances.has(effect.id));
  }
});
